# Vroom ! — Feuille de route

« Midi ensemble » — covoiturage entre collègues de la DDTM22.

Pensée simple, accessible, fluide, souple : écran unique, web app légère (KISS/YAGNI).

Dernière mise à jour : 12/09/2026 — **en ligne**, avec les vrais lieux et
les créneaux, sur
https://vroom-midi-ensemble.vercel.app (Vercel + Postgres Neon, région Francfort).
Le volet RGPD est sorti de ce document : voir `conformite-rgpd.md`.

---

## Constat d'audit (08/09/2026)

Trois choses changent la trajectoire :

1. **Le service n'est pas bouclé.** L'appli affiche des créneaux, elle ne met
   personne en relation. Pas de « je prends ta place », pas de décompte des
   places, pas de contact. C'est un panneau d'affichage. La mise en relation
   était rangée en durcissement (ex-5.2) : c'est en réalité le cœur du service,
   elle passe en lot 1bis, avant tout déploiement.
2. ~~La conformité conditionne l'hébergement.~~ **Caduc au 08/09/2026** :
   décision prise de traiter ce site comme une expérimentation. Quand il
   fonctionnera, les services informatiques prendront le relais pour
   l'installer dans leur dispositif. Le volet RGPD est donc hors sujet ici, et
   `conformite-rgpd.md` est clos.
3. **Le stockage actuel perd des données par conception** (blob unique
   réécrit en entier). Ce n'est pas un défaut de prototype à traîner : c'est une
   exigence d'architecture pour le backend (une ligne par annonce).

---

## Lot 1 · RIA — livré (prototype)
1.1. Toggle propose / cherche
1.2. Panneau du jour, façon panneau de gare
1.3. Un trajet va d'un **départ** vers une **arrivée** — modélisé le 08/09/2026.
     Deux départs (`site1`, `site2`), trois RIA à l'arrivée (`ria1`, `ria2`,
     `ria3`), soit six itinéraires. Le panneau affiche `site1 → ria2`.
     Deux rangées de pastilles, Départ et Arrivée, qui se combinent : on peut
     isoler un itinéraire précis, ou tout voir. Quand un filtre ne laisse rien,
     l'écran vide le dit et invite à élargir plutôt que de rester muet.
     Les suggestions ne proposent un trajet que s'il fait le même itinéraire,
     départ **et** arrivée.
     **Noms réels posés le 08/09/2026** : départs *Vallès* et *Fréhel* ;
     arrivées *Rue du parc*, *Ploufragan*, *Impôts*. Stockés tels quels, sans
     table de correspondance — cinq valeurs ne la justifient pas.
1.4. ~~Limite : stockage sur `window.storage`, API du bac à sable Claude.~~
     Levée le 08/09/2026 : le client parle désormais à une API et à une base
     Postgres. Le test entre collègues devient possible dès qu'une base est
     branchée et le site déployé.

### Défauts relevés à l'audit (à corriger, répartis dans les lots ci-dessous)
- ~~Les deux onglets sont étanches~~ → corrigé au lot 1bis
- ~~`places libres` est décoratif~~ → corrigé au lot 1bis
- Le trajet RIA est un aller-retour ; l'appli ne modélise qu'un départ → lot 1bis
- Écrasement concurrent : deux publications dans le même intervalle de 15 s et
  l'une des deux disparaît → lot 4
- ~~Une erreur de lecture vide l'écran~~ → corrigé côté client au lot 1bis ;
  reste à tenir côté serveur → lot 4
- Rien ne purge réellement les clés des jours passés → lot 4
- Identité en saisie libre : aucune unicité, on peut publier sous le nom d'un
  autre ; « mes annonces » sont liées au navigateur, donc on ne peut pas
  supprimer depuis son téléphone une annonce publiée depuis son poste → 4.4
- Pas de modification d'une annonce, seulement suppression puis republication → lot 5.1
- Accessibilité : onglets et chips sans état ARIA, feuille modale sans
  `role="dialog"` ni piège de focus ni fermeture par Échap, erreurs signalées
  par la seule couleur de bordure, croix de suppression sous 44 px, panneau
  rafraîchi sans `aria-live`, `.row.past` à opacity .45 sous le seuil de
  contraste → lot 6
