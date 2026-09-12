# Vroom ! — Volet conformité RGPD  ·  CLOS

> **Clos le 08/09/2026.** Décision : ce site est une expérimentation. Quand il
> fonctionnera, les services informatiques prendront le relais pour l'installer
> dans leur dispositif — la conformité relèvera d'eux à ce moment-là. Ce
> document n'est plus une liste d'actions ; il est conservé pour mémoire, et
> pour la reprise éventuelle par la DSI.

Sorti de la feuille de route le 08/09/2026. Traité à part parce que ce n'est pas
du développement : c'est une démarche administrative, avec ses propres délais et
ses propres interlocuteurs. Elle avance en parallèle du code, pas dedans.

Ne concerne que le RGPD. L'accessibilité (RGAA) reste dans la feuille de route,
lot 6 : autre obligation, autre cadre, autre interlocuteur.

---

## Pourquoi cette démarche existe

L'appli traite des données personnelles d'agents publics : prénom, site
d'affectation, horaire de départ, habitudes de déplacement. La saisie libre du
prénom, sans annuaire, ne fait pas sortir le traitement du RGPD — dans un
service de quelques dizaines d'agents, la personne reste identifiable au sens de
l'article 4.1. Elle allège le traitement (pas de compte, pas
d'interconnexion RH, pas de données de connexion), elle ne le supprime pas.

Conséquence pratique : si l'outil passe par le DPD et le registre, le
responsable de traitement est la DDTM22. S'il est déployé en dehors, sur un
hébergement personnel, le responsable de traitement est Philippe PAYET
personnellement.

## Pourquoi avant le choix d'hébergement, et non après

Héberger des données d'agents de l'État hors du SI de l'État — Vercel,
Hostinger — est le point que le DPD est le plus susceptible de retoquer.
Construire d'abord et demander ensuite, c'est risquer de tout refaire. La
démarche conditionne donc le 4.1 de la feuille de route.

## Actions

1. Saisir le DPD. Interlocuteur à identifier d'abord : les DDTM étant des
   directions départementales interministérielles, la fonction peut être portée
   par le SGCD, la préfecture ou le ministère de tutelle. À vérifier auprès du
   SG ou sur l'intranet — se tromper d'interlocuteur coûte des semaines.
2. Contenu de la saisine, une page : ce que fait l'outil, quelles données, sur
   qui, combien de personnes, où c'est hébergé, combien de temps c'est conservé.
3. Définir la base légale et la durée de conservation.
4. Inscription au registre des traitements de la DDTM22.
5. Trancher l'hébergement au regard de l'avis rendu.
6. Prévenir la hiérarchie : un outil qui traite des données d'agents ne se
   déploie pas sous le radar, même bénévolement.

## Retombée dans le code

- Afficher la mention d'information dans l'interface (texte issu du point 3).
  Se raccroche au lot 6 de la feuille de route.
- Purge automatique des annonces passées : déjà exigée en 4.3 pour des raisons
  techniques, elle sert aussi de durée de conservation.

## Statut

Rien n'est engagé. Le point 1 est le seul qui dépende d'un tiers : le délai
court pendant que le développement avance sur le lot 1bis.
