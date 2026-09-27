---
name: verifier-avant-affirmer
description: Vérifier qu'un correctif ou un changement fonctionne réellement, en conditions réelles, avant d'affirmer qu'il est fait — et recommencer tant que ce n'est pas prouvé. À appeler systématiquement, en autonomie, avant toute phrase du type "corrigé", "déployé", "ça marche", "vérifié" dans ce projet.
---

# Vérifier avant d'affirmer

Née d'un incident réel (27/09/2026) : un correctif du bandeau « Première
fois ? » a été annoncé "vérifié en production" alors que la vérification
avait été faite avec un état de navigateur pollué par mes propres tests
précédents (localStorage déjà à "oui"), pas avec l'état d'un vrai nouveau
visiteur. Résultat : l'utilisateur a vu un comportement différent du mien et
a eu raison de douter — pas de la correction elle-même, mais de la rigueur
de la vérification annoncée. Cette compétence existe pour que ça ne se
reproduise pas, dans ce projet et dans tout projet où le même risque existe.

## Règle

**N'écris jamais "corrigé", "déployé", "ça marche" ou "vérifié" sans avoir
exécuté, dans ce message même, une vérification qui reproduit les
conditions réelles du problème signalé — pas les conditions les plus
pratiques pour toi.**

Si la vérification échoue ou reste ambiguë : ne l'annonce pas comme fait.
Corrige encore, revérifie, et recommence — en le disant explicitement
("premier essai insuffisant, je recommence") plutôt qu'en polissant la
formulation pour qu'elle sonne comme un succès.

## Ce qui distingue une vraie vérification d'une fausse

Une fausse vérification (celle qui a produit l'incident) :
- relire le code et conclure que la logique est correcte ;
- tester en JS l'état interne (`element.hidden === true`) sans regarder le
  rendu réel ;
- réutiliser un onglet de navigateur déjà pollué par des tests précédents
  (cookies, localStorage, cache) au lieu de l'état d'un utilisateur neuf ;
- faire confiance à l'affirmation d'une revue précédente ("Kernel dit que
  c'est corrigé") sans la recontrôler soi-même.

Une vraie vérification :
- reproduit l'état de départ de la personne qui a signalé le problème,
  pas un raccourci pratique (pour du web : `localStorage.clear()` +
  cookies effacés + rechargement, dans un onglet dédié, avant de tester) ;
- observe le résultat par le canal que la personne utilise réellement —
  capture d'écran ou lecture du DOM rendu pour de l'UI, export texte pour
  un pad, réponse HTTP réelle pour une API — jamais seulement l'état
  interne du code ;
- compare ce résultat à la plainte exacte formulée, pas à une version
  affaiblie ou généralisée de cette plainte ;
- s'il existe un doute sur pourquoi deux observations diffèrent (ex : "je
  ne vois pas ce que l'utilisateur voit"), cherche activement la cause
  (état stocké différent, cache, version différente) au lieu de conclure
  que ça marche et de laisser le doute non résolu.

## Boucle à suivre

1. Relire ce qui a été changé (diff, pas mémoire).
2. Rejouer le scénario exact du signalement, dans un état neuf.
3. Observer le résultat par un moyen qui ne peut pas mentir (export,
   capture, réponse serveur — pas une variable JS qu'on a soi-même posée).
4. Si conforme : dire ce qui a été testé et ce qui a été vu, pas seulement
   "vérifié". Si un facteur externe explique un écart avec ce que voit
   l'utilisateur (ex. préférence déjà enregistrée sur son appareil),
   le dire explicitement plutôt que de laisser planer le doute.
5. Si non conforme : corriger encore, recommencer à l'étape 2. Ne jamais
   répondre à mi-chemin d'une correction en la présentant comme terminée.
