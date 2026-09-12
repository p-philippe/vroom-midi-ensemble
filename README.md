# Vroom ! — Midi ensemble

Covoiturage du midi entre collègues de la DDTM22 (trajets vers le RIA).
Expérimentation : quand le service fonctionnera, les services informatiques
prendront le relais pour l'installer dans leur dispositif.

## Ce que c'est

- `public/index.html` — l'appli, une page, sans dépendance ni build
- `api/` — quatre fonctions Node : session, annonces, places, demandes
- `lib/db.js` — pool Postgres, schéma, validation, requête du panneau
- `lib/session.js` — identification par lien magique, cookies, envoi du courrier
- `db/schema.sql` — le schéma, à passer une fois
- `essais/` — les scénarios, rejoués sur un Postgres en mémoire

Pas de framework, pas de bundler, pas de dépendance propriétaire : une base
Postgres derrière un `DATABASE_URL`, un relais de courrier derrière un
`SMTP_URL`. La reprise par la DSI est un redéploiement, pas une réécriture.

## Qui est qui

Pas de mot de passe. L'agent donne l'adresse qu'il veut — professionnelle ou
personnelle —, reçoit un lien, clique une fois : cet appareil le reconnaît
ensuite pour un an. Le même agent sur son téléphone et sur son poste est la
même personne, et retrouve ses annonces des deux côtés.

Ce que ça garantit est la **continuité**, pas la qualité d'agent : le domaine
de l'adresse n'est pas contrôlé, par décision du 12/09/2026. Pour un
covoiturage entre collègues qui se connaissent, le contrôle d'appartenance se
fait sur le parking.

Le panneau se lit sans s'identifier. On ne la demande qu'au premier geste.

## Essais

    npm run essais   # 35 scénarios sur un Postgres en mémoire, sans rien installer
    npm run local    # le site sur http://localhost:3000, base vierge à chaque fois

`essais/` s'appuie sur PGlite, un vrai Postgres compilé en WebAssembly : mêmes
contraintes, mêmes messages d'erreur, aucune base à brancher. Ce qui s'y
vérifie, c'est la règle — qui gagne, qui est refusé, avec quel message. La
simultanéité vraie, elle, a été éprouvée contre Neon (4.3 de la feuille de
route).

## En ligne

https://vroom-midi-ensemble.vercel.app — Vercel, base Postgres Neon (Francfort,
offre gratuite). Le schéma se crée au premier appel.

## Mise en service ailleurs

1. **Une base Postgres.** Sur Vercel : Storage → Postgres (Neon). Ailleurs :
   n'importe quel Postgres ≥ 14.
2. **Passer le schéma** : le contenu de `db/schema.sql`.
3. **Variables d'environnement** :
   - `DATABASE_URL` — chaîne de connexion (obligatoire)
   - `SITE_URL` — l'adresse publique du site, `https://…`, **sans barre
     finale**. À poser en production : à défaut, l'adresse du lien est déduite
     de l'en-tête `Host`, que l'appelant contrôle, et un lien demandé pour
     l'adresse d'un collègue pourrait pointer ailleurs
   - `SMTP_URL` — le relais de courrier, `smtp://utilisateur:motdepasse@hôte:587`.
     Absent, le lien part dans le journal du serveur et se distribue à la main
   - `SMTP_FROM` — l'expéditeur affiché, ex. `Vroom ! <vroom@exemple.fr>`
   - `DATABASE_SSL=off` — seulement pour un Postgres local sans TLS
   - `LIENS_EN_CLAIR=on` — **développement local uniquement**. Renvoie le lien
     au client au lieu de l'envoyer : sur un site ouvert, ce réglage laisse
     n'importe qui se connecter sous n'importe quelle adresse
4. **Déployer** : `vercel` à la racine, ou l'import du dépôt depuis l'interface.

En local : `npm install`, puis `npm run local` — ou `vercel dev` si vous avez
une base sous la main.

## Ce que le serveur garantit

Le volume est dérisoire — vingt à trente annonces par jour. Le risque est la
simultanéité : tout se joue entre 11h55 et 12h05.

- **La capacité est tenue par la base.** Prendre une place verrouille la ligne
  de l'annonce (`select … for update`), compte les passagers et insère dans la
  même transaction. Deux personnes ne peuvent pas prendre la même dernière
  place.
- **Une personne, une place** : contrainte d'unicité `(annonce_id, personne)`.
- **Un seul trajet par personne et par jour** : conducteur ou passager, jamais
  les deux. Deux index partiels le tiennent dans chaque table ; l'exclusion
  entre les deux se joue sous verrou de la ligne de la personne, si bien que
  deux clics simultanés du même agent s'exécutent l'un après l'autre. Une
  demande n'est pas un engagement : chercher une place n'empêche pas d'en
  prendre une, et la demande se ferme d'elle-même quand elle aboutit.
- **L'identité vient du cookie, jamais du corps de la requête.** Le client ne
  dit plus qui il est : il le prouve.
- **Une demande ne se pourvoit qu'une fois** :
  `update … where statut='ouverte'`. Zéro ligne modifiée = quelqu'un a été plus
  rapide, et le client le dit.
- **On ne supprime pas, on marque** : `ouverte` / `pourvue` / `annulee`.

Côté écran, toute action peut échouer parce qu'un autre a été plus rapide. Le
bouton attend la réponse, et l'échec repropose au lieu de bloquer : « la
dernière place vient d'être prise par Léa. Il reste 2 trajets à ria1. »

## Limites connues

- **L'appartenance à la maison n'est pas vérifiée.** Toute adresse mail vaut
  identité. Assumé pour un test entre volontaires ; à reprendre par la DSI avec
  le SSO agent de l'État si le service s'élargit (4.4bis).

- **Deux polices chargées depuis Google Fonts** (Public Sans, IBM Plex Mono).
  Sur un intranet coupé d'internet elles ne descendront pas : la pile de repli
  système prend le relais, la mise en page tient, le rendu change un peu. À
  héberger localement le jour où le site passe en interne.

- **Départs par quart d'heure**, de 12:00 à 13:00 inclus. Pour changer la
  grille : `CRENEAUX` dans `lib/db.js` **et** dans `public/index.html`, plus
  les `<option>` des deux formulaires.
- **Pas de notification.** Un conducteur qui annule ne peut pas prévenir ses
  passagers autrement qu'en retirant l'annonce du panneau (1bis.5, non tranché).
- **Aller simple.** Le retour du RIA n'est pas modélisé, par décision : il
  s'organise sur place.
