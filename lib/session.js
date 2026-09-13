import crypto from 'node:crypto';
import { query, nouvelId } from './db.js';

/**
 * Identification sans mot de passe (4.4bis).
 *
 * On se choisit dans la liste des gens déjà connus. La première fois, on
 * ajoute son surnom ; ensuite, sur n'importe quel appareil, on se retrouve
 * dans la liste et on clique. C'est ce geste-là qui empêche les doublons :
 * il n'y a plus rien à retaper, donc plus rien à écrire différemment.
 *
 * Aucune vérification : qui choisit le nom d'un autre passe pour lui. Décidé
 * le 12/09/2026 — il n'y a pas d'enjeu de sécurité sur un covoiturage du
 * midi, et le contrôle se fait sur le parking. Le jeton de session, lui,
 * n'est jamais stocké en clair : la base n'en garde que l'empreinte SHA-256.
 */

const VIE_SESSION_J = 365;
const NOM_COOKIE = 'vroom';

/**
 * Au bout d'un mois sans revenir, on sort de la liste.
 *
 * C'est le ménage que personne ne fera : un surnom mal tapé, quelqu'un qui
 * change de service. La ligne reste en base — revenir, c'est se retrouver,
 * pas repartir de zéro — mais elle cesse d'encombrer l'écran, et son nom
 * redevient libre.
 */
const OUBLI_J = 30;

function empreinte(jeton){ return crypto.createHash('sha256').update(jeton).digest('hex'); }
function nouveauJeton(){ return crypto.randomBytes(32).toString('base64url'); }

/**
 * Un surnom, librement choisi. L'appli ne demande rien d'autre — ni nom de
 * famille, ni coordonnées — et cette absence est une contrainte de conception,
 * pas un oubli : c'est elle qui garde le projet hors du champ des données
 * personnelles.
 */
export function nomPropre(v){
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
}
export function nomValide(nom){ return nom.length >= 2 && nom.length <= 30; }

/* ---------- cookie ---------- */

export function litCookie(req, nom){
  const brut = req.headers?.cookie;
  if(!brut) return null;
  for(const part of brut.split(';')){
    const i = part.indexOf('=');
    if(i < 0) continue;
    if(part.slice(0, i).trim() === nom) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function enClair(req){
  return (req.headers['x-forwarded-proto'] || 'http') !== 'https';
}

export function poseCookie(req, res, jeton){
  const bouts = [
    `${NOM_COOKIE}=${encodeURIComponent(jeton)}`,
    'Path=/', 'HttpOnly', 'SameSite=Lax',
    `Max-Age=${VIE_SESSION_J * 24 * 3600}`
  ];
  if(!enClair(req)) bouts.push('Secure');
  res.setHeader('set-cookie', bouts.join('; '));
}

export function retireCookie(req, res){
  const bouts = [`${NOM_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if(!enClair(req)) bouts.push('Secure');
  res.setHeader('set-cookie', bouts.join('; '));
}

/* ---------- qui est là ---------- */

/**
 * L'identité vient du cookie, jamais du corps de la requête : le client ne
 * dit pas qui il est, il le prouve.
 * @returns {Promise<{id:string, prenom:string}|null>}
 */
export async function personneCourante(req){
  const jeton = litCookie(req, NOM_COOKIE);
  if(!jeton || jeton.length < 20) return null;
  const { rows } = await query(
    `update sessions s set vue_le = now()
       from personnes p
      where s.jeton = $1 and p.id = s.personne_id
     returning p.id, p.prenom`,
    [empreinte(jeton)]
  );
  return rows[0] || null;
}

/* ---------- la liste, et le choix ---------- */

/** Les gens déjà connus, pour qu'on s'y retrouve au lieu de se retaper. */
export async function listeGens(){
  const { rows } = await query(
    `select nom from personnes
      where nom is not null and vue_le > now() - ($1 || ' days')::interval
      order by lower(nom)`,
    [String(OUBLI_J)]
  );
  return rows.map(r => r.nom);
}

/**
 * Ce nom est-il déjà pris ? Renvoie le nom tel qu'il est écrit dans la liste,
 * et non tel qu'il vient d'être tapé : c'est celui-là qu'il faut montrer pour
 * qu'on s'y reconnaisse.
 */
export async function nomExiste(nom){
  // Même filtre que la liste, sans quoi on refuserait un nom que l'écran ne
  // montre pas : impossible à comprendre, et impossible à contourner.
  const { rows } = await query(
    `select nom from personnes
      where lower(nom) = lower($1) and vue_le > now() - ($2 || ' days')::interval`,
    [nom, String(OUBLI_J)]
  );
  return rows[0]?.nom || null;
}

/**
 * Ouvrir une session pour ce nom — en le créant s'il est nouveau.
 * Le nom est la clé : se choisir deux fois, c'est être la même personne.
 */
export async function ouvreSessionPour(nom){
  // Sur conflit, on garde le nom déjà enregistré : c'est celui sous lequel
  // les collègues connaissent la personne, et celui qu'affiche la liste.
  // Se choisir en tapant « marc » ne doit pas renommer Marc.
  const { rows: [personne] } = await query(
    `insert into personnes (id, nom, prenom) values ($1,$2,$2)
     on conflict (lower(nom)) do update set vue_le = now()
     returning id, prenom`,
    [nouvelId(), nom]
  );
  const jetonSession = nouveauJeton();
  await query(`insert into sessions (jeton, personne_id) values ($1,$2)`,
              [empreinte(jetonSession), personne.id]);
  return { jeton: jetonSession, prenom: personne.prenom };
}

/**
 * Corriger son propre nom. Les annonces et les places portent le surnom en
 * clair — c'est ce qui s'affiche au panneau —, donc elles suivent.
 * @returns {Promise<{ok:true}|{ok:false, erreur:string, nom?:string}>}
 */
export async function renommePersonne(id, nom){
  const pris = await query(
    `select nom from personnes
      where lower(nom) = lower($1) and id <> $2
        and vue_le > now() - ($3 || ' days')::interval`,
    [nom, id, String(OUBLI_J)]
  );
  if(pris.rows.length) return { ok:false, erreur:'nom_pris', nom: pris.rows[0].nom };

  await query(`update personnes set nom = $2, prenom = $2, vue_le = now() where id = $1`, [id, nom]);
  await query(`update annonces set prenom = $2 where personne = $1`, [id, nom]);
  await query(`update passagers set prenom = $2 where personne = $1`, [id, nom]);
  return { ok:true };
}

/**
 * Se retirer de la liste. On emporte ses engagements avec soi : rester
 * inscrit à un trajet sous un nom qui n'existe plus laisserait un collègue
 * attendre quelqu'un d'introuvable.
 */
export async function supprimePersonne(id){
  await query(`delete from passagers where personne = $1`, [id]);
  await query(`update annonces set statut='annulee' where personne = $1 and statut='ouverte'`, [id]);
  await query(`delete from personnes where id = $1`, [id]);   // les sessions suivent
}

export async function fermeSession(req){
  const jeton = litCookie(req, NOM_COOKIE);
  if(jeton) await query(`delete from sessions where jeton = $1`, [empreinte(jeton)]);
}
