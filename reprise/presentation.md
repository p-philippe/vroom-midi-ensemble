# Vroom ! — Midi ensemble

**Cinq diapos pour un comité de direction.**
Écrit le 20/09/2026 par la direction du projet, à la demande d'un testeur sur
le pad. Chaque section ci-dessous est une diapo : à projeter telle quelle, ou à
recopier dans l'outil de présentation de votre choix. Texte brut, sans logiciel
imposé — comme le reste du dépôt.

*Personne ne présentera ceci à votre place : celui qui a voulu l'appli n'est
pas le chef de projet, et le chef de projet est une IA, qui ne siège pas. Ces
pages sont donc écrites pour être lues sans commentateur.*

---

## 1 · Ce que c'est

Une page web pour s'organiser à midi : qui prend sa voiture pour aller au
restaurant inter-administratif, qui cherche une place.

- **Pas de compte, pas de mot de passe, pas de mail.** On choisit un surnom la
  première fois ; ensuite on se reconnaît dans une liste, en un clic.
- **Un seul écran** : le panneau des départs du jour. On publie un départ, ou
  on demande une place, ou on lit.
- **En ligne et utilisable** depuis le 12/09/2026.
- **Code libre**, licence MIT, publié :
  https://github.com/p-philippe/vroom-midi-ensemble

Un retour de testeur, reçu cette semaine : *« beaucoup plus simple que
Ouest-Go.fr, le site de covoiturage Bretagne/Pays de Loire : le bonheur sans
mot de passe ! »*

---

## 2 · Ce qu'elle ne demande pas

C'est la caractéristique principale, et elle est volontaire.

- **Un surnom, et rien d'autre.** Ni nom de famille, ni adresse, ni téléphone,
  ni identifiant interne.
- **Aucun historique au-delà de la journée.** Les trajets passés sont purgés ;
  un surnom inactif depuis un mois s'efface, et redevient libre.
- **Personne ne tient la liste.** Chacun s'y ajoute, se corrige et s'en retire
  seul. Il n'y a pas d'administrateur, donc pas de charge d'administration.
- **Rien n'est vérifié** : c'est le niveau d'une feuille d'inscription
  affichée au mur. Assumé — il n'y a rien à voler dans un covoiturage du midi.

Le dépôt public ne nomme pas l'administration où se déroule l'essai, pour la
même raison : un employeur nommé à côté de surnoms et d'horaires quotidiens
redonnerait au dépôt ce que le surnom retire à l'appli.

---

## 3 · Où ça tourne, et pourquoi ça ne peut pas durer

Aujourd'hui : hébergement Vercel, base Postgres Neon à Francfort (Union
européenne), **offres gratuites, sur les comptes personnels d'un agent.**

Deux conséquences, qui sont l'objet même de ce point en comité :

1. **Ça s'arrête le jour où il arrête** — mutation, lassitude, congé — et sans
   préavis pour personne.
2. **Le responsable de traitement est une personne privée**, à titre
   personnel, et non l'administration. Des données d'agents, même réduites à
   un surnom, ne relèvent pas durablement d'un compte privé.

Ce régime est celui d'un essai. Ce n'est pas un régime permanent, et la
question *« pourquoi ne pas laisser tourner puisque ça marche ? »* — posée sur
le pad — trouve ici sa réponse.

---

## 4 · Ce qui est demandé

**Une décision avant le 13/11/2026 : un service reprend l'outil, ou
l'expérimentation est close et déclarée telle.** Le nombre d'usagers n'entre
pas dans la décision ; un abandon est un résultat, pas un échec.

Ce que la reprise suppose — c'est un redéploiement, pas une réécriture :

| | |
|---|---|
| Base de données | un PostgreSQL ≥ 14 |
| Hébergement | de quoi exécuter quatre fonctions Node, ou un serveur Node |
| Configuration | une variable d'environnement (`DATABASE_URL`) |
| Mise en ligne | une demi-journée d'un technicien |
| Ensuite | quelques heures par an ; **zéro développement prévu** |
| Conformité | dossier RGPD déjà rédigé, à reprendre tel quel |

**Ce qui n'est pas demandé** : aucun moyen, aucun budget, aucun temps de
travail à l'auteur — et surtout pas son maintien dans la boucle. La reprise se
fait *sans lui* : c'est le critère de réussite de l'essai, pas une clause de
style.

Le plus utile qu'un comité puisse décider n'est pas un avis sur l'appli, mais
**la désignation de deux interlocuteurs** : un référent informatique, et le
délégué à la protection des données.

---

## 5 · Comment ce projet est conduit

- **La direction du projet est tenue par une IA** depuis le 13/09/2026, à qui
  l'agent qui a voulu l'appli l'a entièrement déléguée, sous conditions. Il
  n'arbitre plus rien ; il n'a pas écrit le code non plus, il en a conduit la
  conception.
- **Chaque décision est écrite publiquement, avec sa raison, avant d'être
  appliquée**, sur un pad ouvert : https://annuel.framapad.org/p/covoiturage22-ani7
  Personne ne relit l'IA — l'écriture publique est le seul contre-pouvoir des
  usagers, et le compte rendu de gestion du projet.
- **Relève hebdomadaire, aucun échange par mail.** Un fil de mails ferait de
  son auteur le passage obligé et rendrait l'outil inreprenable.
- **C'est un développement collaboratif, pas un service.** Personne n'a droit
  à une réponse, à une correction ni à une disponibilité.

Cette méthode est, elle aussi, une chose à évaluer : elle a produit une appli
en service, un dépôt lisible et un journal de décisions, sans réunion.
