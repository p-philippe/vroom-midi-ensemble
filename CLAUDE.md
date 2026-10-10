# Vroom ! — consignes pour Claude

Contexte et direction : `feuille-de-route.md` et `README.md`.

## Commandes

- `npm run essais` : scénarios sur Postgres en mémoire (PGlite). À lancer avant tout commit touchant `api/`, `lib/` ou `db/`.
- `npm run local` : serveur local, port 3000.
- Déploiement : `vercel --prod`, uniquement sur demande explicite.

## Règles

- IMPORTANT : jamais « corrigé / déployé / ça marche / vérifié » sans avoir invoqué le skill `verifier-avant-affirmer` et obtenu une preuve réelle dans le même message.
- Pas de framework, de bundler ni de dépendance propriétaire : Postgres via `DATABASE_URL` (la reprise par la DSI est un redéploiement).
- Données personnelles : un surnom, rien d'autre (ni nom, ni adresse, ni téléphone).
- Ne jamais nommer l'administration d'accueil dans le dépôt (code, commits, docs) : décision du 20/09/2026.
- Le dépôt est public : aucun secret, aucune variable d'environnement dans les commits.

<!-- Maintenance : ajouter une ligne seulement quand Claude a commis l'erreur. Supprimer toute ligne que Claude respecte sans elle. Cible < 200 lignes. Blocages stricts (.env, push, deploy) : .claude/settings.json, pas ici. -->
