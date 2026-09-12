-- Vroom ! — schéma.  À passer une fois sur la base avant le premier déploiement.
--
-- Deux principes, issus du 4.3 de la feuille de route :
--   · une ligne par annonce, une ligne par place prise ;
--   · on ne supprime pas, on marque (statut).

create table if not exists annonces (
  id         text primary key,
  jour       date not null,
  type       text not null check (type in ('offre','demande')),
  statut     text not null default 'ouverte'
             check (statut in ('ouverte','pourvue','annulee')),
  -- identifiant du navigateur, en attendant l'annuaire DDTM22 (lot 4.4)
  personne   text not null,
  prenom     text not null,
  site       text not null,
  heure      text not null,           -- 'HH:MM'
  places     int  not null default 1 check (places between 1 and 6),
  note       text not null default '',
  cree_le    timestamptz not null default now()
);
create index if not exists annonces_jour_statut on annonces (jour, statut);

create table if not exists passagers (
  id         text primary key,
  annonce_id text not null references annonces(id) on delete cascade,
  personne   text not null,
  prenom     text not null,
  cree_le    timestamptz not null default now(),
  -- « une personne, une place » : c'est la base qui le tient, pas le client
  unique (annonce_id, personne)
);
create index if not exists passagers_annonce on passagers (annonce_id);