- ~~Police `Archivo` déclarée mais jamais chargée~~ → retirée au lot 1bis

## Lot 1bis · Boucler le service — mise en relation
*Livré le 08/09/2026, sauf 1bis.4 et 1bis.5. Les deux sens du service
fonctionnent : on peut prendre une place, et on peut répondre à une demande.*

1bis.1. ✅ Action « Je monte » sur une offre, et « Je me désiste » pour revenir
        en arrière
1bis.2. ✅ Décompte réel des places, annonce marquée « Complet » à zéro place ;
        les prénoms des passagers apparaissent sous l'annonce
1bis.3. ✅ Panneau unique offres + demandes, trié par heure ; le toggle
        propose/cherche est passé dans la feuille de saisie
1bis.4. ✅ **Aller simple, assumé.** Décidé le 08/09/2026 : on ne modélise que
        l'aller. Le retour s'organise sur place. Ferme la question ouverte
        depuis l'audit.
1bis.5. ⬜ Canal de contact après appariement — non tranché. Retenu par défaut
        dans le code : le prénom du passager s'affiche sous l'annonce, et le
        contact se fait de vive voix. Aucune des trois options (nom complet,
        mail Mélanie, rien) n'est fermée par ce choix.

1bis.6. ✅ Une demande devient sans objet dès que son auteur prend une place :
        elle est retirée du panneau, et l'utilisateur en est averti avant de
        confirmer
1bis.7. ✅ Avant de publier une demande, les trajets qui collent (même site, à
        venir, avec de la place) sont proposés dans la feuille de saisie
1bis.8. ✅ « Je l'emmène » sur une demande : le conducteur publie son trajet et
        la personne qui cherchait y est d'emblée à bord ; la demande disparaît

1bis.9. ✅ **Double rôle : conducteur fantôme.** — réglé le 12/09/2026 par la
        règle d'exclusion du 1bis.11, qui en est la forme générale. C'est la
        solution (b) qui l'emporte, sans passer par le 5.1 : au lieu de rendre
        l'annonce modifiable, la base refuse le second engagement et
        l'utilisateur retire le premier. Le garde-fou (c) devient inutile : ce
        n'est plus un avertissement, c'est un refus motivé.
        Constat d'origine : Constaté en production le
        08/09/2026. Le formulaire force un rôle par saisie — le toggle propose
        *ou* cherche — mais rien n'empêche de publier les deux, et rien ne les
        réconcilie ensuite. Vérifié : une personne publie une offre à 12:05,
        puis monte chez quelqu'un d'autre à 12:12. Sa demande est bien fermée
        par le serveur ; **son offre reste affichée**. Elle apparaît comme
        conduisant alors qu'elle est passagère, et un collègue peut compter sur
        une voiture qui ne partira pas.

        Solutions envisagées, par ordre de préférence :
        a. **Case « j'ai une voiture, mais je préfère monter »** sur une
           demande. Le problème de fond est social, pas technique : plusieurs
           personnes cherchent une place, plusieurs ont leur voiture au
           parking, et personne ne se propose parce que chacun attend qu'un
           autre le fasse. L'appli ne sait pas représenter ça. La ligne
           afficherait « cherche une place · peut conduire », et le blocage
           deviendrait visible. Une colonne, un badge, aucune automatisation.
        b. **Une annonce par personne et par créneau, modifiable.** Changer
           d'avis modifie au lieu d'ajouter : le conducteur fantôme disparaît
           par construction. Dépend du 5.1.
        c. **Garde-fou immédiat, trois lignes** : au moment de prendre une
           place, si l'utilisateur a une offre ouverte, l'avertir — « Vous
           conduisez à 12:05. Retirer votre trajet ? ». Même mécanisme que
           l'avertissement déjà en place pour les demandes.
        d. ❌ **Écarté** : promouvoir automatiquement une demande en offre à
           T-10 minutes. Ça engage quelqu'un à conduire sans qu'il ait cliqué.

