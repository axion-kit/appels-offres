# Ajouter une fonction IA à un outil

Règle d'or : **un outil vendu appelle l'IA avec une clé API, jamais avec le forfait.** La clé reste sur le serveur (réglage `ANTHROPIC_API_KEY`), jamais dans le navigateur. Modèle par défaut : `claude-sonnet-5-5` ; `claude-opus-5-5` seulement pour une tâche difficile ; jamais Haiku.

## Les étapes, dans l'ordre

1. **Écrire le jeu d'or d'abord** (20 à 50 cas, sans donnée de personne réelle) dans un fichier JSON (hors dépôt si les cas sont sensibles), sur le modèle de `src/lib/ia/jeu-d-or/exemple.ts` : la consigne, la forme de la réponse, un seuil, et pour chaque cas le texte d'entrée et la réponse attendue.
2. **Écrire d'abord les tests de la fonction** à côté du code, dans des fichiers `*.test.ts` sous `src/` : ils doivent échouer, puis passer. `pnpm ia:eval <fichier>` (sans fichier, il joue l'exemple) vérifie le montage du jeu avec une **fausse IA** (aucun appel réel, aucune clé). Elle réussit toujours si le jeu est bien formé ; elle ne prouve rien sur la qualité du modèle.
3. **Écrire la fonction** avec `creerAgent` (`src/lib/ia/agent-core.ts`) : consigne fixe, texte variable, schéma de sortie, `maxTokens` strict. Les tests (plafond, reprises, sortie refusée) existent déjà dans `src/lib/ia/` ; ajoutez les vôtres.
4. **Faire approuver le jeu par le responsable** avant toute mise en production. Le responsable relit les cas et choisit le seuil. **L'approbation n'est jamais écrite dans le dépôt** : l'empreinte approuvée (calculée par `empreinte()`) vient de la variable d'environnement `IA_EVAL_APPROUVE`, que le responsable fournit hors dépôt. Un champ `approuve` dans le fichier du jeu est retiré à la lecture et n'a aucun effet. L'empreinte couvre la version de la consigne (`version_prompt`), la consigne, la forme de la sortie, le seuil et les cas : si l'un change, il faut une nouvelle approbation.
5. **Essai avec la vraie IA** : `IA_EVAL_MODE=reel pnpm ia:eval <fichier>`, hors CI, avec la clé du client de test. Il refuse de partir sans clé ou sans `IA_EVAL_APPROUVE` à jour (`IA_EVAL_MODE=reel IA_EVAL_APPROUVE=<empreinte> pnpm ia:eval <fichier>`). Le taux doit rester au-dessus du seuil.

> Pour l'instant la CI ne lance pas `pnpm ia:eval` (le dossier `.github/` n'a pas été modifié) : seuls les tests `pnpm test` couvrent le jeu d'or. À ajouter dans une PR qui l'explique.

## Ce que fait `agent-core` pour vous

- **Plafond par client** : chaque client a un plafond de jetons (nombre fini, zéro ou plus ; NaN, négatif, infini ou absent : refus `plafond-absent`). Avant chaque envoi, le coût maximal est estimé au plus haut (octets UTF-8 de la consigne et du texte + marge fixe d'enveloppe + `maxTokens`) ; s'il dépasse le plafond, rien n'est envoyé. Les jetons sont réservés avant l'envoi (donc des appels simultanés ne dépassent pas le plafond), puis corrigés avec le coût réel. Si le coût réel dépasse la réservation, il est quand même enregistré, signalé dans le journal (`depassement`) et bloque les appels suivants. **Le plafond compte des jetons bruts, pas des euros** : un jeton de sortie d'un grand modèle coûte bien plus qu'un jeton d'entrée d'un petit ; fixe le plafond d'après le modèle le plus cher utilisé par l'outil.
- **Registre** (`RegistreDepense`) : obligatoire, asynchrone (`reserver` rend `Promise<boolean>`, `ajuster` rend `Promise<void>`). **Contrat d'un registre réel : `reserver` est UNE SEULE requête atomique**, par exemple `UPDATE depense SET total = total + n WHERE client = c AND total + n <= plafond` (une ligne modifiée = réservé). Jamais « lire puis écrire » en deux temps. La version en mémoire ne sert qu'aux tests.
- **Reprises** : sur « service très sollicité » (429, 529) ou autre refus explicite, la réservation de l'essai est rendue. Sur coupure du réseau ou délai dépassé, elle est **gardée** (l'appel a pu être facturé). Une réservation par essai (4 essais au plus).
- **Délais** : `delaiAppelMs` est le délai d'expiration d'un appel (défaut : 30 s + 30 ms par jeton de sortie permis) ; `delaiBaseMs` et `delaiMaxMs` règlent l'attente entre deux essais. Ce sont des réglages distincts.
- **Cache des consignes** : la consigne fixe est marquée pour le cache, ce qui coûte moins cher.
- **Sortie vérifiée** : la réponse doit correspondre au schéma, sinon elle est rejetée (et ses jetons restent comptés).
- **Journal** : modèle, version de la consigne, jetons, statut. Jamais le texte envoyé ni la réponse.
- **Traçabilité** : chaque réponse porte le modèle, la version de la consigne et la date.

## À savoir

- Le plafond Anthropic par client (espace de travail et clé, réglés sur le site d'Anthropic) reste le filet de sécurité réel ; le plafond de `agent-core` s'y ajoute.
- Ne mettez jamais de données de personnes dans la consigne fixe ni dans le jeu d'or.
- La fausse IA répond ce que le jeu attend : elle vérifie le montage et le calcul du taux, pas la qualité du modèle. Seule la vraie IA, approuvée, fait foi.
