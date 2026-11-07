# SPEC : cahier des charges (à remplir)

## 1. Contexte
(pourquoi cet outil existe)

## 2. Utilisateurs
(qui s'en sert, sur quel appareil)

## 3. Périmètre et non-objectifs
- Dans le périmètre :
- Hors périmètre :

## 4. Exigences
### R1 : (titre court)
- **Étant donné** …
- **Quand** …
- **Alors** …
- Version : mvp | v2 | v3 : (raison en une phrase)
- État : à faire | en cours | fait | recetté

## 5. Non fonctionnel
(rapidité, mobile, accessibilité, sauvegardes)

## 6. Données
(ce qui est enregistré, durée de conservation, export)

## 7. Intégrations et secrets
(services externes ; les secrets ne sont jamais écrits ici)

## 8. Écrans
(liste des écrans, mobile d'abord, mots simples)

## 9. Erreurs
(ce que la personne voit quand quelque chose ne marche pas, sans mot technique)

## 10. Risques
## 11. Définition de fini
(toutes les R du MVP recettées sur téléphone)

## 12. Exigences à ne pas oublier
Cases à cocher à chaque cadrage. Pour chaque point : soit on l'applique (et on écrit la ou les exigences R correspondantes dans la section 4), soit on écrit « sans objet » avec la raison. Un point protecteur ne passe jamais en V2 (voir `METHODE.md`).

### Données de personnes (RGPD)
- [ ] **Registre des traitements** : pour chaque donnée de personne, on note à quoi elle sert, qui la voit, combien de temps on la garde et chez qui elle est envoyée (hébergeur, service d'e-mail, IA).
- [ ] **Durées de conservation** écrites dans la section 6, avec un rappel avant la fin de la durée. Rien n'est effacé automatiquement.
- [ ] **Droit d'accès et export** : la personne (ou son client) peut obtenir toutes ses données dans un fichier lisible.
- [ ] **Fermeture d'un compte = désactivation, sans effacement automatique.** Une suppression de données se décide à la main, après accord écrit, jamais par un programme planifié.
- [ ] **Mentions d'information** et contrat de sous-traitance prêts avant la mise en service.
- [ ] **Données minimales** : on n'envoie à l'IA que ce qui est utile (pas d'IBAN, pas d'adresse e-mail inutile). Pas de vraies données dans les tests ni dans les journaux.

### Plusieurs clients sur le même outil
- [ ] **Isolation entre clients** : un client ne voit jamais les données d'un autre, nulle part (écrans, exports, e-mails, fichiers). Un test automatique essaie de lire les données du client B avec un compte du client A et doit échouer.
- [ ] **Droits par rôle** (qui peut voir, modifier, exporter) écrits et testés.
- [ ] **Journal d'audit** : pour les actions sensibles (export, changement de droits, envoi, suppression), on garde qui, quoi, quand, depuis où. Le journal ne se modifie pas et se garde plus longtemps que les autres journaux.
- [ ] **Limites d'essais et d'abus** : connexion, formulaires publics, envois d'e-mails, appels reçus d'autres services (signature vérifiée, même appel reçu deux fois = traité une seule fois).

### Argent, dates et calendrier
- [ ] **TVA toujours facturée** : le taux et la date d'effet du taux sont enregistrés avec chaque ligne ; aucune facture « sans TVA » par oubli.
- [ ] **Montants en centimes entiers**, jamais en nombres à virgule ; arrondi défini une fois pour toutes.
- [ ] **Dates enregistrées en heure universelle (UTC)** et **affichées en heure de Paris**, y compris au changement d'heure.
- [ ] **Jours fériés français** pris en compte pour les échéances et les relances.
- [ ] **Facture électronique** : obligation de recevoir des factures électroniques applicable depuis le **01/09/2026** selon les annonces (émission échelonnée ensuite via une plateforme agréée). **Les dates et le format (Factur-X, UBL ou CII) sont à confirmer par l'expert-comptable avant toute décision.** Numérotation continue, mentions légales et archivage prévus.

### E-mails
- [ ] **Délivrabilité** : SPF, DKIM et DMARC en place sur le domaine d'envoi avant le premier envoi réel.
- [ ] Lien de désinscription, suivi des e-mails rejetés, plafond d'envois par jour, pour que les messages n'arrivent pas dans les courriers indésirables.
- [ ] **Un humain valide tout envoi** produit par l'IA ou par un texte reçu de l'extérieur.

### Base de données, sauvegarde et reprise
- [ ] **Migrations versionnées et réversibles** (ou en deux temps pour supprimer une colonne), essayées sur une copie avant la vraie base. Une migration qui détruit des données demande l'accord du responsable.
- [ ] **Sauvegarde ET restauration testée** : copie chiffrée hors du serveur et hors de l'hébergeur ; essai de restauration chaque mois dans une base jetable ; alerte si la sauvegarde ou l'essai ne tourne pas.
- [ ] **Reprise après sinistre** : une page écrite (où est la clé de chiffrement, qui peut redéployer, clé de secours hors ligne).
- [ ] **Tâches planifiées** qui reprennent après une panne et qui préviennent quand elles ne se lancent pas.

### Intelligence artificielle
- [ ] **Plafond de dépense IA** : limite dans l'outil et limite chez le fournisseur, alerte à 50 % et 80 %, arrêt propre à 100 %, par client ; nombre maximal de tours pour éviter les boucles.
- [ ] **Texte extérieur = texte non fiable** : un e-mail ou un document reçu ne peut pas donner d'ordres à l'IA ; sorties vérifiées par un schéma.
- [ ] **Panne du fournisseur IA** : message simple, nouvel essai plus tard, version du modèle figée, jeu de tests rejoué avant de changer de modèle.
- [ ] **Test de qualité des réponses IA** rejoué à chaque changement (voir `docs/ia.md`).

### Écran et accessibilité
- [ ] **Accessibilité** : contrôle automatique axe sur chaque page clé (téléphone et ordinateur), cibles d'au moins 44 px, contrastes AA.
- [ ] **Petits écrans** : essai à 360 px et 375 px, aucun texte coupé ni débordement.

### Chaîne de fabrication
- [ ] **Dépendances** : verrou gelé, aucune faille critique ou haute (`pnpm audit`), mises à jour regroupées chaque semaine, aucune fusion automatique, aucune nouvelle dépendance sans accord du responsable.
- [ ] **Workflows** contrôlés (actionlint, zizmor), actions épinglées par empreinte.
- [ ] **Secrets** : jamais dans le dépôt ; copie de secours de la clé principale hors ligne.
- [ ] **Coût des agents** : durée maximale et nombre de tours bornés dans chaque workflow.
- [ ] **TypeScript seulement** : pas d'outil sans code (n8n, Notion, Zapier) pour la logique de l'outil.


## Brique « comptes » (lot L14)
Décision de recherche (METHODE 3.0) : **réutiliser** better-auth 1.7.18 (MIT, https://github.com/better-auth/better-auth), drizzle-orm 0.45.4 (Apache-2.0), zod 4.6.7 (MIT), pg 8.23.1 (MIT) ; pglite 0.5.15 (Apache-2.0) pour les essais. Écrire : les règles d'inscription, d'invitation, d'espace et de RGPD (`src/lib/comptes`).

### R-C1 : inscription selon le mode
- **Étant donné** le mode réglé dans `proprietes.yaml` / **Quand** une personne envoie le formulaire d'inscription / **Alors** le serveur refuse si le mode n'est pas `libre`.
- Version : mvp (protège).
### R-C2 : adresse vérifiée
- **Étant donné** un compte nouvellement créé / **Quand** la personne tente de se connecter sans avoir confirmé son adresse / **Alors** l'accès est refusé et un message de confirmation est renvoyé.
- Version : mvp (protège).
### R-C3 : espace isolé
- **Étant donné** deux espaces / **Quand** un compte lit des données / **Alors** il ne voit jamais celles de l'autre espace.
- Version : mvp (protège).
### R-C4 : invitation à usage unique
- **Étant donné** un lien d'invitation / **Quand** il est utilisé une deuxième fois ou après 7 jours / **Alors** il est refusé.
- Version : mvp.
### R-C5 : fin d'essai
- **Étant donné** un espace dont l'essai est fini / **Quand** la personne ouvre l'outil / **Alors** elle lit « Votre essai est terminé, contactez-nous ».
- Version : mvp.
### R-C6 : fermeture de compte
- **Étant donné** une personne connectée / **Quand** elle demande la fermeture / **Alors** son compte est désactivé, l'administrateur prévenu, rien n'est effacé.
- Version : mvp (RGPD).
