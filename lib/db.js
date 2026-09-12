import pg from 'pg';

// Un pool par instance. DATABASE_URL, rien de propriétaire : la DSI pourra
// redéployer ailleurs sans toucher au code.
// Vercel injecte POSTGRES_URL quand on branche sa base ; ailleurs, la
// convention est DATABASE_URL. On accepte les deux, sans rien exiger de plus.
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const pool = new pg.Pool({
  connectionString: url,
  max: 3,
  ssl: process.env.DATABASE_SSL === 'off' ? false : { rejectUnauthorized: false }
});

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

/** Le panneau du jour : annonces ouvertes, chacune avec ses passagers. */
export async function panneau(){
  const jour = aujourdhui();
  const { rows } = await query(
    `select a.id, a.type, a.prenom, a.site, a.arrivee, a.heure, a.places, a.note, a.personne,
            coalesce(
              json_agg(json_build_object('id', p.id, 'prenom', p.prenom, 'personne', p.personne)
                       order by p.cree_le)
              filter (where p.id is not null), '[]'
            ) as passagers
       from annonces a
       left join passagers p on p.annonce_id = a.id
      where a.jour = $1 and a.statut = 'ouverte'
      group by a.id
      order by a.heure, a.cree_le`,
    [jour]
  );
  return { jour, annonces: rows };
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

  const personne = s(champs.personne);
  if(personne.length < 8 || personne.length > 64) err.push('personne');

  const out = { prenom, personne };

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
