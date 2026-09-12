import pg from 'pg';

// Un pool par instance. DATABASE_URL, rien de propriétaire : la DSI pourra
// redéployer ailleurs sans toucher au code.
// Vercel injecte POSTGRES_URL quand on branche sa base ; ailleurs, la
// convention est DATABASE_URL. On accepte les deux, sans rien exiger de plus.
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let pool = new pg.Pool({
  connectionString: url,
  max: 3,
  ssl: process.env.DATABASE_SSL === 'off' ? false : { rejectUnauthorized: false }
});

/* Réservé aux essais : y brancher un Postgres en mémoire pour rejouer les
   scénarios sans base sous la main (`essais/scenarios.js`). Le code de
   production n'appelle jamais ceci. */
export function __brancheBase(autre){ pool = autre; schemaPret = null; }

/* Le schéma est posé au premier appel, une fois par instance. Pratique pour
   une expérimentation ; la DSI voudra sans doute une vraie migration. */
const SCHEMA = `
create table if not exists annonces (
  id text primary key,
  jour date not null,
  type text not null check (type in ('offre','demande')),
  statut text not null default 'ouverte'
         check (statut in ('ouverte','pourvue','annulee')),
  personne text not null,
  prenom text not null,
  site text not null,
  heure text not null,
  places int not null default 1 check (places between 1 and 6),
  note text not null default '',
  cree_le timestamptz not null default now()
);
-- « site » est le départ ; l'arrivée est venue après, d'où l'ajout séparé.
alter table annonces add column if not exists arrivee text not null default 'ria1';
create index if not exists annonces_jour_statut on annonces (jour, statut);
create table if not exists passagers (
  id text primary key,
  annonce_id text not null references annonces(id) on delete cascade,
  personne text not null,
  prenom text not null,
  cree_le timestamptz not null default now(),
  unique (annonce_id, personne)
);
create index if not exists passagers_annonce on passagers (annonce_id);

-- Identification sans mot de passe (4.4bis). Le nom est la clé d'identité :
-- on se choisit dans la liste des gens déjà connus, et c'est ce choix qui
-- empêche les doublons. Le jeton de session n'est stocké qu'en empreinte.
create table if not exists personnes (
  id text primary key,
  email text,
  prenom text not null,
  cree_le timestamptz not null default now(),
  vue_le timestamptz not null default now()
);
alter table personnes alter column email drop not null;
alter table personnes add column if not exists nom text;
update personnes set nom = prenom where nom is null;
-- Deux fois le même nom, c'est le doublon qu'on cherche à éviter.
create unique index if not exists personnes_nom on personnes (lower(nom));
-- Le lien magique par courrier a été écarté le 12/09/2026 : personne ne doit
-- avoir à distribuer des accès, et il n'y a pas d'enjeu de sécurité ici.
drop table if exists liens;
create table if not exists sessions (
  jeton text primary key,
  personne_id text not null references personnes(id) on delete cascade,
  cree_le timestamptz not null default now(),
  vue_le timestamptz not null default now()
);

-- Reprise de l'existant : les annonces attachées à un jeton de navigateur
-- n'ont plus d'identité connue. Elles se ferment, le test repart à zéro
-- (4.4bis). Passé la migration, ces deux requêtes ne touchent plus rien.
delete from passagers where personne not in (select id from personnes);
update annonces set statut='annulee'
 where statut='ouverte' and personne not in (select id from personnes);

-- « Un seul trajet par personne et par jour » (1bis.11). Deux index partiels
-- le tiennent dans chaque table ; l'exclusion entre les deux se joue dans la
-- transaction, sous verrou de la ligne de la personne.
alter table passagers add column if not exists jour date;
update passagers p set jour = a.jour from annonces a
 where a.id = p.annonce_id and p.jour is null;
create unique index if not exists annonces_un_engagement
  on annonces (jour, personne) where statut = 'ouverte';
create unique index if not exists passagers_un_engagement
  on passagers (jour, personne);
`;

let schemaPret = null;
function assureSchema(){
  if(!schemaPret) schemaPret = poserSchema().catch(e => { schemaPret = null; throw e; });
  return schemaPret;
}

/* Deux instances qui démarrent en même temps lancent le même
   « create table if not exists » : Postgres lève alors une erreur de doublon,
   et l'utilisateur reçoit un 500 au pire moment. Observé en production le
   08/09/2026, au premier appel concurrent. Un verrou consultatif les met en
   file d'attente. */
const VERROU_SCHEMA = 776699;
async function poserSchema(){
  const client = await pool.connect();
  try{
    await client.query('select pg_advisory_lock($1)', [VERROU_SCHEMA]);
    await client.query(SCHEMA);
  }finally{
    try{ await client.query('select pg_advisory_unlock($1)', [VERROU_SCHEMA]); }catch{}
    client.release();
  }
}

export function configManquante(){ return !url; }

export async function query(text, params){
  await assureSchema();
  return pool.query(text, params);
}

/** Ouvre une transaction, la valide, ou la défait si le corps échoue. */
export async function transaction(fn){
  await assureSchema();
  const client = await pool.connect();
  try{
    await client.query('begin');
    const out = await fn(client);
    await client.query('commit');
    return out;
  }catch(e){
    try{ await client.query('rollback'); }catch{}
    throw e;
  }finally{
    client.release();
  }
}

