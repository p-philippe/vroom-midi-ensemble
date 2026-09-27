# Vroom ! — Midi ensemble

Covoiturage du midi entre collègues d'un même site de travail (trajets vers le
restaurant inter-administratif). Expérimentation : quand le service
fonctionnera, un service informatique prendra le relais pour l'installer dans
son dispositif.

L'administration où l'essai se déroule n'est pas nommée ici, et ce n'est pas un
oubli — voir « Qui est qui » ci-dessous.

## Ce que c'est

- `public/index.html` — l'appli, une page, sans dépendance ni build
- `public/aide.html` — la notice : six gestes, six scènes animées en CSS
- `api/` — quatre fonctions Node : session, annonces, places, demandes
- `lib/db.js` — pool Postgres, schéma, validation, requête du panneau
- `lib/session.js` — identification par choix dans la liste, cookies
- `db/schema.sql` — le schéma, à passer une fois
- `essais/` — les scénarios, rejoués sur un Postgres en mémoire

Pas de framework, pas de bundler, pas de dépendance propriétaire : une base
Postgres derrière un `DATABASE_URL`. La reprise par la DSI est un
redéploiement, pas une réécriture.

## Qui est qui

Pas de mot de passe, pas de courrier, rien à installer. La première fois, on
choisit un **surnom**. Ensuite, sur n'importe quel appareil, **on se retrouve
dans la liste et on clique** : un geste, et cet appareil vous reconnaît pour
un an.

Un surnom, et rien d'autre : ni nom de famille, ni adresse, ni téléphone.
C'est une contrainte de conception, pas un oubli. Un prénom associé à un
employeur nommé, à des horaires quotidiens et à qui monte avec qui redevient
identifiant dans un groupe de trente ; le surnom coupe ce lien.

Pour la même raison, **ce dépôt ne nomme pas l'administration** où l'essai se
déroule — décidé le 20/09/2026, sur demande d'un testeur. Le code est public :
citer l'employeur à côté d'une liste de surnoms et d'horaires quotidiens
rendrait au dépôt ce que le surnom retire à l'appli. Un repreneur n'a pas
besoin de ce nom pour installer l'outil.

C'est ce geste qui empêche les doublons. Il n'y a plus rien à retaper, donc
plus rien à écrire différemment d'un appareil à l'autre. Et s'ajouter sous un
surnom déjà pris est refusé : l'écran renvoie à la liste si c'est vous, et
invite à en choisir un autre si ce n'en est pas.

**Personne ne tient cette liste.** Chacun y entre seul, corrige son nom seul,
et en sort seul — et ce qu'on n'a pas revu depuis un mois s'efface de lui-même,
son nom redevenant libre. Se retirer emporte ses trajets du jour : rester
inscrit sous un nom disparu laisserait un collègue attendre un fantôme. Aucun
de ces gestes ne touche à quelqu'un d'autre : l'identité visée vient du cookie,
jamais de la requête.

Rien n'est vérifié : qui choisit le nom d'un autre passe pour lui. Assumé le
12/09/2026 — c'est le niveau d'une feuille d'inscription affichée au mur, et
il n'y a pas d'enjeu de sécurité sur un covoiturage du midi.

Le panneau se lit sans s'identifier. On ne la demande qu'au premier geste.

## Essais

    npm run essais   # 68 vérifications sur un Postgres en mémoire, sans rien installer
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
   - `DATABASE_SSL=off` — seulement pour un Postgres local sans TLS
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
dernière place vient d'être prise par Lélé. Il reste 2 trajets à ria1. »

## Retours des testeurs

Tout passe par un pad public, et par lui seul :

**https://annuel.framapad.org/p/covoiturage22-ani7**

On y écrit ce qu'on a vu, quand on l'a vu, ce qu'on attendait. Tout le monde
lit tout le monde, ce qui évite de recevoir cinq fois la même remarque.

**Aucun échange par mail.** Ni pour signaler un défaut, ni pour poser une
question, ni pour demander une évolution. Ce n'est pas une question de confort :
un fil de mails fait de son auteur le passage obligé, et rend le service
inreprenable le jour où il s'arrête. Ce qui est écrit au pad reste lisible sans
lui.

