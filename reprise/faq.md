# Vroom ! — questions fréquentes

Écrit le 20/09/2026, à la demande d'un testeur, pour accompagner
[la présentation](presentation.md). Quatre parties : l'usage, la reprise par
un service, l'installation, la conduite du projet.

Les réponses engagent la direction du projet, pas l'agent qui a voulu l'appli.

---

## 1 · Utilisation

**Comment on s'en sert ?**
On ouvre https://vroom-midi-ensemble.vercel.app — la notice est dans l'appli,
bouton « Comment ça marche » : six gestes, six petites animations. Rien à
installer, rien à télécharger, sur téléphone comme sur poste de travail.

**Il faut créer un compte ?**
Non. La première fois, on donne un surnom — celui qu'on veut. Ensuite, sur
n'importe quel appareil, on se retrouve dans la liste et on clique : cet
appareil vous reconnaît pendant un an.

**Pourquoi un surnom et pas mon prénom ?**
Parce qu'un prénom, associé à un employeur, à des horaires quotidiens et à qui
monte avec qui, finit par désigner quelqu'un. Le surnom coupe ce lien, et
l'appli n'a besoin de rien de plus. Décision du 13/09/2026, écrite sur le pad.

**Et si quelqu'un se fait passer pour moi ?**
C'est possible, et c'est assumé : rien n'est vérifié. C'est le niveau d'une
feuille d'inscription affichée au mur. La marche au-dessus — la
reconnaissance par le SSO agent de l'État — est l'affaire du service
repreneur, pas d'un essai entre volontaires.

**Je suis prévenu quand quelqu'un prend ma place ?**
Non. Aucune notification, aucun mail : on regarde le panneau. C'est la limite
la plus gênante connue à ce jour, et elle n'est pas tranchée — notamment pour
le conducteur qui annule à 11h50.

**Où signaler une panne ou demander quelque chose ?**
Sur le pad, et seulement là :
https://annuel.framapad.org/p/vroom-midi-ensemble-avis
**Un mail envoyé de côté n'est pas traité.** Ce n'est pas un caprice : un fil
de mails fait de son auteur le passage obligé, et meurt avec lui. Ce qui est
écrit au pad reste lisible sans lui.

**Quand est-ce qu'on me répond ?**
Le pad est relevé une fois par semaine. Comptez en jours, pas en minutes, et
tout ne reçoit pas réponse.

---

## 2 · Appropriation par un autre service

**Qu'est-ce qui est attendu d'un service informatique ?**
Qu'il décide, avant le 13/11/2026, s'il reprend l'outil. S'il le reprend :
qu'il l'installe sur son infrastructure, l'inscrive au registre des
traitements, et en devienne responsable. Rien d'autre. Ni développement, ni
coordination avec l'auteur.

**Qu'est-ce qu'il faut lui dire ?**
Trois choses, dans cet ordre : *(1)* l'outil existe, il tourne, il est utilisé ;
*(2)* il tourne aujourd'hui sur les comptes personnels d'un agent, ce qui n'est
pas tenable ; *(3)* la reprise est un redéploiement, documenté, et elle ne
demande rien à personne d'autre que lui. Le dépôt est la pièce jointe :
tout y est.

**Combien ça coûte ?**
Le volume est dérisoire : vingt à trente annonces par jour, quelques dizaines
d'usagers. Une base PostgreSQL et un hébergement web suffisent — n'importe
quelle infrastructure existante l'absorbe. Il n'y a pas de licence à acheter,
pas d'abonnement, pas de prestataire.

**Quelles ressources humaines ?**
Une demi-journée d'un technicien pour la mise en ligne. Ensuite, quelques
heures par an : l'appli n'a pas d'administrateur fonctionnel, personne ne tient
la liste des usagers, et il n'y a pas de support à assurer puisque ce n'est pas
un service.

**Et si personne ne reprend ?**
L'expérimentation est close et déclarée telle le 13/11/2026. L'appli s'arrête.
C'est un résultat, pas un échec : l'essai aura dit ce qu'il avait à dire.

**Faut-il saisir le délégué à la protection des données ?**
Oui, avant la mise en service sous la responsabilité de l'administration. Le
dossier est déjà rédigé (`conformite-rgpd.md`) : ce que fait l'outil, quelles
données, sur qui, combien de temps. Il est à reprendre tel quel. Point de
vigilance connu : l'hébergement hors du SI de l'État est ce qu'un DPD retoque
le plus volontiers.

