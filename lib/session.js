import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { query, nouvelId } from './db.js';

/**
 * Identification sans mot de passe — lien magique par mail (4.4bis).
 *
 * L'agent saisit l'adresse qu'il veut, professionnelle ou personnelle, reçoit
 * un lien, clique : session posée pour un an, sur cet appareil. Aucun mot de
 * passe n'existe, donc aucun n'est à retenir, à réinitialiser, ni à fuiter.
 *
 * Ce que ça garantit : la continuité — c'est bien la même personne d'une fois
 * sur l'autre et d'un appareil à l'autre. Pas la qualité d'agent : le domaine
 * de l'adresse n'est pas contrôlé, par décision du 12/09/2026.
 *
 * Deux secrets circulent, ni l'un ni l'autre n'est jamais stocké en clair :
 * le jeton du lien (un quart d'heure, un seul usage) et le jeton de session
 * (un an, cookie httpOnly). La base n'en garde que l'empreinte SHA-256 : qui
 * lirait la table ne pourrait pas se faire passer pour quelqu'un.
 */

const VIE_LIEN_MIN = 20;
const VIE_SESSION_J = 365;

function empreinte(jeton){
  return crypto.createHash('sha256').update(jeton).digest('hex');
}
function nouveauJeton(){
  return crypto.randomBytes(32).toString('base64url');
}

/** Une adresse se compare en minuscules, sans espaces. On ne touche à rien
 *  d'autre : retirer les points ou ce qui suit un « + » fusionnerait des
 *  adresses distinctes chez la plupart des fournisseurs. */