1bis.10. ✅ **Créneaux de départ** — livré le 08/09/2026.
        Cinq choix : 12:00, 12:15, 12:30, 12:45, 13:00. **13:00 inclus**,
        tranché le 08/09/2026. Le champ libre `input type="time"` a disparu,
        des deux formulaires ; la liste est aussi validée côté serveur, donc un
        onglet resté ouvert sur l'ancienne version ne peut plus publier 12:07.
        Par défaut, le prochain créneau à venir.
        Spécification d'origine :
        Le champ horaire est aujourd'hui un `input type="time"` : trois gestes
        pour saisir 12:15, et autant d'heures distinctes que de personnes, ce
        qui éparpille des trajets qui pourraient se regrouper. Remplacer par un
        choix de créneaux entre 12h et 13h, toutes les 15 minutes :
        12:00, 12:15, 12:30, 12:45, 13:00 — soit cinq boutons, un seul geste.
        Effet secondaire utile : deux personnes qui visent « vers midi et
        quart » tombent sur le même créneau et se voient, au lieu de publier
        12:14 et 12:17 sans se croiser.
        À trancher : 13:00 inclus ou dernier départ à 12:45 ; et que faire des
        trajets déjà en base à des heures libres (rien, ils s'affichent tels
        quels et disparaissent le lendemain).

1bis.11. ✅ **Un seul trajet par personne et par jour — règle d'exclusion.**
        Demandé et livré le 12/09/2026.

        Tenue par la base : deux index partiels — `annonces (jour, personne)`
        sur les ouvertes, `passagers (jour, personne)` — et, pour l'exclusion
        entre les deux tables qu'aucun index ne peut couvrir, un verrou sur la
        ligne de la personne au début de chaque transaction qui l'engage. Deux
        clics simultanés du même agent s'exécutent l'un après l'autre.

        **Une demande n'est pas un engagement**, décidé à l'écriture : chercher
        une place est un souhait, pas un trajet. La compter aurait interdit de
        prendre la place qu'on cherche, et fait tomber les enchaînements 1bis.6
        à 1bis.8. Elle se ferme d'elle-même quand elle aboutit.

        Le refus nomme ce qui bloque : « Vous conduisez déjà à 12:05. Retirez
        votre trajet avant de monter avec quelqu'un. »

        Spécification d'origine : Un usager fait un trajet, et un seul : soit
        comme conducteur, soit comme passager. Jamais les deux, jamais
        plusieurs fois.

        Aujourd'hui rien ne l'empêche. La base ne tient qu'une contrainte
        d'unicité `(annonce_id, personne)` — elle interdit de prendre deux fois
        la même place, pas de prendre une place dans deux voitures, ni de
        publier une offre tout en montant chez un autre (c'est le conducteur
        fantôme du 1bis.9, dont ce point est la forme générale).

        Ce qu'il faut poser :
        - une personne a **au plus un engagement ouvert** dans la journée :
          une offre publiée, ou une place prise, ou une demande en attente
        - la contrainte est tenue par la base, pas par le client — index
          unique sur la personne, dans la même transaction que l'insertion,
          comme la capacité au 4.3
        - changer d'avis **remplace** l'engagement au lieu de s'y ajouter :
          on se désiste, puis on reprend. Le serveur refuse le second
          engagement en nommant le premier : « vous conduisez déjà à 12:05 »
        - la règle ne vaut que sur les annonces `ouverte` : une annulée ou une
          demande pourvue ne bloque rien

        Prérequis levé le 12/09/2026 : l'identité réelle (4.4bis) est en
        place, donc la règle ne se contourne plus en changeant d'appareil et
        ne bloque plus à tort l'agent qui passe du poste au téléphone.
        Réserve d'origine : Sur des jetons de navigateur,
        la règle est contournable en changeant d'appareil, et pire, elle
        bloquerait à tort l'agent qui passe de son poste à son téléphone.
        Applicable telle quelle pour un petit groupe ; solide seulement après
        l'annuaire.

        À trancher : « aller-retour » a été employé dans la demande, alors que
        le retour du RIA n'est pas modélisé (1bis.4, aller simple assumé).
        Soit le mot vaut pour « un trajet », et la règle est celle ci-dessus ;
        soit le retour revient dans le périmètre, et 1bis.4 est rouvert.
        Retenu par défaut : la première lecture.

