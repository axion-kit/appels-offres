# Rapport de C1 : branches socle (08/11/2026, 06 h 26 à 06 h 55 UTC)

Base de toutes les branches : `origin/main` = `3c12178` (gabarit). Console lue (lecture seule) : `b6c66c5`, `packages/contrats/VERSION` contient `c4=0.5.0`, versions des `package.json` identiques au tableau de P1. Branche `arret` absente au départ. Node 22.23.4, pnpm 10.28.0.
Chaque branche : **un seul commit**, terminé par la ligne `Co-Authored-By`, poussé par `git push -u origin <branche>` (aucun force-push, rien sur `main`, aucune PR ouverte).
Empreinte = `git diff $(git merge-base origin/main <tête>) <tête> | git patch-id --stable`.
Contrôles de texte sur chaque fichier texte touché : `p7-mots-interdits.mjs` à 0 (sauf P1c, écart 3) ; recherche des 6 noms interdits : 0 partout ; garde des mots de la CI (`skip|only|todo|fixme|fails?…`) : 0 dans les fichiers de code touchés.
Suites de tests lancées une à la fois. Les durées sont celles de cette machine.

## 1. Tableau des branches

| Branche | Tête | Empreinte | Fichiers | Vérifiée sur |
|---|---|---|---|---|
| `socle-P1` | `e06068f84688c99b08256382c49c9d4ac36d975d` | `984a25e6da3b5c894c715c1ee29c0f9b62f9e48e` | `package.json`, `pnpm-lock.yaml`, `eslint.config.mjs`, `tsconfig.json`, `next-env.d.ts`, `vitest.config.ts` (+1498 −128) | la branche seule |
| `socle-P2` | `ca34495a9d038804c6b7ad7b16bf36deaed19c55` | `d3edb7a7ab424ef83f07b48ee5e53cdf6a0cd09f` | `playwright.config.ts`, `next.config.ts`, `drizzle.config.ts` (+27 −4) | copie jetable P1 + P2 |
| `socle-P3` | `4461ea7256ef06ced4c0f90df1ccbc454c2c3f8d` | `b1973857c98318761b1719f1b1aa6ffd225c2b89` | `.github/workflows/ci.yml` (+72 −17) | la branche seule |
| `socle-P4` | `23b6c1747f55056d2bff0345b1023b01ce1a60c1` | `79537084d12dba4def06f53621a090af3f52f565` | `CLAUDE.md`, `REPRENDRE.md`, `docs/pieges.md` (+16 −1) | la branche seule |
| `socle-P1c` | `9498f27c5507d8b396a69757b8721aecfed1f8a6` | `81161f46e475f3f469519fd68918bb06cdcbaf41` | 22 fichiers sous `src/lib/console/contrat-c4/` et `src/lib/console/contrat/` (+1382) | copie jetable P1 + P3 + P1c |
| `socle-P5` | `92c461355b1b531f0e211357215f3c39bbb4277f` | `7f94a1c7864e8678633c1b0d2bc33e37149531d1` | 10 `.woff2` + 4 `*-LICENSE-OFL.txt` sous `public/polices/` | la branche seule |
| `socle-P6` | `431ee11e1fddf7a22cf33b3c8806913068026597` | `db872ba10ad9192af0096c529da4aec2e20615b7` | `.github/workflows/preuves-reseau.yml`, `.github/preuves/lire.mjs` (+169) | la branche seule (+ eslint de P1 sur `lire.mjs`) |
| `socle-PF` | `dd6d55976c6861a134e4cf4768c06f9149882689` | `121fc58d4a58d9f8b41cd69c49aea4293cc54099` | `.github/scripts/regles-de-fer-titres.txt`, `.github/scripts/regles-de-fer-titres.mjs`, `.github/workflows/ci.yml` (+349) | la branche seule et copie jetable P1 + P3 + PF |
| `consignes/chef` | `80621d67fa200b8e1b39f8849e019f0766f42a33` | — | `CONSIGNE-CHEF.md` (205 lignes) | — (branche de lecture, sans PR) |

Les copies jetables (P1 + P2, P1 + P3 + P1c, P1 + P3 + PF) n'ont jamais été poussées : chaque branche poussée part de `origin/main` et ne contient que ses propres fichiers.

## 2. Commandes et résultats, par branche

