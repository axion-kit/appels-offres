# Comptes utilisateurs et inscription

Ce gabarit sait créer des comptes, avec une inscription libre en option. La connexion est une **zone à risque** : toute modification passe par une relecture Opus (agent `relecteur`) et une PR sensible.

## Choisir le mode d'inscription

Dans `proprietes.yaml` (racine du dépôt), ligne `inscription:` :

| Valeur | Effet |
| --- | --- |
| `fermee` | Seul l'administrateur crée les comptes (formulaire « Administration » sur `/compte`). Aucune invitation ne peut être acceptée. |
| `sur_invitation` (défaut) | Un lien d'invitation (un seul usage, 7 jours) est nécessaire. L'administrateur invite une entreprise ; chaque propriétaire invite ses collègues. |
| `libre` | La page `/inscription` est publique. |

Le réglage est relu par le serveur à chaque demande. La route d'inscription **refuse côté serveur** quand le mode ne le permet pas : masquer un bouton ne suffit pas, et un test le prouve. Une valeur inconnue dans le fichier ferme les inscriptions.

`essai_jours:` règle la durée de l'essai offert à chaque nouvel espace (0 = sans limite). La date est enregistrée dans `essai_jusqu_au` (table `espace`). À l'expiration, l'écran dit « Votre essai est terminé, contactez-nous » et les données de l'espace ne sont plus servies.

**Aucun paiement en ligne.** L'inscription libre donne accès à l'outil (essai ou formule gratuite). Tout abonnement payant reste par devis et virement.

## Ce qui est garanti

- Mot de passe de 12 caractères au moins ; hachage fait par la librairie (better-auth). Connexion par adresse e-mail + mot de passe, ou par lien reçu par e-mail.
- Adresse e-mail **vérifiée avant toute utilisation** : tant qu'elle ne l'est pas, la connexion par mot de passe est refusée.
- **Pas de prise de compte préparée.** Quelqu'un pourrait inscrire l'adresse d'une victime avec son propre mot de passe, en espérant que la victime confirme. Pour l'éviter, à la **première vérification** d'un compte auto-inscrit (lien de confirmation **ou** lien de connexion par e-mail), le mot de passe choisi à l'inscription est **remplacé par un aléa** que personne ne connaît et **toutes les sessions du compte sont coupées**. La personne choisit son vrai mot de passe avec « Mot de passe oublié » (l'écran de confirmation le lui dit). Le mot de passe de l'attaquant ne marche plus par aucun des deux chemins ; un test le prouve. **Verrou de secours** : si la neutralisation échoue (panne de hachage ou de base) alors que l'adresse est déjà marquée vérifiée, la création de session refuse tout compte « vérifié mais jamais neutralisé » (`auto_inscrit` encore vrai). Le compte reste bloqué, pour tout le monde, jusqu'à ce que la vraie personne choisisse son mot de passe avec « Mot de passe oublié » : ce choix remplace l'ancien mot de passe et remet `auto_inscrit` à faux. Le parcours normal n'est pas touché : la neutralisation est finie avant toute création de session (lien de confirmation, ou lien de connexion).
- **Expiration sans effacement.** Un compte auto-inscrit jamais vérifié après 24 h est **désactivé** et marqué expiré (`expire_le`) ; aucune connexion ni aucun lien ne peut plus l'activer. Rien n'est effacé (compte, espace, consentements restent en base, règle du propriétaire). Son adresse est libérée (gardée dans `email_initial`, l'adresse du compte devient `expire-…@expire.invalid`) : une nouvelle inscription de la même adresse repart proprement avec un nouveau compte. Le balayage se fait à chaque inscription et à chaque tentative de connexion, et un lien de confirmation qui arrive après 24 h fait expirer le compte au lieu de l'activer, n'écrit rien dans le journal et affiche « Ce lien a expiré. Inscrivez-vous à nouveau. ».
- Inscription : message identique que l'adresse existe ou non (l'adresse déjà inscrite reçoit un avis) ; création du compte, de l'espace, des consentements (version et horodatage des conditions et de la confidentialité) et du journal en une seule opération.
- Limitation de fréquence par adresse IP et par adresse e-mail, en base (fenêtre glissante, pas en mémoire). Les adresses ne sont pas gardées en clair dans cette table.
- Protection contre les robots sans service externe : champ piège invisible + heure d'ouverture signée du formulaire avec délai minimal (3 s ; réglable par `COMPTES_DELAI_MIN_MS`).
- Isolation par espace : le contexte (espace, rôle) est lu côté serveur à partir de la connexion, jamais fourni par la page ; chaque lecture ou écriture de données porte l'espace. Un test prouve qu'un compte ne lit jamais les données d'un autre espace, même en connaissant l'identifiant.
- Un compte = un espace. Rôles : `proprietaire`, `membre`. Il reste toujours au moins un propriétaire.
- Invitations : code aléatoire (seule son empreinte est en base), usage unique garanti en base, durée limitée, liée à l'adresse invitée, annulable par le propriétaire.
- RGPD : la personne télécharge ses données (`/api/compte/export`) et demande la fermeture de son compte. La fermeture **désactive** le compte, coupe les connexions ouvertes, et prévient les administrateurs par e-mail ; **rien n'est effacé automatiquement**.
- Journal d'audit en base : inscription, vérification d'adresse, connexion, invitation, changement de rôle, export, fermeture.
- Les formulaires vérifient la provenance de la demande. Les adresses internes de la librairie sont fermées, sauf les trois liens reçus par e-mail.

Limites connues : le temps de réponse de la connexion par mot de passe peut différer légèrement selon que l'adresse existe (la librairie fait le même travail dans les deux cas, mais ce n'est pas mesuré) ; à l'inscription, le hachage est fait dans tous les cas, mais la création du compte (une transaction) se fait avant la réponse alors que l'avis à une adresse déjà inscrite part après : un écart de quelques millisecondes à dizaines de millisecondes peut en principe trahir l'existence de l'adresse (risque faible, atténué par les limites par adresse IP et par adresse e-mail ; non corrigé car déplacer la création après la réponse romprait la garantie « compte créé = réponse envoyée ») ; un lien reçu par e-mail s'ouvre par simple clic, donc un filtre antivirus de messagerie qui visite les liens peut le consommer (la personne en redemande un). Un lien de connexion utilisé sur un compte dont l'adresse n'était pas vérifiée retire le mot de passe et les connexions du compte (comportement de la librairie, que le gabarit double par sa propre neutralisation : l'adresse est alors prouvée, la personne choisit un nouveau mot de passe).

