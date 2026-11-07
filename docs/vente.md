# La première vente, de bout en bout

Ce guide explique, pas à pas, comment vendre un premier outil. Les modèles sont dans `docs/vente-01-…` à `docs/vente-10-…`. Ils ne sont pas des avis juridiques : tout ce qui est marqué **[À FAIRE RELIRE PAR UN PROFESSIONNEL]** doit passer par un professionnel avant d'être utilisé.

## 1. Choisir la formule
- **Abonnement** : le client paie chaque période.
- **En une fois** : un seul paiement.
- **Mise en service + abonnement** : des frais de départ, puis l'abonnement.

Les montants, c'est toi qui les fixes, après avoir mesuré ce que l'outil coûte vraiment. Rien n'est écrit d'avance dans le kit.

## 2. Remplir la page unique
Copie `docs/vente-formulaire-mise-en-service.md` dans `vente/remplis/` et remplis-la une fois. Elle dit au kit tout ce qu'il doit savoir. Ne mets jamais de mot de passe ni de clé dedans : seulement où ils sont rangés.

## 3. Voir les professionnels (avant de signer)
- Un avocat : conditions de vente, contrat sur les données, plafond de responsabilité.
- Un courtier : assurance, avec l'IA déclarée par écrit. Contrat signé obligatoire avant de vendre.
- Un expert-comptable : TVA et facturation, avant la première facture.

Demande à chacun d'écrire jusqu'où va son avis : cela évite de le reconsulter pour rien.

## 4. Préparer les documents
Copie chaque modèle de `docs/vente-01-…` à `docs/vente-10-…` dans `vente/remplis/`, puis remplace chaque `[À REMPLIR : …]`. Les dix documents : fiche produit, devis, conditions de vente et d'utilisation, mentions légales, confidentialité et registre, contrat de sous-traitance, accueil du client, export et sortie, suspension, conservation.

Le dossier `vente/remplis/` n'est pas envoyé dans le dépôt public. Aucun nom de client n'y est publié.

## 5. Lancer le contrôle
```
pnpm vente:verifier
```
Il refuse tant qu'un trou reste ou qu'un document manque, et te dit lesquels. Il prévient aussi si une partie est encore marquée « à faire relire ». Avec `pnpm vente:verifier -- --relecture-obligatoire`, ces parties deviennent bloquantes : à utiliser quand les professionnels ont tout relu (et que tu as retiré les marques).

## 6. Envoyer le devis
Envoie le devis avec les conditions de vente, la confidentialité et le contrat sur les données. Garde la date d'acceptation de la version des conditions.

## 7. Accueillir le client
Suis `07-accueil-client` : toutes les cases cochées avant d'ouvrir l'accès. Vérifie toi-même une sauvegarde et une restauration d'essai avant l'ouverture. Le clic de mise en service reste le tien.

## 8. Ensuite
- Contrôle au bout de 7 jours.
- **Si le client veut une copie ou part :** `08-export-sortie`. Rien n'est supprimé sans confirmation écrite ou échéance prévue.
- **Si un paiement manque ou si l'usage pose problème :** `09-suspension`. Les données restent intactes.
- **Durées de garde :** `10-conservation`.

## Rappel
Paiement : par virement à réception de facture ; pas de paiement en ligne. La TVA est toujours facturée, jamais d'exonération écrite.
Jamais de faux avis, faux logos ou faux chiffres de clients sur la vitrine ou la fiche produit.
Ce dossier est public : jamais de nom de client ou de personne, de montant réel ni de secret dedans.