// Deux départs, trois RIA à l'arrivée. Les libellés sont stockés tels quels :
// cinq valeurs, pas de table de correspondance à maintenir.
export const DEPARTS = ['Vallès','Fréhel'];
export const ARRIVEES = ['Rue du parc','Ploufragan','Impôts'];

// Départs par quart d'heure, de 12h à 13h inclus. Aller simple : le retour
// n'est pas modélisé (décision du 08/09/2026, cf. 1bis.4).
export const CRENEAUX = ['12:00','12:15','12:30','12:45','13:00'];

/**
 * Le panneau du jour : annonces ouvertes, chacune avec ses passagers.
 *
 * Aucun identifiant ne sort d'ici — ni celui de l'annonce, ni celui des
 * passagers. Le serveur répond « cette ligne est la vôtre », « vous êtes à
 * bord », et c'est tout. C'est le correctif de la faille relevée en
 * production le 08/09/2026 : le jeton servait à la fois d'identité et de
 * preuve, et il s'affichait dans le panneau public.
 *
 * @param {string|null} moi identifiant de la personne connectée, s'il y en a une
 */
export async function panneau(moi){
  const jour = aujourdhui();
  const { rows } = await query(
    `select a.id, a.type, a.prenom, a.site, a.arrivee, a.heure, a.places, a.note,
            (a.personne = $2) as mienne,
            coalesce(bool_or(p.personne = $2), false) as a_bord,
            coalesce(
              json_agg(json_build_object('prenom', p.prenom, 'moi', p.personne = $2)
                       order by p.cree_le)
              filter (where p.id is not null), '[]'
            ) as passagers
       from annonces a
       left join passagers p on p.annonce_id = a.id
      where a.jour = $1 and a.statut = 'ouverte'
      group by a.id
      order by a.heure, a.cree_le`,
    [jour, moi || '']
  );
  return { jour, annonces: rows };
}

/**
 * La règle d'exclusion du 1bis.11 : un usager fait un trajet, et un seul —
 * conducteur ou passager, jamais les deux, jamais plusieurs fois.
 *
 * Les index partiels tiennent l'unicité dans chaque table ; ils ne peuvent
 * pas la tenir entre les deux. D'où ce verrou sur la ligne de la personne,
 * posé au début de toute transaction qui l'engage : deux clics simultanés du
 * même agent s'exécutent l'un après l'autre, et le second voit le premier.
 * Chacun ne verrouille que sa propre ligne — aucune contention entre agents.
 */
export async function verrouillePersonne(cx, id){
  await cx.query(`select id from personnes where id = $1 for update`, [id]);
}

/**
 * L'engagement ferme du jour, s'il y en a un : conduire, ou avoir une place.
 *
 * Une demande n'en est pas un. Chercher une place est un souhait, pas un
 * trajet — la compter ici interdirait à quelqu'un de prendre la place qu'il
 * cherche, et les enchaînements du 1bis.6 à 1bis.8 tomberaient. Une demande
 * se ferme d'elle-même quand elle aboutit, dans la même transaction.
 */
export async function engagement(cx, id, jour){
  const { rows } = await cx.query(
    `select 'conduit' as quoi, heure
       from annonces
      where jour=$1 and personne=$2 and statut='ouverte' and type='offre'
     union all
     select 'monte', a.heure
       from passagers p join annonces a on a.id = p.annonce_id
      where p.jour=$1 and p.personne=$2 and a.statut='ouverte'
     limit 1`,
    [jour, id]
  );
  return rows[0] || null;
}

/** Ma demande n'a plus d'objet : je viens de trouver, ou de me proposer. */
export async function clotDemande(cx, id, jour){
  await cx.query(
    `update annonces set statut='pourvue'
      where jour=$1 and personne=$2 and type='demande' and statut='ouverte'`,
    [jour, id]
  );
}

export function nouvelId(){
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

export function aujourdhui(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/** Validation côté serveur : le client n'est jamais cru sur parole. */
export function valide(champs){
  const err = [];
  const s = v => typeof v === 'string' ? v.trim() : '';

  const prenom = s(champs.prenom);
  if(prenom.length < 1 || prenom.length > 30) err.push('prenom');

  const out = { prenom };

  if('site' in champs){
    if(!DEPARTS.includes(champs.site)) err.push('site');
    else out.site = champs.site;
  }
  if('arrivee' in champs){
    if(!ARRIVEES.includes(champs.arrivee)) err.push('arrivee');
    else out.arrivee = champs.arrivee;
  }
  if('heure' in champs){
    if(!CRENEAUX.includes(s(champs.heure))) err.push('heure');
    else out.heure = s(champs.heure);
  }
  if('places' in champs){
    const n = Number.parseInt(champs.places, 10);
    if(!Number.isInteger(n) || n < 1 || n > 6) err.push('places');
    else out.places = n;
  }
  if('note' in champs){
    const note = s(champs.note);
    if(note.length > 60) err.push('note');
    else out.note = note;
  }
  if('type' in champs){
    if(champs.type !== 'offre' && champs.type !== 'demande') err.push('type');
    else out.type = champs.type;
  }
  return { ok: err.length === 0, err, out };
}

export function json(res, code, corps){
  res.status(code).setHeader('content-type','application/json; charset=utf-8');
  res.end(JSON.stringify(corps));
}
