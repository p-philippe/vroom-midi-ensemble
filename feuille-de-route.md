# Vroom ! — Feuille de route

« Midi ensemble » — covoiturage entre collègues de la DDTM22.

Pensée simple, accessible, fluide, souple : écran unique, web app légère (KISS/YAGNI).

Dernière mise à jour : 13/09/2026 — **en ligne**, avec les vrais lieux et
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
     **Amendé deux fois le soir même, jusqu'à la bonne forme.** Version
     retenue : **on se choisit dans la liste des gens déjà connus.** La
     première fois on donne son prénom ; ensuite, sur tout appareil, on se
     retrouve et on clique. Ni mot de passe, ni courrier, ni installation.
     C'est ce geste qui règle le doublon, qui était la vraie demande : rien
     à retaper, donc rien à écrire autrement d'un appareil à l'autre.
     S'ajouter sous un nom déjà pris est refusé, avec renvoi à la liste ou
     invitation à ajouter une initiale pour les vrais homonymes.
     Rien n'est vérifié, et c'est assumé : « il n'y a pas d'enjeu de sécurité
     sur cette application ». Niveau d'une feuille d'inscription au mur.
     **Qui tient la liste ? Personne** — question posée et réglée le même
     soir. Chacun corrige ou retire son propre nom, et ce qu'on n'a pas revu
     depuis un mois sort de la liste tout seul, son nom redevenant libre. La
     ligne reste en base : revenir, c'est se retrouver, pas repartir de zéro.
     Se retirer annule ses trajets du jour — rester inscrit sous un nom
     disparu laisserait un collègue attendre un fantôme.
     Le lien magique par courrier a été retiré du code — il figurait au
     commit b282ba5 si on veut l'y reprendre.
     Étape intermédiaire écartée le même soir : La distribution des liens à la main a été
     écartée par Philippe : elle fait de lui le passage obligé de chaque
     inscription. Sans relais de courrier, l'adresse saisie ouvre donc la
     session **sur parole**, et le lien de confirmation se rallume tout seul
     le jour où `SMTP_URL` est posée — un réglage, pas une réécriture.
     Ce qu'on perd : n'importe qui peut saisir l'adresse d'un collègue et
     passer pour lui. Niveau de confiance d'une feuille d'inscription
     affichée au mur. Ce qu'on garde : une identité stable, valable sur tous
     les appareils, sans mot de passe et sans intervention.
     Trois marches, dans l'ordre : l'adresse sur parole (aujourd'hui), le lien
     de confirmation (`SMTP_URL`), le SSO agent de l'État (reprise DSI).
     Exigence d'origine :
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

6.0bis. ✅ **Notice de prise en main — livrée le 12/09/2026.** `public/aide.html` :
     six gestes, six scènes animées en CSS, sans image ni bibliothèque. Se
     nommer, publier, monter, emmener, la règle d'un trajet par jour, changer
     d'avis — puis les deux choses à savoir : l'appli ne notifie personne, et
     elle ne vérifie pas qui vous êtes.
     Dans l'appli plutôt qu'à côté : une seule adresse à diffuser. Lien discret
     en en-tête, et bandeau à la première visite seulement, effaçable d'un
     geste — un écran qui s'impose se referme sans être lu.
     Chaque scène est construite pour que l'état **d'arrivée** soit l'état par
     défaut : sous `prefers-reduced-motion`, la notice reste juste sans jouer.

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

## Lot 7 · Ouverture — retours des testeurs, reprise, code libre
*Ce lot ne touche pas au code de l'appli : il organise ce qui l'entoure
pendant le test réel (4.6), et prépare la sortie de scène de son auteur.*

7.1. ✅ **Les retours passent par un framapad, et par lui seul.**
     Pad ouvert le 13/09/2026 :
     https://annuel.framapad.org/p/covoiturage22-ani7
     Rien à installer, aucun compte à créer. Chacun écrit ce qu'il a vu, quand
     il l'a vu ; tout le monde lit tout le monde, ce qui évite de recevoir cinq
     fois la même remarque.
     Le lien est dans l'en-tête de l'appli, « Donner mon avis », à côté de
     celui de la notice — une seule adresse à diffuser, comme au 6.0bis.

     **Aucun échange par mail.** Ni pour signaler un défaut, ni pour poser une
     question, ni pour demander une évolution. Un retour envoyé par courrier
     n'est pas traité : il est renvoyé au pad. La règle n'est pas de confort,
     elle est structurelle — un fil de mails fait de Philippe le point de
     passage obligé, et rend le service inreprenable le jour où il s'arrête.
     Ce qui est écrit au pad reste lisible sans lui.

     **Renseignement libre, pas de trame** — décidé le 13/09/2026. On écrit ce
     qu'on veut, comme on veut : une gêne, une idée, une phrase jetée. Un
     formulaire à rubriques ferait taire ceux qui n'ont qu'une remarque en
     passant. Seule une introduction est posée en tête : comment ça marche,
     pas de mail, qui répond, ce qu'est cette appli, la reprise à venir et la
     licence libre.

     **Qui tient le pad : Claude** — convenu le 13/09/2026. C'est lui, et lui
     seul, qui répond aux usagers ; Philippe n'y écrit pas et se prononce
     uniquement sur ce qui remonte. Relève une fois par semaine (tâche
     planifiée, lundi 9h) et à la demande.
     Ce que Claude fait seul : accuser réception, expliquer ce que l'appli
     fait déjà, renvoyer à la notice, corriger un défaut manifeste.
     Ce qui remonte toujours : s'engager sur une évolution, promettre une
     date, arbitrer entre deux demandes contradictoires, revenir sur une
     décision inscrite ici.
     Cohérent avec le reste du lot : le pad reste lisible par quiconque, et
     rien de ce qui s'y dit ne dépend d'un fil privé.

7.2. ⬜ **Un service doit prendre le relais, en pleine autonomie.**
     L'appli est une expérimentation (cf. constat d'audit, point 2) : elle a
     vocation à être reprise, pas à être maintenue indéfiniment par celui qui
     l'a écrite. La reprise se fait sans lui — pas « avec son appui », pas
     « en lien avec lui » : sans lui. C'est le critère de réussite du test.

     Ce qui rend la reprise possible est déjà tenu, et doit le rester :
     - code portable, sans dépendance propriétaire (4.1) — Postgres et SMTP
       standards, redéployables ailleurs sans réécriture
     - identité en trois marches, la dernière étant le SSO agent de l'État
       (4.4bis), qui est l'affaire du service repreneur
     - volet RGPD documenté et transmissible (`conformite-rgpd.md`), à remettre
       tel quel au moment de la reprise
     - notice de prise en main dans l'appli (6.0bis), donc rien à transmettre
       de vive voix pour l'usage courant

     ✅ **Le `README` de reprise est écrit** (13/09/2026) : variables
     d'environnement, schéma, procédure de déploiement, ce que le serveur
     garantit et ce qui a été volontairement laissé de côté. Une section
     « Reprise » y pose la règle en toutes lettres — sans lui. Une page, pas
     un dossier.