~~Limite connue : faute d'identité réelle, un passager est reconnu à son
prénom.~~ Levée le 12/09/2026 : chacun a une identité stable, et la base tient
« une personne, une place ». Les homonymes s'affichent toujours pareil à
l'écran — deux Sophie restent deux « Sophie » sur le panneau —, mais le
serveur, lui, ne les confond plus.

## Lot 3 · Unification
*Dépend du lot 1bis, et du lot 2 quand il sera relancé.*
3.1. Écran unique avec sélecteur de type de trajet en tête (RIA / domicile-travail)
3.2. Fusion sur un seul moteur de stockage

## Lot 4 · Backend et déploiement
*Dépend du lot 1bis. Lot critique : sans backend, l'appli n'existe pas hors du
bac à sable (cf. 1.4).*

4.1. Base de données et hébergement — plus aucun préalable depuis la décision
     du 08/09/2026. Contrainte retenue : code portable, sans dépendance
     propriétaire, pour que la reprise par la DSI soit un simple redéploiement
4.2. Choisir nom de domaine / sous-domaine
4.3. ✅ Backend écrit et **éprouvé en production** le 08/09/2026.
     Postgres Neon, pilote `pg`, `DATABASE_URL` — aucune dépendance propriétaire.
     Les trois collisions rejouées contre la vraie base, requêtes tirées en
     parallèle :
     - a. deux personnes sur la dernière place → une réussit, l'autre reçoit
          « complet » en nommant qui l'a prise. Une seule place en base ✅
     - b. deux conducteurs sur la même demande → un 201, un `deja_pourvue` ;
          la personne est à bord d'une seule voiture ✅
     - c. l'auteur d'une demande prend une place → sa demande disparaît ✅

     Le problème n'est pas la charge — vingt à trente annonces par jour — mais
     la simultanéité : tout se joue entre 11h55 et 12h05, quand tout le monde
     clique dans la même fenêtre de dix minutes.

     Les quatre collisions à traiter :
     a. deux personnes prennent la dernière place en même temps. L'une croit
        l'avoir et se présente à la voiture. C'est la plus grave : ce n'est pas
        un bug, c'est quelqu'un planté sur le parking
     b. deux conducteurs cliquent « Je l'emmène » sur la même demande. La
        personne est promise à deux voitures
     c. l'auteur d'une demande prend une place pendant qu'un conducteur répond
        à cette demande. Un trajet se crée avec un passager déjà ailleurs
     d. un conducteur supprime son trajet alors que des passagers sont à bord

     Les quatre règles côté serveur :
     - une ligne par annonce, une ligne par place prise. Prendre une place est
       un INSERT dans `passagers`, jamais une réécriture de l'annonce
     - la capacité est tenue par la base, pas par le client : « passagers ≤
       places » vérifié dans la même transaction que l'insertion, plus un index
       unique (annonce, personne)
     - une demande se pourvoit une seule fois :
       `UPDATE demandes SET statut='pourvue' WHERE id=? AND statut='ouverte'`.
       Zéro ligne modifiée = quelqu'un a été plus rapide. Règle b et c
     - on ne supprime pas, on marque : statut `ouverte` / `pourvue` / `annulée`.
       Un DELETE rend les courses irrésolvables et efface la trace

     Exigences reprises de l'audit :
     - validation des entrées côté serveur
     - échappement systématique au rendu, y compris des champs techniques
     - purge automatique des annonces passées (TTL ou tâche planifiée)
     - en cas d'erreur de lecture, conserver l'état affiché

