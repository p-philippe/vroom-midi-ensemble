-- Vroom ! — schéma.  À passer une fois sur la base avant le premier déploiement.
--
-- Trois principes, issus du 4.3 et du 1bis.11 de la feuille de route :
--   · une ligne par annonce, une ligne par place prise ;
--   · on ne supprime pas, on marque (statut) ;
--   · un seul trajet par personne et par jour, tenu par la base.

create table if not exists annonces (
  id         text primary key,
  jour       date not null,
  type       text not null check (type in ('offre','demande')),
  statut     text not null default 'ouverte'
             check (statut in ('ouverte','pourvue','annulee')),
  -- identifiant de la personne (table personnes), depuis le 12/09/2026
  personne   text not null,
  prenom     text not null,
  site       text not null,           -- le départ
  arrivee    text not null default 'Rue du parc',
  heure      text not null,           -- 'HH:MM', l'un des créneaux
  places     int  not null default 1 check (places between 1 and 6),
  note       text not null default '',
  cree_le    timestamptz not null default now()
);
create index if not exists annonces_jour_statut on annonces (jour, statut);

create table if not exists passagers (
  id         text primary key,
  annonce_id text not null references annonces(id) on delete cascade,
  jour       date,
  personne   text not null,
  prenom     text not null,
  cree_le    timestamptz not null default now(),
  -- « une personne, une place » : c'est la base qui le tient, pas le client
  unique (annonce_id, personne)
);
create index if not exists passagers_annonce on passagers (annonce_id);

-- Identification sans mot de passe (4.4bis). L'adresse est la clé d'identité ;
-- ni le jeton du lien ni celui de la session ne sont stockés en clair — la
-- base n'en garde que l'empreinte SHA-256.
create table if not exists personnes (
  id      text primary key,
  email   text not null unique,
  prenom  text not null,
  cree_le timestamptz not null default now(),
  vue_le  timestamptz not null default now()
);

create table if not exists liens (
  jeton      text primary key,        -- empreinte, jamais le jeton
  email      text not null,
  prenom     text not null,
  ip         text not null default '',
  cree_le    timestamptz not null default now(),
  expire_le  timestamptz not null,
  utilise_le timestamptz              -- un lien ne sert qu'une fois
);
create index if not exists liens_cadence on liens (email, cree_le);

create table if not exists sessions (
  jeton       text primary key,       -- empreinte, jamais le jeton
  personne_id text not null references personnes(id) on delete cascade,
  cree_le     timestamptz not null default now(),
  vue_le      timestamptz not null default now()
);

-- La règle du 1bis.11. Ces deux index tiennent l'unicité dans chaque table ;
-- l'exclusion entre les deux se joue dans la transaction, sous verrou de la
-- ligne de la personne (cf. verrouillePersonne, lib/db.js).
create unique index if not exists annonces_un_engagement
  on annonces (jour, personne) where statut = 'ouverte';
create unique index if not exists passagers_un_engagement
  on passagers (jour, personne);
