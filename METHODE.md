# Méthode de travail

Du besoin à l'outil livré, dans cet ordre. Chaque étape laisse une trace dans `REPRENDRE.md`.

## 1. Cadrage -> SPEC.md
- Comprendre le besoin : qui s'en sert, pour faire quoi, qu'est-ce qui est hors sujet.
- Remplir `SPEC.md` (rubriques du gabarit). Chaque exigence est numérotée **R1..Rn** et écrite ainsi :
  **Étant donné** (situation) / **Quand** (action) / **Alors** (résultat visible).
- Une exigence = un résultat qu'on peut tester. Pas de mot technique dans les exigences d'écran.

## 2. Découpage : MVP, puis V2, puis V3
Chaque exigence reçoit `mvp`, `v2` ou `v3`, avec une phrase de raison.
1. **Le MVP doit pouvoir se vendre seul** : un parcours complet de bout en bout, sans écran vide ni bouton mort.
2. **Le MVP garde tout ce qui protège** : sécurité, sauvegardes, mobile d'abord, aucun mot technique. Jamais renvoyé en V2.
3. **7 lots au plus pour le MVP.** Au-delà, proposer une coupe.
4. **V2** : ce que demandent les premiers clients, le confort. **V3** : automatisations avancées, intégrations rares.
5. Chaque version suit le cycle complet ci-dessous.