4.3bis. ✅ Client réécrit le 08/09/2026 : plus de `window.storage`, tout passe
     par l'API. Chemins d'échec éprouvés contre un serveur de test.
     Spécification d'origine : il suppose aujourd'hui qu'un clic réussit
     toujours. Toute action peut désormais échouer parce qu'un autre a été plus
     rapide.
     - le bouton attend la réponse du serveur avant de se réjouir
     - l'échec reproposé, pas bloqué : « la dernière place vient d'être prise
       par Marie », suivi des autres trajets du même site
     - rafraîchissement immédiat après chaque action, et cycle plus court que
       15 s pendant le coup de feu. Cinq secondes en requêtes conditionnelles :
       480 requêtes/minute de 304 pour quarante personnes. Pas de websockets
       pour ça.

4.4. ✅ **Pour l'essentiel, levé le 12/09/2026 par le 4.4bis** : l'identité est
     stable, rattachée à l'agent et non au navigateur, et vaut sur tous ses
     appareils. Ce qui reste de l'annuaire DDTM22 : il seul prouverait
     l'appartenance à la maison, et lèverait les homonymes. Ni l'un ni l'autre
     ne bloque un test entre volontaires.
     Spécification d'origine : annuaire DDTM22, remplace la saisie libre du
     prénom, et rattache les annonces à l'agent plutôt qu'au navigateur.
     *Remonté du lot 5.1 le 08/09/2026.* À plusieurs dizaines d'agents, sans
     identité stable le serveur ne peut ni savoir qui est à bord, ni empêcher
     une double réservation, ni laisser quelqu'un annuler depuis son téléphone
     ce qu'il a publié depuis son poste. La reconnaissance par prénom du lot
     1bis suffit à trois personnes, pas à trente : il y aura deux Sophie.

