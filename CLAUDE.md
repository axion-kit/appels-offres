# Règles de travail (session autopilot sur un outil créé depuis ce gabarit)

Réponds toujours en français. Garde le contexte court : lis seulement ce qui sert.

## Au démarrage
1. Lis le bloc du haut de `REPRENDRE.md` (ligne `ETAT:`). Si `ATTENTE-WILL` ou `FINI` : ne code pas, rappelle l'état et arrête-toi.
2. Suis `METHODE.md`. Les exigences sont dans `SPEC.md` (R1..Rn).

## Chaque lot
- Tests d'abord (ils échouent), puis le code, jusqu'au vert.
- Vérifie en local : `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm design:check`.
- Une PR par lot, petite, avec le modèle `.github/pull_request_template.md`.
- Avant chaque PR : lance l'agent `relecteur` ; corrige jusqu'à « ACCEPTÉ ».
- Tâche difficile (données, argent, sécurité, bug obscur) : agent `concepteur` d'abord.
- Mets `REPRENDRE.md` à jour à chaque étape (fait, reste, prochaine action, pièges).

## Interdits
- Ne touche jamais, sans accord et raison écrite dans la PR, aux chemins de sécurité (authentification, droits, secrets) ni aux zones sensibles du portier. **La liste qui fait foi est celle du portier** : `chemins-sensibles.txt` du dépôt `axion-kit-pilote/kit-pilote` (https://github.com/axion-kit-pilote/kit-pilote/blob/main/chemins-sensibles.txt). En cas de doute ou de différence avec ce qui suit, c'est elle qui l'emporte. Familles principales : `.github/**` et `.claude/**` ; les fichiers de dépendances (`package.json`, verrous `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock*`, `.npmrc`, `.pnpmfile.*`, `pnpm-workspace.yaml`) ; les réglages d'outils (`tsconfig*.json`, `*.config.*`, `.eslintrc*`, `.babelrc*`, `.nvmrc`, `.yarnrc*`, `.postcssrc*`, `.browserslistrc`, `vitest.workspace.*`) ; les secrets et leur contrôle (`.env*`, `.gitleaks*`) ; le déploiement (`vercel.json`, `netlify.toml`, `Dockerfile*`, `.husky/**`) ; les scripts (`scripts/**`, `outils/**`) ; les consignes (`**/CLAUDE.md`, `CLAUDE.local.md`, `.mcp.json`, `METHODE.md`) ; les déclarations de types `*.d.ts` ; ainsi que la suppression ou le renommage de tests.
- Aucun secret, aucune clé, aucun nom de client ou de personne dans le dépôt (il est public).
- Jamais de force-push, jamais `rm -rf`, jamais `gh secret`.
- N'utilise pas `git worktree`. Pas d'agent ni de workflow en modèle « haiku » : Opus pour concevoir et relire, Sonnet pour le reste.
- Ne supprime ni ne purge aucune donnée de personnes.
- Ne désactive, ne saute ni ne met de côté aucun test pour passer au vert.

## Écran
- Maquettes d'abord : écrans déclarés dans `src/design/ecrans.ts`, `pnpm planche`, validation du responsable avant le code (voir `METHODE.md` 2 bis).
- Couleurs, espacements, tailles : seulement dans `src/design/jetons.ts`.
- Mobile d'abord. Aucun mot technique visible (pas de « erreur 500 », « API », « token »…). Français simple.
- Barre latérale foncée, accent orange `#e8730c`.

## Si tu es bloqué
Écris la question dans `REPRENDRE.md`, passe `ETAT: ATTENTE-WILL` et arrête-toi.