**socle-P1** : `pnpm install --no-frozen-lockfile` 8,7 s ; `pnpm install --frozen-lockfile` code 0, 1 s ; `pnpm tsc --noEmit` 0 erreur, 5 s ; `pnpm exec eslint . --max-warnings=0` 0 problème, 4 s ; `pnpm test` **242/242**, 28 fichiers, 46 s, couverture lignes 96,24 %, branches 91,96 % ; `pnpm build` code 0, Next.js 16.4.3, **18 pages**, 15 s ; `git status` après le build : seulement les 6 fichiers ; `git diff vitest.config.ts` : 2 lignes ajoutées (`testTimeout: 20_000`, `hookTimeout: 30_000`), 0 retirée ; `pnpm audit --prod=false --audit-level=high` code 0 (1 modérée) ; aucune version avec `^`. Avertissement pnpm « Ignored build scripts : esbuild, msgpackr-extract » : normal, rien ajouté.
**Empreinte du verrou** (`sha256sum pnpm-lock.yaml`) : `5814fd5588635274b77109ab7afe998487d7ab20b20ddf7eb6b99b92743418d2` (le document citait `ed8db1f8…0d7` au banc : le registre a bougé, versions directes identiques au tableau).

**socle-P2** (sur P1 + P2) : install figé code 0 ; tsc 0, 5 s ; eslint 0, 4 s ; test 242/242, 44 s ; build code 0, 13 s ; `CI=1 pnpm e2e` **20/20**, 18 s (navigateur de révision 1243 servi sous le nom 1248 par `PLAYWRIGHT_BROWSERS_PATH` vers des liens, sans installation ; premier essai sans ce réglage : navigateur introuvable) ; `curl -sI` sur `pnpm start` : les **5 en-têtes** présents, aucun `X-Powered-By` ; `git status` propre.