4.4bis. ✅ **Identification sans mot de passe — livrée le 12/09/2026.**
     Lien magique par mail, adresse au choix de l'agent. Éprouvé de bout en
     bout : le clic pose la session, le jeton disparaît de la barre d'adresse,
     le cookie est hors de portée du JavaScript, un lien ne sert qu'une fois,
     un lien inventé ne pose rien. Le même agent sur deux appareils est une
     seule personne — et retire depuis son téléphone ce qu'il a publié depuis
     son poste, ce qui était la limite du 4.4.
     Sans `SMTP_URL`, le lien part dans le journal du serveur : le site
     fonctionne, les liens se distribuent à la main le temps d'obtenir un
     relais. Exigence d'origine :
     Aucun mot de passe, ni à créer, ni à retenir, ni à réinitialiser. Une
     appli de covoiturage du midi ne justifie pas un compte : le premier agent
     qui doit inventer un mot de passe pour réserver une place à 11h58 ferme
     l'onglet. Et un mot de passe de plus, c'est un mot de passe réutilisé.

     Ce que l'identification doit produire, quel que soit le mécanisme : une
     **identité durable côté serveur**, rattachée à l'agent et non au
     navigateur, valable sur son poste comme sur son téléphone. C'est la même
     pièce que le 4.4, et elle règle aussi la faille de jeton (cf. défauts
     trouvés en production) : aujourd'hui `personne` est à la fois l'identité
     et la preuve. Il faut les séparer — une identité publique et stable, une
     preuve secrète qui ne ressort jamais de l'API. Trois chantiers, une seule
     correction.

     **Tranché le 12/09/2026 : lien magique par mail, à l'adresse que l'agent
     choisit — professionnelle ou personnelle, au choix.** L'agent saisit son
     adresse, reçoit un lien, clique : session posée pour longtemps. Plus
     jamais de saisie, sur aucun de ses appareils.

     Le choix libre de l'adresse règle la réserve qui pesait sur ce
     mécanisme : un mail émis d'un hébergeur externe vers une boîte gouv.fr a
     toutes les chances d'être filtré, et l'agent dont le lien n'arrive pas
     donne simplement une autre adresse. Le blocage devient contournable par
     l'usager, sans intervention.

     Ce qu'on perd, et qu'il faut assumer : le domaine de l'adresse ne prouve
     plus l'appartenance à la maison. L'identification garantit la
     **continuité** — c'est bien la même personne d'une fois sur l'autre, d'un
     appareil à l'autre — et non la **qualité d'agent**. Pour un covoiturage
     du midi entre collègues qui se connaissent, c'est suffisant : le contrôle
     d'appartenance est social, il se fait sur le parking. À rouvrir si le
     service sort du cercle des volontaires — c'est ce que le SSO apporterait.

     Conséquences de conception :
     - l'adresse devient la clé d'identité : unicité sur l'adresse normalisée
       (minuscules, espaces retirés). Le prénom reste purement d'affichage
     - **l'adresse ne sort jamais de l'API.** Le panneau affiche des prénoms,
       jamais des adresses. Même règle que pour les jetons
     - lien à usage unique et court (de l'ordre du quart d'heure), puis
       cookie de session durable, `httpOnly`, pour ne pas ré-identifier à
       chaque midi
     - **envoi en SMTP simple, paramétré par variable d'environnement.** Un
       service d'envoi propriétaire romprait la portabilité du 4.1 : la DSI
       doit pouvoir pointer le relais du ministère et redéployer, sans
       réécrire. C'est la seule contrainte technique ferme sur ce chantier
     - limiter la cadence d'envoi par adresse et par IP : un formulaire qui
       expédie un mail à toute adresse saisie est un canon à courrier si on
       le laisse ouvert
     - reprise de l'existant : les jetons de navigateur déjà en base n'ont pas
       d'adresse. Ils vivent jusqu'à extinction, ou le test repart à zéro —
       vu le volume, la seconde option coûte moins cher

     Écartés :
     - **SSO agent de l'État** — la bonne réponse à terme, et celle qui
       n'appelle aucun mot de passe de notre part. Hors de portée d'un
       service expérimental ; à reprendre par la DSI. Reste à vérifier lequel
       s'applique à la DDTM22. *Noms à confirmer, non vérifiés au 12/09/2026.*
     - **Lien nominatif remis à la main** — reste en secours si l'envoi de
       mail tarde : un lien signé par personne, transmis de vive voix, zéro
       infrastructure, suffisant pour cinq testeurs. Ne tient pas au-delà,
       un lien se transfère.
     - ❌ **Clé d'accès / passkey** — sans mot de passe, oui, mais elle
       identifie un appareil, pas une personne. Ne règle ni 4.4 ni 1bis.11.

     Pour mémoire, volet RGPD clos : une adresse personnelle est une donnée
     plus sensible qu'une adresse professionnelle. À signaler à la DSI au
     moment de la reprise, avec le reste de `conformite-rgpd.md`.

4.5. Périmètre : déployer le RIA seul. Le lot 2 étant gelé, attendre
     l'unification bloque indéfiniment ; un mois de test réel informera mieux
     le lot 3. — décision prise
4.6. ✅ Déployé le 08/09/2026. Reste le test réel sur un site RIA avec un
     petit groupe volontaire.

### Défauts trouvés en production (08/09/2026)
- ~~Deux instances démarrant ensemble jouent le même `create table if not
  exists` : Postgres lève une erreur de doublon et l'utilisateur reçoit un 500.~~
  Corrigé le jour même par un verrou consultatif (`pg_advisory_lock`).
- ~~Sur sa propre annonce, l'absence de bouton « Je monte » se lit comme une
  panne : rien ne dit que la ligne est la vôtre.~~ Signalé à l'usage le
  08/09/2026, corrigé le jour même par un badge « Vous ».
- ~~**L'API expose le jeton `personne` de chacun dans le panneau public.**~~
  **Corrigé le 12/09/2026.** Le panneau ne renvoie plus aucun identifiant, ni
  celui des annonces ni celui des passagers : seulement `mienne`, `a_bord`, et
  les prénoms. L'identité vient du cookie, jamais du corps de la requête — le
  client ne dit plus qui il est, il le prouve. Vérifié : un agent ne peut pas
  retirer l'annonce d'un autre, et la réponse ne contient ni jeton ni adresse.