export function normaliseEmail(v){
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

/** Assez strict pour attraper les fautes de frappe, assez large pour ne pas
 *  rejeter une adresse valide exotique. Le vrai test, c'est que le mail
 *  arrive. */
export function emailPlausible(email){
  return email.length >= 6 && email.length <= 120 &&
         /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(email);
}

/* ---------- cookie ---------- */

const NOM_COOKIE = 'vroom';

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
  // Derrière Vercel on est toujours en https ; en local, non.
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
 * L'identité vient du cookie, jamais du corps de la requête.
 * C'est tout le correctif de la faille relevée en production : le client ne
 * dit plus qui il est, il le prouve.
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

/* ---------- envoi du lien ---------- */

/** Garde-fou : un formulaire qui expédie un mail à toute adresse saisie est un
 *  canon à courrier si on le laisse ouvert. Trois liens par adresse et par
 *  quart d'heure, dix par appelant et par heure. */
async function cadenceDepassee(email, ip){
  const { rows } = await query(
    `select
       (select count(*) from liens
         where email = $1 and cree_le > now() - interval '15 minutes')::int as par_adresse,
       (select count(*) from liens
         where ip = $2 and cree_le > now() - interval '1 hour')::int as par_appelant`,
    [email, ip || '']
  );
  return rows[0].par_adresse >= 3 || rows[0].par_appelant >= 10;
}

export function adresseAppelant(req){
  const xff = req.headers['x-forwarded-for'];
  return (Array.isArray(xff) ? xff[0] : (xff || '')).split(',')[0].trim() || '';
}

/**
 * L'adresse du site, pour fabriquer un lien absolu.
 *
 * `SITE_URL` d'abord, et ce n'est pas un détail de confort : à défaut, on
 * déduit l'adresse de l'en-tête `Host`, que l'appelant contrôle. Quelqu'un
 * pourrait alors demander un lien pour l'adresse d'un collègue en pointant le
 * lien vers son propre domaine, et récupérer le jeton au clic. À poser en
 * production.
 */
export function racine(req){
  const conf = (process.env.SITE_URL || '').replace(/\/+$/, '');
  if(conf) return conf;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host}`;
}

let transport = null;
function relais(){
  const url = process.env.SMTP_URL;
  if(!url) return null;
  if(!transport) transport = nodemailer.createTransport(url);
  return transport;
}

export function mailConfigure(){ return !!process.env.SMTP_URL; }

/**
 * L'adresse est-elle vérifiée avant d'ouvrir la session ?
 *
 * Oui dès qu'un courrier peut partir : l'agent reçoit un lien et le clique.
 * Non sinon — décision du 12/09/2026 : plutôt que d'obliger quelqu'un à
 * distribuer les liens un par un, l'adresse saisie ouvre la session sur
 * parole. Le niveau de confiance est celui d'une feuille d'inscription
 * affichée au mur : on peut y écrire le nom d'un autre. Assumé pour un
 * covoiturage entre collègues ; poser `SMTP_URL` rallume la vérification
 * sans toucher au code.
 */
export function verificationActive(){
  return mailConfigure() || process.env.LIENS_EN_CLAIR === 'on';
}

/**
 * Fabrique un lien et l'envoie.
 *
 * Sans `SMTP_URL`, le lien part dans le journal du serveur — mode de
 * démarrage, le temps d'obtenir un relais : on distribue les liens à la main
 * aux premiers volontaires (4.4bis, solution de secours). Il n'est jamais
 * renvoyé au client, sauf `LIENS_EN_CLAIR=on`, qui est réservé au
 * développement local : sur un site ouvert, ce réglage laisse n'importe qui
 * se connecter sous n'importe quelle adresse.
 */
export async function envoieLien(req, email, prenom){
  const ip = adresseAppelant(req);
  if(await cadenceDepassee(email, ip)) return { ok: false, erreur: 'cadence' };

  const jeton = nouveauJeton();
  await query(
    `insert into liens (jeton, email, prenom, ip, expire_le)
     values ($1,$2,$3,$4, now() + ($5 || ' minutes')::interval)`,
    [empreinte(jeton), email, prenom, ip, String(VIE_LIEN_MIN)]
  );

  const lien = `${racine(req)}/api/session?jeton=${encodeURIComponent(jeton)}`;
  const texte =
`Bonjour ${prenom},

Voici votre lien pour Vroom !, le covoiturage du midi :

${lien}

Il est valable ${VIE_LIEN_MIN} minutes et ne sert qu'une fois. Ensuite, cet
appareil vous reconnaîtra sans rien vous redemander.

Si vous n'avez rien demandé, ignorez ce message : personne ne peut se
connecter à votre place sans ce lien.
`;

  const smtp = relais();
  if(!smtp){
    console.log(`[vroom] lien pour ${email} (aucun SMTP_URL configuré) : ${lien}`);
    return { ok: true, poste: false, lien: process.env.LIENS_EN_CLAIR === 'on' ? lien : undefined };
  }

  await smtp.sendMail({
    from: process.env.SMTP_FROM || 'Vroom ! <vroom@localhost>',
    to: email,
    subject: 'Votre lien Vroom !',
    text: texte
  });
  return { ok: true, poste: true };
}

/**
 * Le clic sur le lien. Un seul usage : c'est l'UPDATE conditionnel qui le
 * tient, comme une demande ne se pourvoit qu'une fois (4.3).
 * @returns {Promise<string|null>} le jeton de session, ou null si le lien est
 *   expiré, déjà servi, ou inventé.
 */
export async function ouvreSession(jetonLien){
  if(typeof jetonLien !== 'string' || jetonLien.length < 20) return null;
  const { rows } = await query(
    `update liens set utilise_le = now()
      where jeton = $1 and utilise_le is null and expire_le > now()
    returning email, prenom`,
    [empreinte(jetonLien)]
  );
  if(!rows.length) return null;
  return poseSession(rows[0].email, rows[0].prenom);
}

/**
 * Ouvrir la session sans preuve, quand aucun courrier ne peut partir.
 * L'adresse reste la clé d'identité — c'est elle qui fait que le même agent
 * sur son téléphone et sur son poste est la même personne.
 */
export async function ouvreSessionSansPreuve(email, prenom){
  return poseSession(email, prenom);
}

/** L'adresse est la clé d'identité : deuxième connexion, même personne. */
async function poseSession(email, prenom){
  const { rows: [personne] } = await query(
    `insert into personnes (id, email, prenom) values ($1,$2,$3)
     on conflict (email) do update set prenom = excluded.prenom, vue_le = now()
     returning id`,
    [nouvelId(), email, prenom]
  );
  const jetonSession = nouveauJeton();
  await query(
    `insert into sessions (jeton, personne_id) values ($1,$2)`,
    [empreinte(jetonSession), personne.id]
  );
  return jetonSession;
}

export async function fermeSession(req){
  const jeton = litCookie(req, NOM_COOKIE);
  if(jeton) await query(`delete from sessions where jeton = $1`, [empreinte(jeton)]);
}
