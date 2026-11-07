# Audit des workflows GitHub Actions et des dépendances (L12b)

Workflow : `.github/workflows/audit.yml` (pull_request, push sur main, workflow_dispatch ; permissions `contents: read`, `persist-credentials: false`, 10 min, actions épinglées par SHA). Il exécute dans cet ordre : actionlint, zizmor, `pnpm audit --prod=false --audit-level=high`.
Repris de `kit-pilote-source` ; seule l'étape de tests change : le gabarit utilise pnpm, pas `node --test`. Les tests restent dans `ci.yml`.

## Outils et versions

| Outil | Version | Vérification |
|---|---|---|
| actionlint | 1.7.12 | archive `actionlint_1.7.12_linux_amd64.tar.gz`, sha256 `8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8`, vérifiée en dur dans le workflow (et recontrôlée au téléchargement local) |
| zizmor | 1.32.0 | `pip install --require-hashes --only-binary=:all:` avec `.github/audit/zizmor-requirements.txt` (sha256 `84a6acb9…562071`) |
| actions | checkout v7.0.1 (`3d3c42e5…`), setup-node v7.1.0 (`949feb24…`) | SHA relus avec `git ls-remote --tags` |

`zizmor --offline` ne fait aucun appel réseau : les audits qui interrogent GitHub sont désactivés (compromis assumé, aucun jeton dans ce job).

## Alertes trouvées sur `ci.yml` et corrections

| Outil | Alerte | Décision |
|---|---|---|
| actionlint 1.7.12 | aucune | rien à corriger |
| zizmor 1.32.0 (persona par défaut) | aucune | rien à corriger |
| zizmor (persona pedantic, non utilisée en CI) | `anonymous-definition` (info) sur le job `verifier` | Non corrigée : ajouter `name:` renomme le contrôle `verifier` ; ce nom peut être exigé par la protection de branche. Information seulement |

Aucun contrôle de `ci.yml` n'a été modifié, affaibli ni retiré. Une seule modification de `ci.yml`, nécessaire pour ajouter `renovate.json` : le nom `renovate\.json` est ajouté à la liste blanche des fichiers racine suivis par git (sinon l'étape « Liste blanche » refuserait le fichier). Rien d'autre dans la liste n'a changé.

## Dépendances : failles corrigées

`pnpm audit --prod=false` : de 12 alertes (2 critiques, 2 hautes, 8 moyennes) à 0.

| Paquet | Avant | Après | Moyen |
|---|---|---|---|
| vitest | 3.2.7 | 4.1.12 | dépendance directe (`^4.1.12`) |
| @vitest/coverage-v8 | 3.2.7 | 4.1.12 | dépendance directe (`^4.1.12`) |
| @vitest/mocker (indirecte) | 3.2.7 | 4.1.12 | via vitest |
| tinypool (critique, indirecte) | 1.1.1 | — | supprimé de l'arbre par vitest 4 |
| postcss (haute, indirecte de next) | 8.4.31 | 8.5.32 | `pnpm.overrides` `next>postcss` (next 15.5.29 fixe 8.4.31) |
| glob et test-exclude (indirectes) | 10.x | — | supprimés de l'arbre par vitest 4 |
| minimatch (indirecte de typescript-estree) | 9.x / 10.x | 11.0.5 | `pnpm.overrides` `@typescript-eslint/typescript-estree>minimatch` |

Les remplacements sont **ciblés** (par paquet parent) : un remplacement global de minimatch par la version 11 casse ESLint (`@eslint/eslintrc` attend l'ancienne forme d'export).
Vérifié : `pnpm tsc --noEmit`, `eslint . --max-warnings=0`, tests, build et e2e verts après les changements.
À retirer quand les paquets parents publient une version corrigée (revoir à chaque lot Renovate).

## Renovate

`renovate.json` : une PR hebdomadaire groupée (lundi avant 6 h, Europe/Paris), `minimumReleaseAge` de 7 jours, `helpers:pinGitHubActionDigests`, `automerge: false` et `platformAutomerge: false`. L'application Renovate doit être installée sur le dépôt. Ses PR touchent `package.json` et `.github/**` : elles passent par le responsable.

## Raison des fichiers sensibles touchés (CLAUDE.md)

`package.json`, `pnpm-lock.yaml`, `.github/**` et `renovate.json` sont des zones sensibles. Ils sont modifiés ici à la demande expresse de la tâche planifiée L12b (failles de dépendances, audit des workflows, Renovate). Revue : PR #8.