## 2 bis. Maquettes validées par le responsable, avant tout code (lot L8)
1. Déclarer les écrans dans `src/design/ecrans.ts` (données **fictives**, au moins un nom long, une valeur zéro, une valeur négative) : c'est la liste unique des écrans.
2. `pnpm planche` écrit `planche/planche.html` : une synthèse d'une page (« voici ce que j'ai compris »), puis chaque écran sur téléphone, puis sur ordinateur, avec 3 questions fermées et un minuteur qui donne un code de résultat.
3. **Le responsable valide la planche (téléphone d'abord) avant que la moindre ligne de code d'outil soit écrite.** Sans « OK » du responsable : `ETAT: ATTENTE-WILL`. Outil vendu : 3 personnes renvoient chacune leur code de résultat.
4. Couleurs, espacements et tailles ne s'écrivent que dans `src/design/jetons.ts`. `pnpm design:check` doit être vert (contraste AA, cibles de 44 px, rien qui déborde à 360 px, aucun mot technique, couleurs issues des jetons).
5. Un écran ajouté ou modifié = planche régénérée et revalidée.

## 3. Pour chaque lot
0. **Chercher avant d'écrire** : avant chaque lot, chercher si la fonction existe déjà : briques du kit, bibliothèques npm reconnues, dépôts GitHub actifs. Noter la décision dans `SPEC.md` : **réutiliser**, **s'inspirer** ou **écrire**, avec le lien et la licence. Ne jamais copier de code sans licence ou sous licence AGPL ou GPL (s'en inspirer seulement, en réécrivant). Tout code venu d'ailleurs et toute nouvelle dépendance passent par une PR sensible (`package.json`), donc par le responsable. Pas de no-code (n8n, Notion, Zapier) : uniquement du code TypeScript.
1. **Tests d'abord** : écrire les tests des exigences R du lot ; ils doivent échouer.
2. **Code** : le minimum pour passer au vert. Logique dans `src/lib` (couverture >= 80 %).
3. **Vérifier** : `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm design:check`.
4. **Relecture** : agent `relecteur`, jusqu'au verdict ACCEPTÉ.
5. **PR** : une PR par lot, CI verte, `REPRENDRE.md` à jour.
6. **État des exigences** : dans la PR du lot, passer la ligne `- État :` de chaque exigence traitée à `en cours` puis `fait` (jamais `recetté` avant la recette de l'étape 4). Si `ETAT: ATTENTE-WILL`, écrire la question dans `**Question pour le responsable :**`. La page d'avancement publique (voir `docs/avancement.md`) lit ces lignes. **Règle : la page est publique : jamais de nom de client, de montant ni de faille dans l'objectif, la prochaine action ou la question ; renvoyer vers une issue si besoin.**

## Aller vite sans perdre en qualité
La vitesse vient de la découpe et des gardes automatiques, jamais d'un contrôle affaibli.

**Découper en fiches.** Chaque lot devient des fiches minuscules dans `pilotage/fiches/LNN-Tmm.md` (modèle : `MODELE.md`). En-tête : `id`, `titre`, `lot`, `statut` (`a_faire` | `fait`), `depend_de`, `fichiers_autorises`, `taille_max_lignes`, `tests_requis`, `sensible`, `exigences`.
- Une fiche = un agent, une branche `lot-NN/LNN-Tmm`, un commit propre. Titre de PR « LNN-Tmm <titre> », corps « Fiche: LNN-Tmm » et les exigences. Toute PR d'agent DOIT suivre ce motif de branche et porter « Fiche: LNN-Tmm » dans son corps ; une branche `lot-…` hors motif est refusée par la CI. Journal `pilotage/journal/LNN-Tmm.md` de 10 lignes au plus.
- Deux fiches qui touchent le même fichier ne partent jamais ensemble.
- **Parallélisme fort.** Toutes les fiches prêtes qui ne se chevauchent pas partent EN MÊME TEMPS, chacune dans sa routine cloud (modèle Sonnet), sans limite fixe du nombre de routines, avec leurs relecteurs Opus en vague. Seuls garde-fous : 400 millions de jetons et 400 sessions par jour (plafond atteint = arrêt propre jusqu'au lendemain), et rien de lourd sur le PC.
- **Fichiers communs.** Les fichiers que beaucoup de fiches voudraient toucher (`package.json`, `.github/workflows/ci.yml`, configuration) sont modifiés par UNE fiche « socle » qui passe en premier ; les autres fiches en dépendent (`depend_de`). Cela évite les conflits de fusion en série.
- **Chaque routine reçoit la liste des failles déjà trouvées** par les relecteurs (`docs/pieges.md`), pour réduire les refus au premier passage.
- `pnpm pilotage:pretes` liste les fiches prêtes ; lancer d'abord celles qui en débloquent le plus. `pnpm pilotage:lint` repère les fiches incohérentes (ex. tests exigés sans fichier de test autorisé).
- La CI refuse tout fichier hors `fichiers_autorises` (fiche et journal exceptés), toute taille au-dessus de `taille_max_lignes`, et le statut `fait` sans journal ou avec une dépendance non faite.

**Consigne de qualité des auteurs (à garder telle quelle).**
- Mesurer la taille AVANT de pousser (`git diff --stat origin/main`, tests, fiche et journal compris).
- Interdit de supprimer un test, un cas limite ou une assertion pour tenir la taille : compacter, ou séparer le code et la clôture (statut `fait` + journal), ou répondre « TROP GROS ».
- Cas limites exigés tous testés : NaN, Infinity, non entiers, vides, ordre inversé.
- Aucune valeur légale ou chiffrée en dur : paramètres datés et sourcés. Aucun secret en dur.
- Un seul commit propre par branche ; éviter les mots interdits par la CI.

**Relecture.** Un relecteur Opus lit le diff (périmètre, tests qui casseraient si le code casse, cas limites, valeurs en dur, journal, titre) et dépose `AVIS-<id>.md` sur la branche `avis/<id>`. Première ligne : `VERDICT: OK` ou `VERDICT: A CORRIGER`, puis la liste.
- Chaque vague d'auteurs part avec sa vague de relecteurs.
- Un agent ne relit jamais son propre travail.
- On n'affaiblit jamais une garde ni la protection de la branche principale : on corrige le code, pas le contrôle.

**Fusion.** La fusion est faite par le portier du kit, jamais par un agent ni par un jeton personnel. Il n'y a pas de train de fusion dans l'outil. Pièges connus : `docs/pieges.md`.

## 4. Recette
Parcourir chaque R de `SPEC.md` sur téléphone, sur l'outil construit. Noter pour chacune : réussi / à corriger. Corriger, puis passer `ETAT: FINI`.

## Règles d'écran
Mobile d'abord (tester à 375 px). Aucun mot technique à l'écran. Français simple, boutons larges, un seul geste principal par écran.