**socle-P3** (branche seule) : install figé, tsc 0, eslint 0, test 242/242 (44 s), build code 0 (33 s), `git status` propre ; `pnpm ia:eval` (fausse IA, `IA_EVAL_MODE` vide) : 3/3, RÉUSSI, 1 s. Diff des lignes `run`, `uses`, `name` : seulement des ajouts (`pnpm ia:eval`, « Jeu d'or… », « Tous les jobs sont verts ») et un nom de l'étape e2e enrichi de la moitié ; mêmes 3 actions aux mêmes empreintes (checkout `11d5960…`, setup-node `49933ea…`, pnpm `b906aff…`) ; même gitleaks 8.30.1 et même somme ; mêmes deux `jq`. Lecture du diff complet : aucune étape retirée ni assouplie ; le job des gardes passe de 15 à 10 min (plus strict) et ne garde pas `pnpm/action-setup` (aucune de ses étapes n'appelle pnpm). **actionlint : NON DISPONIBLE** dans cette session (téléchargement du binaire refusé) ; YAML relu par un analyseur : 4 jobs (`gardes` 6 étapes, `unitaires` 9, `bout-en-bout` 7, `verifier` 1).

**socle-P4** (branche seule) : install figé, tsc 0, eslint 0, test 242/242 (44 s), build code 0 (27 s), `git status` : les 3 fichiers seulement ; bloc du haut de `REPRENDRE.md` : 29 lignes (< 40) ; textes repris mot pour mot du document, posés avec l'outil d'édition.

**socle-P1c** (sur P1 + P3 + P1c) : `p7-figer-c4.sh` : « C4 0.5.0 figé depuis b6c66c5 : 3 fixture(s), empreintes identiques » ; `--sdk` : 9 fichiers copiés ; `sha256sum` des 9 fichiers = `SDK_FIGE` (**9/9**) ; tsc 0, 6 s ; eslint 0, 4 s ; premier `pnpm test` : 244/244 mais **code 1**, couverture des branches 78,22 % < 80 % (prévu par le document) ; après ajout de 3 tests (écart 2) : **247/247**, 45 s, branches **80,27 %**, lignes 88,06 % ; build code 0 ; garde des mots de la CI sur la copie : 0.

**socle-P5** (branche seule) : `npm pack @fontsource/{manrope,inter,inconsolata,fraunces}@5.3.0` 3 s ; **10/10 empreintes identiques** à la liste du document (section 4) ; 4 fichiers LICENSE ; liste blanche `public/` (`.woff2`, `.txt`) : acceptée ; install figé, tsc 0, eslint 0, test 242/242 (45 s), build code 0 (27 s).

**socle-P6** (branche seule) : install figé, tsc 0, eslint 0 (aussi avec la configuration de P1), test 242/242 (48 s), build code 0 (29 s) ; `node --check` ; source inconnue : code 2. Essai sur faux serveur local (copie jetable du script, hôtes remplacés) : 3 requêtes, écarts **1015 ms et 1004 ms**, `User-Agent` qui nomme l'outil, robots lu d'abord, un `429` arrête la lecture (« NON PROUVÉ — refus de lecture automatique »), le résumé ne contient **aucune valeur du corps** (0 occurrence des valeurs pièges), seulement les noms de champs ; hôte injoignable : « NON PROUVÉ — robots.txt non lu … aucune page lue ». Workflow : `workflow_dispatch` seul, entrée `source` à choix fermé (boamp, ted, place, robots), `permissions: contents: read`, aucun `secrets.`, `timeout-minutes: 10`, checkout `persist-credentials: false`, mêmes actions épinglées que `ci.yml`, entrée passée par `env`. **actionlint : NON DISPONIBLE.**

**socle-PF** : liste régénérée par la commande du document : **270 titres, 94 fiches, 171 « [fer n] »** (sur 335 fiches ; le document disait 267, 93 et 169 vers 05 h). `node .github/scripts/regles-de-fer-titres.mjs` : code 0 (« 270 titre(s) protégé(s), 0 … contrôlé(s), 0 problème(s) »). Essai à la main sur une copie jetable : L01-T01 passée à `statut: fait` sans test → **code 1** (2 titres absents) ; un test avec les 2 titres dont un marqué coupé → **code 1** ; marque retirée → **code 0**. Branche seule : install figé, tsc 0, eslint 0, test 242/242 (48 s), build (28 s), `node --test .github/scripts/*.test.mjs` 35/35, `lint-fiches.mjs` 0 problème ; sur P1 + P3 + PF : le cherry-pick passe sans conflit, l'étape tombe dans le job `gardes` (entre la garde des mots et la garde de périmètre), tsc 0, eslint 0, test 242/242 (47 s), build code 0. **actionlint : NON DISPONIBLE.**

## 3. Écarts au document et pourquoi

1. **P2, noms `AO_*`** : aucune des fiches L01-T01, L01-T21, L05-T02, L01-T38 (ni L01-T25, L07-T23) ne nomme `AO_IA`, `AO_CONSOLE`, `AO_HORLOGE` ou `AO_RESEAU_EXTERIEUR`. Les seules variables `AO_` des fiches sont `AO_MODE` (L01-T57, `autonome` par défaut), `AO_JEU_JETONS` (L00-T25) et `AO_CLE_CURSEUR`. Rien ne dit « autrement » : les 4 noms du document sont gardés, **NON CONFIRMÉS**, sans effet tant qu'aucune fiche ne les lit. À aligner quand une fiche les nommera (petite PR sensible).
2. **P1c, couverture** : la copie fait tomber les branches à 78,22 %. Remède prévu par le document : 3 tests ajoutés à `compatibilite.test.ts` (`controlerPaquet` et `controlerLecture` sur les fixtures de cellules, forme unique de la clé, bornes de `Retry-After`), aucun fichier exclu. Marge faible : 80,27 %.
3. **P1c, mots** : `p7-mots-interdits.mjs` sort 11 occurrences d'un mot de sa liste, toutes dans l'identifiant technique du type d'effet externe que chaque connecteur déclare (`effets.ts`, `connecteurs.ts`, `contexte.ts` de la copie), sans rapport avec une promesse commerciale. Copie empreintée, jamais modifiée à la main : non corrigeable ici. Les commentaires copiés citent aussi des numéros de règles de la console (déjà publics dans le dépôt public de la console).
4. **P4** : une ligne vide ajoutée avant les deux puces de `docs/pieges.md` (sans elle, les puces collent au tableau).
5. **P5 et P1** : licences non notées dans `SPEC.md` (SPEC est porté par `socle-spec`) : à faire dans une PR du SPEC.
6. **P6, adresses** : les fiches L00-T18 à L00-T20 n'écrivent aucune adresse ; la liste fermée reprend les adresses publiques du registre des sources (L03-T39, lignes 1 à 5 : pages BOAMP, TED et sa documentation de recherche, PLACE). Les points d'accès des API eux-mêmes ne sont dans aucune fiche : ils s'ajoutent par PR sensible quand la fiche de preuve les écrit. Le résumé est aussi imprimé dans le journal du job (même contenu, sans corps).
7. **PF, place de l'étape** : sur `main`, le job `gardes` n'existe pas encore (il vient de P3) : l'étape est ajoutée dans le job unique de `main`, juste après la garde des mots ; après P3, la mise à jour de la branche la range dans `gardes` sans conflit (vérifié). Le script est lancé depuis la tête de la PR, comme l'écrit le document (pas depuis la base comme `perimetre.mjs`) : le modifier touche `.github/**`, donc la porte. Limites : un titre doit être écrit entre deux guillemets identiques, sur la même chaîne ; une marque posée sur un `describe` n'est pas vue par le script (la garde des mots de la CI la refuse déjà) ; les mots coupants sont écrits avec une classe de caractères pour passer la garde des mots.
8. **Commandes en arrière-plan** : deux processus courts (serveur `next start` pour le `curl` de P2, faux serveur local de P6), arrêtés aussitôt.

## 4. Empreintes des polices (`public/polices/`, @fontsource 5.3.0)

```text
849290ef12a2eeb9af5c11924120d11aa4ae8b435ed3347d7fc8bc240c293ca3  manrope-latin-400-normal.woff2
d2a12c85a831e4b5db341767d0347fa3d1361d22a1fcb3e361a16b6c90080f71  manrope-latin-700-normal.woff2
74c161dbcbce7c3590803cc72dc1f63313c360e13367aba5075a7b7b3818ea49  manrope-latin-800-normal.woff2
8909904ab6c872eb994093482a88a28eca2cd95912d7b6fecd72103b0dc07edc  inter-latin-400-normal.woff2
f9a06e79cd3a2a20951c0f0e28f66dd0e6d3fda73911d640a2125c8fcb78f21a  inter-latin-600-normal.woff2
6f56409fd3d64bb85f7d070bce20749db2d66b6d63cec586cc22d1c761be2491  inter-latin-700-normal.woff2
9d5a0480d2bd3e43b124bf8f36782c8fc079f9f8b023c672bff67e9ceffc236b  inconsolata-latin-400-normal.woff2
a9d822c4d749ab072f3715224311da3c8302b070a8df41d477090c145a361017  inconsolata-latin-700-normal.woff2
f7bb788a9bd23361b409404dc5416284ead3c969bfa6816c6e3292617f298e44  fraunces-latin-500-italic.woff2
3a1de7711d147bad4422825045f87597fd77cca72e7c96d3b0a81735d00dda82  fraunces-latin-600-normal.woff2
```
10 sur 10 identiques à la liste du document.

## 5. NON PROUVÉ

- La CI GitHub d'aucune branche (aucune PR ouverte) : c'est elle qui compte, en particulier 242/242 de P1 sur les machines de la CI, les 4 jobs de P3 et `audit.yml` (actionlint, zizmor) sur P3, P6 et PF.
- actionlint et zizmor : non lancés ici.
- e2e avec le navigateur exact 1248 (essayé avec 1243) ; e2e de P1c, P5, P6 et PF non lancés (aucun écran touché).
- Lecture réseau réelle de P6 (réseau de la session fermé : « réseau injoignable ») : à prouver par un lancement manuel du workflow par D.
- Couverture de P1c sur la CI (marge de 0,27 point).
- Comportement de chaque branche une fois mise à jour par le portier sur un `main` qui a déjà reçu les précédentes (seuls les empilements P1 + P2, P1 + P3 + P1c et P1 + P3 + PF ont été essayés).

## 6. Ordre conseillé de passage en « prête »

1. `socle-P1` (les autres en dépendent : Next 16, ajv, pdfjs-dist) ;
2. `socle-P3` (jobs `gardes`, `unitaires`, `bout-en-bout`) ;
3. `socle-P2` (vérifiée sur P1 ; e2e 20/20) ;
4. `socle-P4` ;
5. `socle-P1c` (sur P1 et P3 ; touche `src/lib/console/**` : brouillon renforcé, contre-avis C3 à la même empreinte) ;
6. `socle-P5` ;
7. `socle-P6` (peut passer juste après P3 pour lancer plus tôt les preuves L00) ;
8. `socle-PF` (après P3, avant le paquet B).
Une seule à la fois, à jour avec `main`, avis Opus et contre-avis C3 à l'empreinte du diff actuel, CI verte. Le document gardait l'ordre P1 → P2 → P3 ; P3 avant P2 est conseillé ici parce que P1c et PF ont été vérifiées sur P1 + P3.