7.3. ⬜ **Le code est publié sur GitHub.** Dépôt public, dès le test bêta et
     non à la fin : un service ne peut pas reprendre ce qu'il ne peut pas lire.
     La publication n'est pas un geste militant, c'est la condition du 7.2.
     ✅ **Vérifié le 13/09/2026 : aucun secret**, ni dans les fichiers suivis,
     ni dans les dix commits d'historique. `.env.local`, `.vercel/` et les
     sauvegardes sont ignorés ; `DATABASE_URL` et compagnie ne vivent qu'en
     variables d'environnement. Le dépôt est prêt à partir.
     Reste le geste : créer le dépôt distant et pousser.

     Rien n'oblige à publier : le code est celui d'un particulier, pas d'une
     administration. C'est un choix, et c'est le choix qui rend le 7.2
     possible — un service ne reprend pas ce dont il devrait demander
     l'autorisation à chaque modification.

7.4. ✅ **Licence MIT — tranché le 13/09/2026**, fichier `LICENSE` posé à la
     racine. N'importe qui peut reprendre, modifier, redéployer, sans rien
     demander. Une seule obligation : conserver le fichier et la ligne de
     copyright dans les copies.

     Pourquoi MIT plutôt que CC0, qui est plus ouverte encore : le droit moral
     français est **inaliénable**. On ne peut pas renoncer à sa paternité même
     en le signant, si bien que CC0 — écrite pour le copyright américain — se
     replie ici sur sa licence de secours et produit un résultat approximatif.
     MIT ne demande de renoncer à rien : elle autorise, ce qui est valide sans
     réserve. Et l'attribution ne gêne aucun repreneur — un fichier texte à
     garder, rien à afficher, rien à négocier.

     Raisonnement conservé ci-dessous : il documente pourquoi Creative Commons
     ne convenait pas, question qui reviendra.

     **Creative Commons ne convient pas ici** : ces licences sont faites pour
     des textes et des images, pas pour du logiciel, et Creative Commons
     déconseille elle-même de les employer pour du code (elles ne disent rien
     du code source, ni des brevets, ni de la garantie). L'intention est la
     bonne, l'outil non.

     Les deux équivalents pour du code, par ordre d'ouverture :
     - **CC0 1.0** — renoncement au droit d'auteur, aussi près du domaine
       public que le droit français le permet. C'est bien du Creative Commons,
       mais c'est le seul de leurs instruments prévu pour ça. Aucune obligation
       pour le repreneur, pas même celle de citer
     - **MIT** — deux paragraphes, une seule obligation : conserver la mention
       de la licence. C'est la licence par défaut du monde logiciel, comprise
       partout, y compris par un service informatique qui n'a pas envie de
       lire un contrat

     **Le choix appartient à l'auteur, et à lui seul.** L'appli est écrite par
     un particulier, sur son temps et son matériel : il en est titulaire des
     droits, et rien ne l'oblige à suivre la liste des licences autorisées pour
     les codes sources de l'État — celle-ci ne vaut que pour le code produit
     *par* une administration. Elle deviendrait la sienne si la DDTM22
     reprenait le projet à son compte ; ce serait alors sa décision, pas une
     contrainte sur cette publication-ci.

     Corollaire à ne pas perdre de vue : si le projet doit rester un travail
     personnel, mieux vaut qu'il le reste franchement — écrit hors du temps de
     service, sans moyen de l'administration, et sans commande de sa part.
     C'est aussi ce qui rend le don au repreneur propre et sans discussion.

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
4. ~~Licence du dépôt (7.4)~~ **Tranché le 13/09/2026 : MIT**, fichier posé.
   Ne bloque plus la publication sur GitHub (7.3)
5. Nom de domaine (4.2) — ne bloque rien, l'adresse Vercel fonctionne

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