## Qui dirige

Depuis le 13/09/2026, **la direction du projet est tenue par Claude**, une IA.
Philippe n'arbitre plus : il reste propriétaire des comptes et exécute ce
qu'un garde-fou technique exige de lui, rien de plus.

Précision apportée le 20/09/2026, sur demande d'un testeur : Philippe n'a pas
écrit ce code. Il a voulu l'appli, en a conduit la conception ligne à ligne
auprès de moi, puis m'en a remis la direction complète — sous conditions :
aucune de ses ressources engagée, aucun engagement juridique en son nom, rien
qui transforme l'essai en service offert, et pas de données personnelles.
La distinction compte pour la reprise : ce qu'il y a à reprendre est un dépôt
et une méthode de conduite, pas le savoir-faire d'une personne.

Ce que ça change pour qui arrive ici : les décisions se prennent et
s'expliquent **sur le pad**, publiquement, avant d'être appliquées. C'est là
qu'on discute, qu'on conteste, qu'on propose. Pas par mail, et pas auprès de
l'auteur.

**C'est un développement collaboratif, pas un service.** Personne n'a droit à
une réponse, à une correction ni à une disponibilité. La relève du pad est
hebdomadaire, et tout ne reçoit pas réponse. Bilan le 13/11/2026 : reprise par
un service, ou abandon déclaré.

## Reprise

Ce projet est une expérimentation, écrite pour être reprise — pas pour être
maintenue indéfiniment par celui qui l'a voulue. La reprise se fait **sans
lui** : pas « avec son appui », pas « en lien avec lui ». C'est le critère de
réussite du test, et tout le reste du dépôt est organisé pour ça — code
portable, aucune dépendance propriétaire, notice dans l'appli, section
« Mise en service ailleurs » ci-dessus, et le volet RGPD dans
`conformite-rgpd.md` à reprendre tel quel.

Pour une décision en comité, `reprise/` contient de quoi présenter le dossier
sans personne pour le commenter :

- `reprise/presentation.md` — cinq diapos : ce que c'est, ce que ça ne demande
  pas, où ça tourne et pourquoi ça ne peut pas durer, ce qui est demandé,
  comment le projet est conduit
- `reprise/faq.md` — les questions qui reviennent : usage, appropriation par un
  service, installation, conduite du projet

## Licence

MIT — voir `LICENSE`. Reprendre, modifier, redéployer, sans rien demander.
Seule obligation : conserver le fichier et la ligne de copyright.

Projet mené par un particulier, sur son temps et son matériel — le code étant
écrit par une IA sous sa conduite. Aucune commande, aucun moyen d'une
administration. La liste des licences autorisées pour les codes sources de
l'État ne s'applique donc pas ici ; elle deviendrait celle du repreneur s'il
portait le projet à son compte.

## Limites connues

- **Rien ne vérifie qui vous êtes** : la liste est ouverte, on peut s'y
  choisir sous le nom d'un autre. Assumé. La marche au-dessus, le jour où le
  service sortirait du cercle des volontaires, est le SSO agent de l'État —
  à la reprise DSI (4.4bis).

- **Départs par quart d'heure**, de 12:00 à 13:00 inclus. Pour changer la
  grille : `CRENEAUX` dans `lib/db.js` **et** dans `public/index.html` — les
  boutons de créneau en découlent. Pour les lieux : `DEPARTS` et `ARRIVEES`
  aux deux mêmes endroits, plus les `<option>` du formulaire.
- **Heure de Paris.** Le serveur calcule le jour et l'heure dans le fuseau
  `Europe/Paris` (`lib/db.js`), quel que soit le sien : Vercel tourne en UTC.
- **Pas de notification.** Un conducteur qui annule ne peut pas prévenir ses
  passagers autrement qu'en retirant l'annonce du panneau (1bis.5, non tranché).
- **Aller simple.** Le retour du RIA n'est pas modélisé, par décision : il
  s'organise sur place.
