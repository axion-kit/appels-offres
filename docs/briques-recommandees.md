# Briques recommandées (Top 10 du kit)

Source : `docs/recherche-depots-publics.md` du dépôt `kit-pilote-source` (recherche du 07/11/2026). Toutes les briques ci-dessous sont en TypeScript/JavaScript, aucune n'est un outil sans code.

**Règles d'emploi.** Avant d'ajouter une brique : l'écrire dans `SPEC.md` (réutiliser / s'inspirer / écrire, avec lien et licence), puis passer par une PR sensible (`package.json`), donc par le responsable. On épingle la **version exacte** (sans `^`), le verrou `pnpm-lock.yaml` reste gelé, et Renovate propose les mises à jour chaque semaine (7 jours d'ancienneté minimum). Les versions ci-dessous sont les dernières publiées au 07/11/2026 : **à re-vérifier au moment de l'ajout** (`npm view <paquet> version`), puis épingler.

## Tableau

| Brique | Version à épingler | Pourquoi | Quand l'utiliser |
|---|---|---|---|
| **pg-boss** (tâches sur Postgres) | 12.38.1 | Tâches planifiées, reprises après panne, sans Redis en plus | Dès qu'il y a des relances, envois différés, traitements longs. Alerter si une tâche ne tourne pas (healthchecks) |
| **better-auth** (connexion) | 1.7.18 | Connexion et rôles dans notre code, sans service tiers ; base du multi-client | Dès qu'il y a des comptes. Écrire le test d'isolation entre clients dans la foulée |
| **Drizzle** (`drizzle-orm` + `drizzle-kit`) | 0.45.4 / 0.31.11 | Schéma typé, migrations versionnées en fichiers relisables | Dès qu'il y a une base. Migrations réversibles, essayées sur copie |
| **zod** | 4.6.7 | Une seule description des données pour formulaires, serveur et sorties de l'IA | Partout où une donnée entre dans l'outil (formulaire, appel reçu, réponse IA) |
| **react-hook-form** | 7.91.0 | Formulaires mobiles fiables, relié à zod | Dès qu'un écran saisit des données |
| **@t3-oss/env-nextjs** | 0.13.11 | Refuse de démarrer si une variable d'environnement manque ou est mal formée | Dès qu'il y a des variables d'environnement. Jamais de valeur secrète dans le dépôt |
| **next-intl** | 4.14.9 | Français d'abord, pluriels, dates et montants à la française, heure de Paris | Dès le premier écran : évite de réécrire les textes plus tard |
| **shadcn/ui** (outil `shadcn`) + Tailwind | 4.23.0 / tailwindcss 4.3.5 | Composants copiés dans le dépôt (le code nous appartient), accessibles, mobile d'abord | Quand les maquettes sont validées ; les couleurs et tailles restent dans `src/design/jetons.ts` |
| **Playwright** (`@playwright/test`) | 1.65.0 (déjà dans le gabarit) | Tests de bout en bout et captures d'écran sur téléphone | Pour chaque parcours R du MVP ; captures prises dans le même conteneur que la CI |
| **axe** (`@axe-core/playwright`) | 4.14.0 | Contrôle d'accessibilité automatique | Une vérification par page clé, téléphone et ordinateur |
| **react-email** + **nodemailer** | react-email 6.11.8 / nodemailer 10.3.1 | Modèles d'e-mail en composants ; envoi par SMTP | Dès qu'un e-mail part. SPF, DKIM, DMARC avant le premier envoi réel |
| **imapflow** + **postal-mime** | 2.11.0 / 4.2.0 | Lire une boîte de réception et analyser les messages et pièces jointes | Outils qui traitent des e-mails reçus (texte non fiable : voir `SPEC.md` section 12) |
| **@react-pdf/renderer** (ou Gotenberg en service séparé) | 4.9.0 | Devis et factures en PDF depuis des composants | Documents sortants ; Gotenberg si le rendu doit être très fidèle |
| **Factur-X** (facture électronique) | pas de bibliothèque TypeScript mûre | Un des formats admis (Factur-X, UBL, CII) ; format et calendrier à confirmer par l'expert-comptable | **À cadrer en premier** : valider le calendrier avec l'expert-comptable (réception annoncée au 01/09/2026), puis soit brique maison validée avec mustangproject (service séparé), soit plateforme agréée par API |
| **pino** | 10.4.0 | Journaux structurés avec masquage des champs (`redact`) | Dès qu'il y a un serveur : jamais de donnée de personne en clair dans les journaux |
| **promptfoo** (+ **autoevals**) | 0.125.1 / 0.4.1 | Jeux de tests de la qualité des réponses IA, rejoués avant tout changement de modèle | Dès qu'un outil appelle l'IA |
| **Sentry** (`@sentry/nextjs`) | 11.11.0 | Remontée des erreurs côté serveur et navigateur | En production, avec masquage des données de personnes |

## Hors Top 10, utiles

- **restic** / **rclone** (programmes, pas des paquets npm) : copie chiffrée des sauvegardes hors serveur, avec restauration d'essai mensuelle.
- **healthchecks** : alerte quand une tâche ou une sauvegarde ne s'exécute pas.
- **Uptime Kuma** : surveillance du site.
- **Stryker** (hebdomadaire) : vérifie que les tests détectent vraiment les fautes.
- **knip** et **dependency-cruiser** : code mort et frontières entre briques.
- **pnpm `minimumReleaseAge`** : défense simple contre un paquet piégé tout juste publié.

## À écarter

Tout outil sans code (n8n, Notion, Zapier), les composants sous licence AGPL/GPL intégrés à notre code (inspiration seulement), les bibliothèques inactives (pdf-lib), les services tiers inutiles (passerelles IA, limiteurs hébergés).
