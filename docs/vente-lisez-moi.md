# Paquet première vente

Modèles à trous pour vendre un outil construit avec ce gabarit. **Ce dossier est public : n'y écris jamais un nom de client, de personne, une adresse, un montant réel ni un secret.**

## Comment ça marche
1. `docs/vente-*.md` : les modèles vierges (ne les remplis pas ici).
2. Copie-les dans `vente/remplis/` (le préfixe `vente-` est accepté ou à retirer, au choix : `vente-01-fiche-produit.md` ou `01-fiche-produit.md`) (dossier ignoré par git, il ne part jamais dans le dépôt public) et remplace chaque `[À REMPLIR : …]`.
3. Remplis d'abord `formulaire-mise-en-service.md` : c'est la page unique qui donne tout ce que le kit doit savoir.
4. Lance `pnpm vente:verifier` : il refuse tant qu'un trou reste ou qu'un document manque.
5. Les parties marquées **[À FAIRE RELIRE PAR UN PROFESSIONNEL]** ne sont jamais finales sans cette relecture. Ces modèles ne sont pas un avis juridique.

## Les trois formules
- **Abonnement** : le client paie chaque période.
- **En une fois** : le client paie une seule fois.
- **Mise en service + abonnement** : frais de départ, puis abonnement.

Les modèles couvrent les trois ; supprime les lignes de la formule non choisie. Aucun montant n'est écrit ici : tu les fixes toi-même.
