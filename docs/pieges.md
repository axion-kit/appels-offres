# Pièges connus et leur correctif

À relire avant de lancer une vague de fiches.

| Piège | Cause | Correctif |
|---|---|---|
| Contrôle de mutation rouge partout | Le job mute trop de code et dépasse sa limite de temps | Limiter la mutation au code sensible (calculs d'argent, droits, données) et laisser le reste hors du périmètre de mutation |
| Test d'interface instable | Le test clique avant que le bouton existe (la zone est remplacée par « chargement ») | Attendre un élément réel, jamais un délai fixe |
| Contrôle des secrets rouge malgré le correctif | Il lit chaque commit : l'ancien commit garde le faux secret | Recréer la branche avec un seul commit propre (sans force-push sur la branche principale) |
| PR trop grosses | Les auteurs ne mesurent pas la taille | Mesurer avant de pousser ; séparer le code et la clôture |
| Tests raccourcis pour tenir la taille | Pression de la limite | Interdit de supprimer un test : compacter, ou séparer en deux PR |
| Garde « terminé » rouge | Tests exigés mais aucun fichier de test autorisé | Corriger la fiche (`pnpm pilotage:lint` le voit avant) |
| Contrôles relancés en boucle | Mise à jour inutile des branches à chaque changement de la principale | Ne mettre à jour une branche que pour un conflit |
| Octet NUL dans un fichier | Création de fichier par here-doc | Utiliser les outils d'écriture et d'édition |
| Chemin déformé sous Git Bash | `git show origin/main:chemin` converti par MSYS | `MSYS_NO_PATHCONV=1` |
| Fichiers de test non reconnus | Un nom comme `suite-*.ts` n'est pas vu comme test | Nommer les tests `*.test.ts` ou `*.test.tsx` |
| Avis de relecture perdu | Branche d'avis supprimée trop tôt | Relancer la relecture du groupe |
| Vague sans relecteurs | Sans avis, rien n'est fusionné et les PR attendent | Chaque vague d'auteurs part avec sa vague de relecteurs |
| Coût qui explose | Contexte long × nombreux tours | Une tâche par session, lire par extraits, Opus pour concevoir et relire, Sonnet pour le reste |
