# Page d'avancement

Chaque outil a une page publique, toujours à jour, lisible sur téléphone, sans intelligence artificielle : elle est calculée par un petit programme à partir du dépôt.

## Où est la page
`https://<organisation>.github.io/<outil>/`

Les mêmes chiffres sont dans `https://<organisation>.github.io/<outil>/avancement.json` (pour qu'une console regroupe un jour tous les outils).

## Ce qu'elle montre
- le pourcentage d'objectifs (exigences R1..Rn de `SPEC.md`) faits, et vérifiés sur téléphone ;
- une barre par version (MVP, V2, V3) ;
- les changements fusionnés par jour, ceux en attente, et l'état des contrôles automatiques ;
- une fin estimée selon trois rythmes (prudent, moyen, rapide) ;
- un bandeau très visible si une réponse du propriétaire est attendue (`ETAT: ATTENTE-WILL`, avec la question) ou si les contrôles de la version principale sont rouges.

## Comment elle se met à jour
Le travail `avancement` (`.github/workflows/avancement.yml`) tourne à chaque fusion sur `main`, toutes les heures (17e minute) et à la main (onglet Actions > avancement > Run workflow). La page se rafraîchit seule toutes les 5 minutes.

Sources lues : `SPEC.md`, le bloc du haut de `REPRENDRE.md`, et GitHub (changements ouverts et fusionnés, dernier contrôle de `main`). Sans accès à GitHub, ces parties s'affichent « indisponible ».

## État des exigences (à tenir à jour)
Sous chaque exigence de `SPEC.md`, une ligne : `- État : à faire | en cours | fait | recetté`.
Sans ligne, l'exigence est « à faire ». « fait » = code fusionné ; « recetté » = vérifié sur téléphone (recette). La session autopilot met cette ligne à jour dans la PR du lot (voir `METHODE.md`).
**Règle : la page est publique : jamais de nom de client, de montant ni de faille dans l'objectif, la prochaine action ou la question ; renvoyer vers une issue si besoin.**
Par sécurité, quand le dépôt n'est pas public (variable `DEPOT_PUBLIC` différente de `true`, ou absente), ces trois textes sont remplacés par des phrases fixes (« Une réponse du propriétaire est attendue », bandeau gardé), dans la page et dans le JSON. La page demande aussi aux moteurs de recherche de ne pas l'indexer.
Pour la question en pause : ligne `**Question pour le responsable :**` dans le bloc du haut de `REPRENDRE.md`.

## Essayer en local
```
node outils/avancement/generer.mjs      # écrit _site/index.html et _site/avancement.json
node --test outils/avancement/avancement.test.mjs
```
Avec `GITHUB_TOKEN` (lecture) et `GITHUB_REPOSITORY=organisation/outil`, les parties GitHub sont remplies.

## Activer GitHub Pages
Automatique à la création d'un outil (voir plus bas). À la main : Réglages du dépôt > Pages > Source : **GitHub Actions**. Ou :
```
gh api -X POST repos/<organisation>/<outil>/pages -f build_type=workflow
```
Tant que Pages n'est pas activé, le travail affiche un avertissement (« Page d'avancement non activée ») et ne publie rien, sans échouer. Le gabarit `kit-modele` lui-même ne publie pas de page (les deux travaux sont ignorés).

## Changement à faire dans le script de création (dépôt kit-pilote-source, non modifié ici)
Fichiers : `src/creer-projet.mjs` et `src/client-createur.mjs`.
1. Dans `creerDepot`, après la pose de la protection et la vérification de l'arbre (étape 3, avant la branche `etat`), ajouter :
   `await api.ecrire('POST', `${d}/pages`, { build_type: 'workflow' });`
   (une réponse 409 « déjà activé » est à tolérer ; toute autre erreur interrompt la création avec un message clair).
2. Dans `listeBlancheCreation`, ajouter la ligne `['POST', exact(`${d}/pages`)]`.
3. Le jeton de l'application « créateur » doit avoir la permission dépôt « Pages : écriture ».
4. Ajouter un test dans `tests/` : la création appelle `POST /repos/{org}/{nom}/pages` avec `build_type: workflow`.
Le premier déploiement a lieu à la première fusion sur `main` du nouvel outil (ou par lancement manuel).
