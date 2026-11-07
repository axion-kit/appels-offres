---
id: L01-T01
titre: Titre court de la fiche
lot: 1
statut: a_faire
depend_de: []
fichiers_autorises: [src/lib/exemple.ts, src/lib/exemple.test.ts]
taille_max_lignes: 150
tests_requis: oui
sensible: non
exigences: [R1]
---

# L01-T01 Titre court de la fiche

Copier ce fichier en `LNN-Tmm.md` (même id que dans l'en-tête), puis remplir.

- `statut` : `a_faire` ou `fait`. Passer à `fait` seulement avec le journal et les dépendances faites.
- `depend_de` : liste d'ids, par exemple `[L01-T01, L01-T02]`.
- `fichiers_autorises` : la liste exacte (`*` et `**` permis). La fiche et son journal sont toujours permis.
- `taille_max_lignes` : lignes ajoutées + supprimées, tests, fiche et journal compris.
- `tests_requis` : `oui` ou `non`. Si `oui`, un fichier de test doit être autorisé.
- `sensible` : `oui` pour l'argent, la sécurité, les données (relecture plus stricte).
- `bloque_par` (facultatif) : une décision que seul le responsable peut prendre ; la fiche n'est alors pas proposée.

## Ce qu'il faut livrer
Un résultat testable, en une phrase.

## Cas limites à tester
NaN, Infinity, nombres non entiers, listes vides, ordre inversé : ne garder que ceux qui comptent ici.

## Branche et PR
Branche `lot-01/L01-T01`. Titre de PR « L01-T01 Titre court ». Corps : « Fiche: L01-T01 » et les exigences visées.
