# Vroom ! — Midi ensemble

Covoiturage du midi entre collègues de la DDTM22 (trajets vers le RIA).
Expérimentation : quand le service fonctionnera, les services informatiques
prendront le relais pour l'installer dans leur dispositif.

## Ce que c'est

- `public/index.html` — l'appli, une page, sans dépendance ni build
- `api/` — trois fonctions Node : annonces, places, demandes
- `lib/db.js` — pool Postgres, validation, requête du panneau
- `db/schema.sql` — le schéma, à passer une fois

Pas de framework, pas de bundler, pas de dépendance propriétaire : une base
Postgres derrière un `DATABASE_URL`. La reprise par la DSI est un
redéploiement, pas une réécriture.

## En ligne

https://vroom-midi-ensemble.vercel.app — Vercel, base Postgres Neon (Francfort,
offre gratuite). Le schéma se crée au premier appel.

## Mise en service ailleurs

1. **Une base Postgres.** Sur Vercel : Storage → Postgres (Neon). Ailleurs :
   n'importe quel Postgres ≥ 14.
2. **Passer le schéma** : le contenu de `db/schema.sql`.
3. **Variables d'environnement** :
   - `DATABASE_URL` — chaîne de connexion (obligatoire)
   - `DATABASE_SSL=off` — seulement pour un Postgres local sans TLS
4. **Déployer** : `vercel` à la racine, ou l'import du dépôt depuis l'interface.

En local : `npm install`, puis `vercel dev`.

## Ce que le serveur garantit

Le volume est dérisoire — vingt à trente annonces par jour. Le risque est la
simultanéité : tout se joue entre 11h55 et 12h05.

- **La capacité est tenue par la base.** Prendre une place verrouille la ligne
  de l'annonce (`select … for update`), compte les passagers et insère dans la
  même transaction. Deux personnes ne peuvent pas prendre la même dernière
  place.
- **Une personne, une place** : contrainte d'unicité `(annonce_id, personne)`.
- **Une demande ne se pourvoit qu'une fois** :
  `update … where statut='ouverte'`. Zéro ligne modifiée = quelqu'un a été plus
  rapide, et le client le dit.
- **On ne supprime pas, on marque** : `ouverte` / `pourvue` / `annulee`.

Côté écran, toute action peut échouer parce qu'un autre a été plus rapide. Le
bouton attend la réponse, et l'échec repropose au lieu de bloquer : « la
dernière place vient d'être prise par Léa. Il reste 2 trajets à ria1. »

## Faille connue, non corrigée

L'API renvoie le jeton `personne` de chaque annonce dans le panneau public.
Ce jeton sert à la fois d'identité et de preuve : qui le lit peut retirer
l'annonce d'un autre ou le désinscrire d'un trajet. À corriger avant d'ouvrir
au-delà d'un petit groupe : le client doit envoyer son jeton en en-tête sur le
GET, et le serveur ne renvoyer que `mienne` / `a_bord`.

## Limites connues

- **Identité provisoire.** Un jeton par navigateur, en attendant l'annuaire
  DDTM22 (4.4 de la feuille de route). Conséquence : le même agent sur son
  téléphone et sur son poste compte pour deux, et ne peut pas retirer depuis
  l'un ce qu'il a publié depuis l'autre.

- **Départs par quart d'heure**, de 12:00 à 13:00 inclus. Pour changer la
  grille : `CRENEAUX` dans `lib/db.js` **et** dans `public/index.html`, plus
  les `<option>` des deux formulaires.
- **Pas de notification.** Un conducteur qui annule ne peut pas prévenir ses
  passagers autrement qu'en retirant l'annonce du panneau (1bis.5, non tranché).
- **Aller simple.** Le retour du RIA n'est pas modélisé, par décision : il
  s'organise sur place.