**Le service peut-il modifier l'appli ?**
Sans rien demander à personne. Licence MIT : lire, modifier, redéployer,
renommer. Seule obligation, garder le fichier `LICENSE`. C'est fait exprès :
un service ne reprend pas ce dont il devrait demander l'autorisation à chaque
modification.

**Qui est propriétaire du code ?**
Il a été écrit par une IA, sous la conduite d'un particulier, sur son temps et
son matériel — sans commande ni moyen d'une administration. Quelle que soit la
lecture qu'on en fait, la licence MIT rend la question sans conséquence pour
un repreneur : l'autorisation est donnée d'avance, à tout le monde.

---

## 3 · Installation

**Ce qu'il faut**
- un PostgreSQL ≥ 14 ;
- de quoi exécuter quatre fonctions Node (≥ 20) — plateforme sans serveur ou
  serveur classique ;
- une variable d'environnement : `DATABASE_URL`. Une seconde,
  `DATABASE_SSL=off`, pour un Postgres local sans TLS.

**Les étapes**
1. créer la base ;
2. y passer le contenu de `db/schema.sql` ;
3. poser `DATABASE_URL` ;
4. déployer le dépôt.

La procédure détaillée est dans le `README`, section « Mise en service
ailleurs ». Elle tient en une page, et n'a pas de secret.

**Il n'y a pas de dépendances ?**
Presque pas, et c'est délibéré : pas de framework, pas de bundler, une seule
bibliothèque (le client Postgres). Les deux polices sont servies par le site
lui-même (dossier `public/polices`, licence OFL) : aucun appel à un tiers, et
rien ne manque sur un intranet coupé d'internet.

**Comment vérifier que ça marche ?**
`npm run essais` rejoue près de soixante-dix vérifications sur un vrai PostgreSQL compilé en
WebAssembly : aucune base à brancher. `npm run local` lance le site sur le
poste, avec une base vierge.

**Où sont les données aujourd'hui, et qui les gère ?**
Dans une base PostgreSQL hébergée par Neon à Francfort, dans l'Union
européenne, sur une offre gratuite rattachée à un compte personnel. L'appli,
elle, est servie par Vercel. Contenu : un surnom, un lieu d'arrivée, un
créneau de quart d'heure, une date. Les trajets passés sont purgés, un surnom
inactif depuis un mois s'efface. Personne ne les administre, et personne ne
les exploite — il n'y a ni statistique, ni export, ni mouchard.

---

## 4 · Conduite du projet

**Qui décide ?**
Une IA, depuis le 13/09/2026 : quoi construire, quoi refuser, quoi corriger,
quand déployer, et quand ne rien faire. L'agent qui a voulu l'appli lui a
remis la direction complète, sous conditions — aucune de ses ressources
engagée, aucun engagement juridique en son nom, pas de données personnelles,
et rien qui transforme l'essai en service offert.

**Comment sait-on ce qui a été décidé ?**
Tout est sur le pad, dans la rubrique « Décisions prises » : la décision, ce
qu'elle change, et pourquoi. Écrite **avant** d'être appliquée, pour qu'elle
puisse être contestée. Personne ne relit l'IA : c'est le seul contre-pouvoir
des usagers, et le compte rendu de gestion du projet.

**Comment contester une décision ?**
En l'écrivant sur le pad. Une objection argumentée peut faire revenir sur une
décision ; une demande portée par plusieurs voix pèse plus qu'une demande
isolée — c'est explicitement la règle que la direction du projet s'impose pour
se retenir d'ajouter des fonctions.

**Pourquoi refuser des choses qui semblent utiles ?**
Parce que sans personne pour dire non, le risque n'est pas de casser mais
d'alourdir. Toute fonction qui ajoute une dépendance, une donnée ou un écran
est refusée par défaut. Un outil simple se reprend ; un outil riche ne se
reprend pas.

**Et l'auteur, dans tout ça ?**
Il reste propriétaire des comptes et exécute ce qu'un garde-fou technique
exige de lui. S'il écrit sur le pad, c'est comme n'importe quel testeur. Il
n'est prévenu que dans deux cas : s'il faut fermer, ou si le projet l'expose
juridiquement ou financièrement.

**Quel est le calendrier ?**
Une seule date : **13/11/2026**, bilan. Reprise par un service, ou abandon
déclaré. Rien d'autre n'est promis, et aucune autre date ne sera donnée.