## Ce que l'outil doit brancher

Variables d'environnement (jamais dans le dépôt) :

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Adresse de la base Postgres. Les migrations (dans `src/lib/comptes/migrations.ts`) s'appliquent seules au démarrage, sous verrou. |
| `BETTER_AUTH_SECRET` | Clé secrète, 32 caractères au moins (obligatoire avec `DATABASE_URL`). Les autres clés (robots, limites) en sont dérivées. |
| `BETTER_AUTH_URL` | Adresse publique de l'outil, ex. `https://outil.exemple.fr` (obligatoire avec `DATABASE_URL`). |
| `COMPTES_ADMINISTRATEURS` | Adresses des administrateurs, séparées par des virgules. |
| `COMPTES_PROXY_FIABLE` | `oui` si l'outil est derrière un relais de confiance qui ajoute l'adresse du visiteur à la fin de `x-forwarded-for` ; `non` s'il n'y en a pas. Activé tout seul quand `VERCEL` est défini. **En production (`NODE_ENV=production`), sans ce réglage et hors Vercel, l'inscription libre est refusée** (message clair dans le journal du serveur). |
| `COMPTES_PLAFOND_INSCRIPTION_GLOBAL` | Facultatif : nombre d'inscriptions par heure, tous visiteurs confondus, quand l'adresse IP est inconnue (30 par défaut). |
| `COMPTES_INSCRIPTION` | Facultatif : remplace le mode du fichier (utile pour des essais). |

**Expéditeur réel.** L'envoi passe par l'interface `Expediteur` (`src/lib/comptes/expediteur.ts`, méthode `envoyer({ a, sujet, texte })`). Le gabarit fournit une implémentation console (journal du serveur) et une boîte en mémoire pour les tests. L'outil branche son service d'envoi dans `src/lib/comptes/services.ts` (remplacer `expediteurConsole`) ; la clé du service reste dans l'environnement.

**Base.** Avec `COMPTES_BASE=memoire` (et sans `DATABASE_URL`), une base Postgres en mémoire (pglite) sert aux essais et aux parcours automatiques ; elle disparaît à l'arrêt. Ne jamais l'utiliser en production. La boîte de test `/api/test/boite` n'existe que si `COMPTES_BOITE_TEST=oui`, sans `DATABASE_URL` et sans `VERCEL`.

**Textes.** `/cgu` et `/confidentialite` sont des pages de départ : l'éditeur y met ses vrais textes et change la version dans `src/lib/comptes/documents.ts` à chaque modification.

**Schéma.** `src/lib/comptes/schema.ts` décrit les tables ; `migrations.ts` les crée (un test vérifie que les deux concordent). `drizzle.config.ts` permet d'utiliser `drizzle-kit` (la génération écrit dans `.drizzle/`, ignoré par git : les fichiers `.sql` ne sont pas permis dans le dépôt, on reporte les changements à la main dans `migrations.ts` en ajoutant une nouvelle migration, sans modifier les anciennes).

## Pages

`/connexion`, `/inscription`, `/verifier-adresse`, `/invitation/[code]`, `/mot-de-passe-oublie`, `/compte`, plus `/cgu` et `/confidentialite`. Mobile d'abord, français simple, barre latérale foncée, accent orange `#e8730c`.

## Tester

`pnpm test` (règles, avec une vraie base Postgres en mémoire) et `pnpm e2e` (parcours inscription → vérification → connexion → invitation, à 390 px et sur ordinateur).

## Points d'attention pour l'outil

- **Expéditeur réel obligatoire** : avec `DATABASE_URL`, l'outil refuse de démarrer tant que `src/lib/comptes/expediteur-reel.ts` ne fournit pas un vrai service d'envoi (les liens ne doivent jamais être écrits dans un journal).
- **Adresse IP inconnue** : quand l'adresse du visiteur n'est pas connue (pas de relais de confiance réglé), la limite par adresse IP n'est plus ignorée : un **plafond global** s'applique à l'inscription (clé `inscription-global`, 30 par heure pour tous les visiteurs ensemble, réglable par `COMPTES_PLAFOND_INSCRIPTION_GLOBAL`). La limite par adresse e-mail reste active. `COMPTES_PROXY_FIABLE` est activé tout seul chez Vercel ; en production ailleurs, sans réglage explicite (`oui` ou `non`), l'inscription libre est refusée et le journal du serveur dit pourquoi.
- La limite de connexion par adresse e-mail (8 essais par 15 minutes) compte aussi les réussites : quelqu'un peut gêner la connexion d'une personne en tapant son adresse ; le lien de connexion par e-mail reste possible.
- Une invitation n'est valable que si la personne qui l'a envoyée est toujours propriétaire active de l'espace.
- La boîte de test n'est protégée que par des réglages (base en mémoire + `COMPTES_BOITE_TEST=oui` + pas de `VERCEL`) : ne jamais les poser sur un serveur public.