## Lot 5 · Durcissement
*Dépend du lot 4. L'identité réelle en est sortie : elle est devenue un
prérequis du serveur, cf. 4.4.*
5.1. Modification d'une annonce
5.2. Modération minimale : qui supprime une annonce abandonnée ?

## Lot 6 · Accessibilité et mise en conformité RGAA
*Peut démarrer en parallèle du lot 4. Obligation légale, pas une option : un
outil interne d'un organisme public entre dans le champ du RGAA, intranets et
extranets inclus. Version en vigueur RGAA 4.1.2 ; RGAA 5 annoncé pour fin 2026.
[accessibilite.numerique.gouv.fr, 08/09/2026]*

6.0. ✅ **Interface redessinée le 12/09/2026** (Claude Design). Panneau façon
     tableau de gare : heure en chasse fixe, mention « conduit » / « cherche »,
     places figurées par des pastilles pleines ou vides, horloge en en-tête.
     Les créneaux et le nombre de places se prennent en boutons — un geste au
     lieu d'une liste déroulante. « Je l'emmène » passe en ambre, distinct de
     « Je monte ».
     Effet de bord utile : `.row.past` n'est plus à `opacity .45` mais sur un
     fond distinct, ce qui règle le défaut de contraste du 6.1.

6.1. Corriger les défauts d'accessibilité relevés à l'audit.
     Fait au lot 1bis : `role="dialog"`, `aria-modal`, piège de focus, fermeture
     par Échap et rendu du focus, `aria-pressed` sur onglets et chips,
     `aria-live` sur le panneau, cibles à 44 px, erreurs de saisie annoncées
     par un texte et non par la seule couleur.
     ~~Reste : contraste de `.row.past` (opacity .45)~~ — réglé au 6.0.
     Reste : audit complet.
6.2. Audit RGAA, déclaration d'accessibilité, mention de conformité, schéma
     pluriannuel. Montant de la sanction : à vérifier.
6.3. Afficher la mention d'information RGPD (texte issu de `conformite-rgpd.md`)

---

## Décisions bloquantes en attente
*Par ordre de blocage décroissant.*

1. Canal de contact après appariement (1bis.5) — devenu urgent : un conducteur
   qui annule à 11h50 doit pouvoir prévenir ses passagers (collision 4.3.d).
   Sans canal, l'appli ne peut que l'afficher sur un panneau que personne ne
   regarde à cet instant. Argument concret en faveur du mail Mélanie plutôt
   que du « on se retrouve sur le parking »
2. ~~Double rôle (1bis.9) et règle d'exclusion (1bis.11).~~ **Tranché et livré
   le 12/09/2026** : un engagement par personne et par jour, tenu par la base.
   Reste ouverte, mais elle ne bloque plus rien : la case « j'ai une voiture,
   mais je préfère monter » (1bis.9.a), qui rendrait visible le blocage social
   — plusieurs cherchent, plusieurs ont leur voiture, personne ne se propose
3. ~~À partir de combien de testeurs l'annuaire réel (4.4) devient-il
   obligatoire ?~~ Sans objet depuis le 12/09/2026 : l'identité est stable et
   durable, le test peut s'ouvrir. Ce que l'annuaire apporterait encore — la
   preuve d'appartenance à la maison — relève de la reprise DSI
4. Nom de domaine (4.2) — ne bloque rien, l'adresse Vercel fonctionne

## Mis de côté — Lot 2 domicile-travail
Pas à l'ordre du jour, conservé pour mémoire. Specs prévues :
- Trajets récurrents (jours de la semaine + horaires)
- Matching proximité + chevauchement de créneau
- Ajustement ponctuel d'un trajet récurrent
- Formulaire avec lieu de départ (lieu1/lieu2, noms réels à définir)
- Fenêtre temporelle : mois en cours + mois suivant
- Navigation temporelle à trancher (onglets mois vs sélecteur de date)
- Refonte interface en calendrier/liste filtrable par date (le panneau
  "aujourd'hui" du RIA ne convient pas ici)
