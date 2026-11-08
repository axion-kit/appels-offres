# Modèle des données : schéma `a_appels_offres`

Ce document fait foi pour toute fiche qui crée, migre ou lit une table de l'outil « Appels d'offres ». Il donne les tables, les colonnes, les clés, les index et les règles d'ajout seul. Les ports qui y accèdent sont décrits dans `docs/console-ports.md`.

## 0. Règles communes

| Règle | Application |
|---|---|
| Rangement | Mode console : schéma `a_appels_offres` de la base propre au client (une base par client) ; aucun objet hors de ce schéma. Mode autonome : base de l'outil, mêmes tables et mêmes colonnes, plus `espace_id`. |
| Deux modes, un schéma | Le schéma drizzle de `src/lib/base/schema/` est la source unique ; un test vérifie que les migrations du mode console (L01-T44) et celles du mode autonome (L01-T04) produisent les mêmes tables et colonnes, hors `espace_id` et sécurité par ligne. |
| Identifiant | `id uuid` clé primaire, tiré par la base (`gen_random_uuid()`). |
| Client | Mode console : implicite (la base est celle du client) ; **jamais** de colonne `tenant_id` ni `espace_id`. Mode autonome : `espace_id uuid not null` sur chaque table du client, sécurité par ligne sur `espace_id`. |
| Établissement | `etablissement_id uuid not null` sur toute donnée d'un établissement (annonces suivies, dossiers, pièces de l'entreprise, documents, rappels, mots et réglages de recherche). C'est l'identifiant d'un établissement du client lu par la session, **sans clé étrangère** : une migration du module ne peut pas nommer le schéma commun de la console. L'existence est vérifiée par le code et un test. |
| Unicité et clés étrangères | Toute unicité métier et toute clé étrangère d'une table d'établissement portent `etablissement_id` en première colonne ; en mode autonome, `espace_id` vient avant. Une unicité sans la colonne de cloisonnement serait un indice d'existence entre clients ou établissements. |
| Colonnes communes | `cree_le timestamptz not null default now()`, `cree_par text not null` (acteur de session, `outil` pour une tâche, identifiant d'équipe pour Axion ; jamais un nom), `modifie_le timestamptz null`, `archive_le timestamptz null`, `archive_par text null`, `archive_motif text null` sur chaque table métier. Elles ne sont pas répétées plus bas. |
| Personne | Une personne est désignée par `acteur` (identifiant de session du portail) et, si utile, `personne_id null` (fiche de contact du client, facultative, sans clé étrangère). Aucun nom ni e-mail n'est copié dans une table d'historique, de journal ou d'envoi. |
| Horodatage | `timestamptz` en UTC ; une heure limite garde son fuseau d'origine (`fuseau_origine text`). `date` pour un jour civil. |
| Montants | `bigint` en centimes entiers (`*_centimes`), hors taxes ; `null` = non indiqué. Ce sont des montants **des marchés** (lus dans les annonces ou saisis par le client), jamais un prix de l'outil. Aucune valeur par défaut de montant dans une migration. |
| Énumérations | `text` + `CHECK (col IN (...))`, même liste que le type zod ; ajouter une valeur = migration additive ; jamais renommer. |
| Archivage | Pas de colonne « supprimé », pas d'effacement : archiver = poser `archive_le` ; restaurer = le remettre à vide, avec une ligne d'historique. |
| Secrets | Jamais en base : seulement une référence au coffre de la console (`reference_coffre`) et les 4 derniers caractères. Aucune colonne de mot de passe de plateforme, nulle part (un test parcourt le schéma et refuse `password`, `mot_de_passe`, `mdp`). |
| Pagination | Par curseur `(cree_le, id)` partout ; index composés en conséquence. |

### 0.1 Ajout seul

Tables en ajout seul : `historique`, `entreprise_version`, `annonce_version`, `dossier_version`, `memoire_version`, `note`, `confirmation_envoi`, `confirmation_tombee`, `envoi`, `accuse`, `fichier_export`, `source_preuve`, `preuve_incident`.

- Aucune requête `UPDATE` ni `DELETE` sur ces tables dans `src/` (test de L01-T08, qui lit le code).
- Mode console : la base ne peut pas l'imposer (l'application a le droit `UPDATE` sur le schéma, jamais `DELETE`) ; le code et le test tiennent la règle.
- Mode autonome : déclencheur `refuser_effacement` (`BEFORE DELETE OR TRUNCATE`) et refus d'`UPDATE` sur ces tables, posés par L01-T04 seulement.
- Une correction = une nouvelle ligne (nouvelle version, nouvelle note), jamais une réécriture.
- État d'une confirmation : il **se lit**, il ne s'écrit pas (section 3.8).

### 0.2 Migrations

| | Mode console (L01-T44) | Mode autonome (L01-T04) |
|---|---|---|
| Forme | texte SQL additif exporté par des fichiers `.ts` ; dossier au format de la console produit à la livraison | migrations TypeScript numérotées, appliquées au démarrage sous verrou |
| Permis | `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE … ADD COLUMN` (nullable ou avec défaut), `ADD CONSTRAINT … CHECK` (`NOT VALID` puis `VALIDATE`), `COMMENT`, `INSERT` de données de référence du module | idem, plus `espace_id`, sécurité par ligne, droits et `refuser_effacement` |
| Interdit | fonction, déclencheur, `DROP`, `DELETE`, `UPDATE`, `TRUNCATE`, `GRANT`, `REVOKE`, `SET`, `search_path`, `DO`, `EXECUTE`, tout autre schéma, clé étrangère vers le schéma commun ; ces mots sont refusés **même dans un `COMMENT`** | `DROP`, `DELETE`, `TRUNCATE` |
| Retirer une colonne | jamais : on cesse de l'écrire, elle reste | idem |
| Après publication | une migration n'est jamais modifiée (empreinte revérifiée) | idem |

## 1. Socle et personnes

| Table | Version | Colonnes (hors colonnes communes) | Clés, index, règles |
|---|---|---|---|
| `reglage_compte` | MVP | `donnees_reelles_autorisees boolean not null default false`, `seuil_trop_annonces integer`, `plafond_ia_jetons bigint`, `plafond_ia_dossier_jetons bigint`, `poids_score jsonb`, `seuil_gros_marche jsonb` (seuil métier réglable par le client, pas un prix), `seconde_lecture_delai_minutes integer`, `etat_service text null` (`essai` \| `actif` \| `suspendu` \| `fin` ; mode autonome seulement, L01-T21) | une seule ligne par compte (index unique sur une constante ; en autonome : unique `(espace_id)`). L'état du contrat n'est **pas** ici en mode console (port d'état du contrat). `etat_service` reste `null` en mode console. |
| `personne_ao` | MVP | `acteur text not null`, `personne_id uuid null`, `fonction text null`, `est_dirigeant boolean not null default false` | unique `(acteur)`. Mode autonome : table `personne` (`nom`, `fonction`, `email null`, `utilisateur_id null`, `est_dirigeant`). |
| `habilitation` | MVP | `acteur text not null`, `personne_id uuid null`, `role` (`responsable_compte` \| `confirme_envoi` \| `prepare` \| `lecture`), `etablissement_id uuid null` (null = tous les établissements du compte), `fonction` (`adv` \| `technique` \| `prix` \| `direction` \| `valideur` \| null), `delegation_document_id uuid null`, `accordee_le`, `accordee_par`, `retiree_le null`, `retiree_par null` | index `(acteur, role, retiree_le)`. Une habilitation ne s'efface pas : on la retire. Au moins un `responsable_compte` actif (contrôlé par le code). Aucune colonne `peut_confirmer_envoi` : « peut confirmer » = habilitation `confirme_envoi` active **et** permission `appels-offres-confirmer-envoi` **et** deuxième facteur de moins de 5 minutes. |
| `membre_groupement` | MVP | `dossier_id uuid not null`, `raison_sociale text`, `siren text null`, `role` (`mandataire` \| `cotraitant` \| `sous_traitant`), `pieces_recues jsonb` | index `(dossier_id)`. Le dossier vit chez le mandataire ; aucun compte partagé. |
| `acces_support` | MVP, autonome | `demandeur`, `approbateur`, `motif`, `debut`, `fin`, `lecture_seule boolean` | `CHECK (approbateur <> demandeur)`, `CHECK (fin > debut)`, `CHECK (lecture_seule)`. Mode console : vue client tracée de la console. |
| `personne_axion` | MVP, autonome | `utilisateur_id`, `role` (un des 4 rôles d'Axion) | jamais membre d'un espace client. Mode console : rôles de l'équipe de la console. |
| `suspension` | autonome | `motif`, `debut`, `fin null` | mode console : état du contrat. |

## 2. Historique

Table `historique` [MVP] — **créée par L01-T04 (mode autonome) et par L01-T44 (mode console)** ; écrite par L01-T46.

| Colonne | Type | Règle |
|---|---|---|
| `id` | `uuid` | clé primaire |
| `espace_id` | `uuid not null` | **mode autonome seulement** |
| `etablissement_id` | `uuid null` | établissement de l'objet, si l'objet en a un |
| `cible_type` | `text not null` | type de l'objet touché (`dossier`, `annonce`, `piece`, `personne`, `source`, `compte`…) |
| `cible_id` | `uuid not null` | identifiant de l'objet touché |
| `type` | `text not null` + `CHECK` | liste fermée ci-dessous |
| `details` | `jsonb not null default '{}'` | identifiants, codes, nombres, booléens seulement : **sans nom ni adresse**, sans pièce, sans prix, sans secret, sans texte libre |
| `audit_id` | `text null` | identifiant de la ligne du journal d'audit chaîné (journal de la console en mode console, journal de l'outil en mode autonome) |
| `cree_le` | `timestamptz not null` | heure de l'événement |
| `cree_par` | `text not null` | identifiant de l'acteur, jamais un nom |

Valeurs de `type` (ajout par migration additive seulement) : `annonce_retenue`, `annonce_ecartee`, `annonce_reprise`, `section_relue`, `dossier_valide`, `envoi_confirme`, `confirmation_tombee`, `envoi_declare`, `envoi_hors_outil`, `accuse_confirme`, `resultat_note`, `source_suivie`, `habilitation_accordee`, `habilitation_retiree`, `acces_support`, `export_demande`, `suppression_demandee`, `ia_refus`, `consigne_ignoree`, `acces_refuse`, `envoi_refuse`, `archive`, `restaure` ; ajoutés le 08/11/2026 (une phrase chacun dans `console-ports.md`, section « Types de ligne de journal ajoutés le 08/11/2026 ») : `reglage_change`, `deuxieme_facteur_active`, `secret_revoque`, `courrier_importe`, `etape_changee`, `membre_retire`, `connexion_modifiee`, `gel_pose`, `gel_leve`, `annexe_acceptee`, `source_accord`, `source_degradee`, `lien_refuse`, `fichier_en_attente`, `ia_accord_note`, `ia_accord_retire`, `controle_retire`.

Index : `(etablissement_id, cree_le, id)` et `(cible_type, cible_id, cree_le)` ; en mode autonome, chacun commence par `espace_id`.

Règles :
- Ajout seul (section 0.1).
- Aucun nom stocké : le nom est lu à l'affichage ; une personne retirée apparaît « Personne retirée ».
- Aucune adresse réseau dans l'outil en mode console.
- Événements de sécurité et des règles de fer (confirmation, déclaration, dépôt noté hors de l'outil, accusé, habilitation, accès d'Axion, export, suppression demandée, refus d'IA, consigne ignorée, accès refusé, envoi refusé) : ligne au journal d'audit d'abord (`PortJournal`), puis ligne d'historique avec `audit_id`. Si le journal échoue, le geste est refusé et rien n'est écrit ici.
- Mode autonome seulement : tables `journal` et `journal_origine` de l'outil (L01-T06) ; aucune en mode console.

## 3. Tables métier

### 3.1 Entreprise

| Table | Version | Colonnes | Clés, index, règles |
|---|---|---|---|
| `entreprise` | MVP | `raison_sociale`, `siren null`, `siret null`, `immatriculation_etrangere null` et `tva_intracommunautaire null` (entité sans SIREN, établie hors de France : saisis par la personne, marqués « non vérifié à la source », R237), `forme`, `adresse`, `activite`, `effectif integer null`, `version_courante integer` | une par entité juridique, donc une par compte |
| `entreprise_version` | MVP | `entreprise_id`, `numero integer`, `contenu jsonb`, `auteur`, `motif null` | unique `(entreprise_id, numero)` ; ajout seul ; « Revenir à cette version » crée un nouveau numéro. Clés de `contenu` : les rubriques de Mon entreprise (R147). |
| `reference` | MVP | `titre`, `acheteur`, `annee`, `montant_centimes null`, `description`, `autorise_citation boolean`, `document_id null`, `source text` | index `(etablissement_id, annee)` si rattachée à un établissement |
| `chiffre_cle` | MVP | `annee`, `chiffre_affaires_centimes`, `effectif` | unique `(annee)` |
| `certification` | MVP | `nom`, `organisme`, `valide_jusqu_au date null`, `document_id` | |
| `membre_equipe` | MVP | `personne_id null`, `nom_affiche`, `fonction`, `document_id`, `autorise_citation boolean` | |
| `piece_entreprise` | MVP | `etablissement_id`, `type`, `rubrique`, `nom`, `document_id`, `valide_du date`, `valide_jusqu_au date null`, `etat` (`valide` \| `expire_bientot` \| `expiree` \| `a_fournir`), `pour_candidature boolean` | index `(etablissement_id, etat, valide_jusqu_au)` |

### 3.2 Sources et veille

En mode console, le registre des sources est livré **comme donnée de la version du module** ; chaque client garde `source_suivie` et l'état de lecture, et les annonces publiques collectées sont copiées dans la base de chaque client qui suit la source (aucune base commune entre clients).

| Table | Version | Colonnes | Clés, index, règles |
|---|---|---|---|
| `source` | MVP (registre) | `numero integer`, `nom`, `famille smallint`, `couche` (`A`..`D`), `adresse text null`, `sans_adresse boolean`, `facon_acceder text`, `voie_lecture` (`api_officielle` \| `flux` \| `alerte_email_client` \| `consultation_personne` \| `pas_choisie`), `priorite_proposee` (`P0` \| `P1` \| `P2`), `niveau` (`N0`..`N4`), `rattachee_a text null`, `frequence_max_minutes integer null`, `etat_lecture` (`arretee` \| `active` \| `en_erreur`), `echecs_consecutifs integer`, `derniere_lecture_ok timestamptz null`, `delai_peremption_jours integer null`, `ajoutee_par` (`registre_initial` \| `axion` \| `proposition_client`) | unique `(numero)`. L'état « connectée / à tester / non connectée » est **calculé**, jamais stocké. Aucune donnée de client. |
| `source_preuve` | MVP (registre) | `source_id`, `de_niveau`, `vers_niveau`, `auteur`, `relecteur null` (obligatoire à partir de N2), `date`, `decision text`, `pieces jsonb` | ajout seul ; une montée = `vers_niveau` = `de_niveau` + 1 (contrôlé par le code) |
| `source_revue` | MVP (registre) | `date`, `note text`, `sources_retestees integer`, `niveaux_modifies integer` | |
| `collecte` | MVP | `source_id`, `debut`, `fin`, `statut` (`ok` \| `refus` \| `injoignable` \| `format_inattendu` \| `vide_anormal`), `nb_annonces`, `motif text` | index `(source_id, debut)` |
| `annonce_publique` | MVP | `source_id`, `id_avis text null`, `titre`, `acheteur`, `date_limite timestamptz null`, `fuseau_origine`, `montant_centimes null`, `lien`, `champs jsonb`, `empreinte_contenu`, `lue_le` | unique `(source_id, id_avis)` ; sinon unique `(source_id, empreinte_contenu)` ; données publiques seulement |
| `source_suivie` | MVP | `etablissement_id`, `source_id`, `suivie_le`, `suivie_par`, `retiree_le null` | unique `(etablissement_id, source_id, suivie_le)` ; aucune ligne sans geste d'une personne (aucune source suivie d'office) |
| `source_proposee` | MVP | `domaine`, `nb_ajouts`, `periode_debut`, `accord_axion_le null`, `accord_client_le null`, `ne_plus_proposer boolean` | « Proposer une source » reste toujours ouvert |
| `mot_recherche` | MVP | `etablissement_id`, `mot`, `sens` (`trouver` \| `exclure`), `propose_par_ia boolean`, `accepte_le null`, `accepte_par null` | unique `(etablissement_id, mot, sens)` |
| `reglage_recherche` | MVP | `etablissement_id`, `zone jsonb`, `types jsonb`, `montant_min_centimes null`, `montant_max_centimes null`, `delai_min_jours null` | unique `(etablissement_id)` |

### 3.3 Annonces et ajouts

| Table | Version | Colonnes | Clés, index, règles |
|---|---|---|---|
| `annonce` | MVP | `etablissement_id`, `annonce_publique_id null`, `origine` (`veille` \| `ajout_manuel`), `ajoute_a_la_main boolean`, `titre`, `acheteur null`, `acheteur_verifie boolean`, `date_limite timestamptz null`, `date_limite_a_verifier boolean`, `fuseau_origine null`, `montant_centimes null`, `score integer null`, `raison_score text`, `etat` (`nouvelle` \| `a_trier` \| `retenue` \| `ecartee`), `raison_ecart text null`, `groupe_doublon_id null` | index `(etablissement_id, etat, date_limite)` ; unique `(etablissement_id, annonce_publique_id)` quand renseignée. L'outil n'écarte jamais seul : `ecartee` exige une raison et un geste. |
| `annonce_version` | MVP | `annonce_id`, `numero`, `contenu jsonb`, `auteur`, `motif null` | unique `(annonce_id, numero)` ; ajout seul |
| `annonce_origine` | MVP | `annonce_id`, `source_id null`, `lien`, `vue_le` | index `(annonce_id)` |
| `doublon_proposition` | MVP | `annonce_a_id`, `annonce_b_id`, `certitude` (`certain` \| `incertain`), `decision` (`en_attente` \| `meme` \| `differentes` \| `separee`), `decide_par null`, `decide_le null` | unique `(annonce_a_id, annonce_b_id)` ; l'outil propose, ne réunit jamais seul ; une fusion se défait (nouvelle décision) |
| `ajout` | MVP | `etablissement_id`, `facon` (`lien` \| `fichiers` \| `email` \| `saisie`), `origine_email null` (`fichier` \| `adresse_depot`), `etat` (`recu` \| `en_controle` \| `a_confirmer` \| `range` \| `refuse` \| `mis_de_cote`), `lien null`, `expediteur null`, `expediteur_autorise boolean null`, `annonce_id null`, `recap jsonb` | index `(etablissement_id, etat, cree_le)` |
| `adresse_depot` | MVP | `adresse` | unique `(adresse)` ; une par compte |
| `expediteur_autorise` | MVP | `adresse`, `ajoute_par` | unique `(adresse)` |
| `import_ancien` | MVP | `etat` (`depose` \| `classe` \| `en_validation` \| `termine`), `nb_fichiers`, `nb_valeurs_validees` | |

### 3.4 Dossiers, pièces, prix

| Table | Version | Colonnes | Clés, index, règles |
|---|---|---|---|
| `dossier` | MVP | `etablissement_id`, `annonce_id`, `etape` (`retenu` \| `commence` \| `a_valider` \| `envoye` \| `resultat` \| `ecarte`), `sous_etat_envoi null` (`accuse_a_importer` \| `accuse_recu`), `mentions jsonb`, `raison_ecart null`, `etape_avant_ecart null`, `date_limite`, `fin_marche date null`, `resultat_attendu_le`, `resultat` (`gagne` \| `perdu` \| `sans_suite` \| null), `valide_le null`, `valide_par null`, `confidentiel boolean` | unique `(etablissement_id, annonce_id)` ; index `(etablissement_id, etape, date_limite)`. « Urgent » est calculé. |
| `dossier_version` | MVP | `dossier_id`, `numero`, `contenu jsonb`, `auteur`, `motif null` | unique `(dossier_id, numero)` ; ajout seul |
| `note` | MVP | `dossier_id null`, `annonce_id null`, `texte`, `auteur` | ajout seul (une correction = une nouvelle note) ; archivable |
| `lot` | MVP | `dossier_id`, `numero`, `titre`, `on_repond boolean` | unique `(dossier_id, numero)` |
| `document_acheteur` | MVP | `dossier_id`, `document_id`, `type` (`rc` \| `cctp` \| `ccap` \| `bpu` \| `dpgf` \| `dqe` \| `ae` \| `autre`), `pages_total`, `pages_lues`, `pages_illisibles jsonb` | index `(dossier_id)` |
| `exigence` | MVP | `dossier_id`, `texte`, `document_id`, `page`, `type` (`critere` \| `exigence` \| `date` \| `clause_sensible`) | index `(dossier_id)` |
| `piece_exigee` | MVP | `dossier_id`, `lot_id null`, `nom`, `document_source_id`, `page`, `stade` (`candidature` \| `offre` \| `si_retenu`), `obligatoire boolean`, `etat` (`attendue` \| `a_fournir` \| `fournie` \| `validee` \| `expiree` \| `fournie_autrement` \| `masquee`), `piece_entreprise_id null`, `document_id null`, `motif null` | index `(dossier_id, etat)`. Liste tirée du règlement, jamais d'une liste fixe ; une pièce obligatoire `a_fournir` ou `expiree` bloque la confirmation. |
| `point_controle` | MVP | `dossier_id`, `porte text`, `type` (`controle` \| `seconde_lecture_differee`), `possible_apres timestamptz null`, `relu_par null`, `gravite` (`bloquant` \| `alerte`), `message`, `etat` (`ouvert` \| `corrige` \| `alerte_passee`), `motif null`, `pour_envoi_id null` | index `(dossier_id, etat)` ; un bloquant ne se passe jamais ; passer une alerte exige un motif |
| `prix_ligne` | MVP | `dossier_id`, `lot_id`, `ordre`, `libelle`, `unite`, `quantite_milliemes null`, `prix_unitaire_centimes null`, `saisi_par null`, `valide_par null`, `valide_le null` | unique `(dossier_id, lot_id, ordre)`. **L'outil n'écrit jamais `prix_unitaire_centimes`** : l'auteur d'une saisie est toujours une personne (garde serveur). Les totaux sont calculés, jamais stockés comme saisie. |

### 3.5 Mémoire technique

| Table | Version | Colonnes | Clés, index, règles |
|---|---|---|---|
| `memoire_section` | MVP | `dossier_id`, `ordre`, `titre`, `critere_ref null`, `version_courante integer`, `est_consigne boolean`, `relue_le null`, `relue_par null` | unique `(dossier_id, ordre)` ; « J'ai relu » refusé si `est_consigne` ou contenu vide |
| `memoire_version` | MVP | `section_id`, `numero`, `contenu text`, `auteur_type` (`personne` \| `outil`), `auteur_id`, `famille_modele null`, `version_consigne null`, `reprend_version null`, `motif null`, `empreinte` | unique `(section_id, numero)` ; ajout seul ; une modification après validation retire la validation du dossier |
| `extrait_bibliotheque` | V2 | `texte`, `source`, `approuve_par`, `approuve_le`, `revision_le`, `droit_reutilisation text`, `etat` (`a_valider` \| `approuve` \| `a_revalider`) | une bibliothèque par compte, jamais partagée |

### 3.6 Envoi, accusés, export

| Table | Version | Colonnes | Clés, index, règles |
|---|---|---|---|
| `confirmation_envoi` | MVP | `dossier_id`, `version_dossier integer`, `confirme_par` (acteur habilité), `role_au_moment`, `empreinte_contenu`, `texte_affiche_empreinte`, `fichiers jsonb` (noms + empreintes affichés), `jeton_ecran_empreinte`, `deuxieme_facteur_le`, `alertes_passees jsonb`, `confirmee_le` | ajout seul : la ligne est écrite **une fois**, au clic « Je confirme l'envoi », et ne change jamais. index `(dossier_id, confirmee_le)`. Le jeton d'écran n'est jamais en base (empreinte seulement). |
| `confirmation_tombee` | MVP | `confirmation_id`, `raison` (`contenu_change` \| `rectificatif_acheteur` \| `personne_retiree` \| `habilitation_retiree`) | unique `(confirmation_id)` ; ajout seul |
| `envoi` | MVP | `dossier_id`, `origine` (`confirme_dans_outil` \| `note_hors_outil`), `confirmation_id null`, `mode` (`depot_manuel` \| `email_personne` au MVP), `etat` (`attente_declaration` \| `declare` \| `probleme`), `heure_plateforme null`, `apres_heure_limite boolean`, `heure_declaration null`, `a_verifier_motif null` (`apres_heure_limite` \| `rectificatif_apres_confirmation`), `destinataire null` | **unique `(confirmation_id)`** : une confirmation = un envoi (un envoi noté hors de l'outil n'a pas de confirmation, R211) ; `CHECK ((origine = 'note_hors_outil') = (confirmation_id IS NULL))` ; ajout seul. |
| `preuve_incident` | MVP | `envoi_id null`, `dossier_id`, `type` (`capture` \| `copie_sauvegarde` \| `email_envoye`), `document_id`, `empreinte_sha256`, `importe_le` | index `(dossier_id, importe_le)` ; ajout seul ; l'original garde son empreinte (R241) |
| `accuse` | MVP | `envoi_id`, `document_id`, `type_preuve` (`recepisse_natif` \| `email` \| `capture_faible` \| `declaration_honneur`), `extrait jsonb`, `rapprochement` (`non_fait` \| `concordant` \| `ecart`), `ecarts jsonb`, `confirme_par null`, `confirme_le null` | index `(envoi_id, cree_le)` ; ajout seul ; l'original garde son empreinte ; jamais posé par l'IA ni par une tâche |
| `fichier_export` | MVP | `dossier_id`, `envoi_id null`, `ordre`, `nom`, `type_piece`, `lot_id null`, `document_id`, `taille_octets bigint`, `empreinte_sha256`, `version`, `valide_par`, `controle_ouverture` (`ok` \| `echec`), `ouvert_et_relu_par null` | unique `(dossier_id, envoi_id, ordre)` ; ajout seul ; le manifeste est la liste de ces lignes |

États qui se lisent (aucune colonne d'état sur `confirmation_envoi`) :
- **consommée** = une ligne `envoi` existe pour ce `confirmation_id` ;
- **tombée** = une ligne `confirmation_tombee` existe ;
- **valable** = ni l'une ni l'autre ; elle n'expire pas avec le jeton d'écran (10 minutes) ni à l'heure limite.
- Une déclaration « J'ai envoyé moi-même » faite après une chute pour rectificatif est enregistrée avec `a_verifier_motif = rectificatif_apres_confirmation`, jamais refusée.

### 3.7 Échanges, calendrier, rappels

| Table | Version | Colonnes | Clés, index, règles |
|---|---|---|---|
| `echange` | MVP | `dossier_id`, `sens` (`recu` \| `a_envoyer`), `type` (`question` \| `reponse` \| `demande_precision` \| `complement` \| `rectificatif` \| `resultat`), `contenu text`, `auteur_type`, `etat` (`recu` \| `lu` \| `brouillon_outil` \| `modifie_par_personne` \| `relu` \| `confirme` \| `envoye_par_personne`), `confirme_par null`, `confirme_le null`, `document_id null` | index `(dossier_id, cree_le)` ; l'outil ne répond jamais seul |
| `echeance` | MVP | `etablissement_id`, `dossier_id null`, `type` (`date_limite` \| `questions` \| `visite` \| `fin_marche` \| `resultat_attendu` \| `expiration_piece`), `quand`, `objet_id null` | index `(etablissement_id, quand)` |
| `rappel` | MVP | `echeance_id null`, `envoi_id null`, `type` (`accuse_1h` \| `accuse_24h` \| `accuse_quotidien` \| `echeance`), `prevu_le`, `fait_le null`, `annule_le null`, `cle_unicite` | unique `(cle_unicite)` (même clé que la tâche, `docs/console-ports.md` §9) ; contenu sans lien qui change un état |

### 3.8 Fichiers et sites

| Table | Version | Colonnes | Clés, index, règles |
|---|---|---|---|
| `document` | MVP | `etablissement_id`, `cle_objet` (`appels-offres/<etablissement>/<famille>/<id>`, 512 caractères au plus), `nom_affiche`, `type_reel`, `taille_octets bigint`, `empreinte_sha256` (64 caractères hexadécimaux), `etat` (`recu` \| `en_controle` \| `pret` \| `quarantaine` \| `en_attente_analyse` \| `refuse` \| `rejete`), `origine` (`ajout` \| `entreprise` \| `acheteur` \| `export` \| `accuse` \| `import_ancien`), `original_id null`, `quarantaine_jusqu_au null` | unique `(etablissement_id, cle_objet)` ; index `(etablissement_id, cree_le, id)`. `en_attente_analyse` : antivirus indisponible (« Analyse indisponible : fichier mis en attente »). Une quarantaine est gardée, jamais supprimée. |
| `compte_site` | MVP | `source_id null`, `nom_plateforme null`, `famille` (`veille` \| `email` \| `depot` \| `signature` \| `stockage`), `titulaire_acteur`, `etat` (`a_configurer` \| `en_test` \| `active` \| `en_erreur` \| `expiree` \| `desactivee`), `mode` (`depot_manuel` \| `veille_email` \| `a_la_main`), `connexion_declaree_le null`, `dernier_test_le null`, `dernier_test_resultat null`, `secret_id null` (V3, jeton officiel seulement) | **aucune colonne de mot de passe** ; le test de connexion est déclaratif |
| `cle_espace`, `secret` | autonome | inchangées du kit | mode console : clé du client et coffre de la console ; l'outil ne garde que `reference_coffre` et `quatre_derniers` |

### 3.9 IA

| Table | Version | Colonnes | Clés, index, règles |
|---|---|---|---|
| `ia_compteur` | MVP, mode console | `periode` (mois, `date`), `portee` (`module` \| `dossier`), `dossier_id null`, `plafond_jetons bigint`, `total_jetons bigint`, `cout_micro_centimes bigint`, `alerte_50_le null`, `alerte_80_le null`, `arret_le null`, `reprise_accord_par null`, `reprise_accord_le null` | unique `(portee, dossier_id, periode)` ; mise à jour par une seule requête atomique ; **aucune ligne par appel**, aucun texte ; le coût n'est jamais affiché comme un prix (L05-T23) |
| `ia_depense` | MVP, autonome seulement | `periode`, `portee` (`client` \| `dossier`), `dossier_id null`, `plafond_jetons bigint`, `total_jetons bigint`, `cout_micro_centimes bigint`, `alerte_50_le null`, `alerte_80_le null`, `arret_le null` | unique `(portee, dossier_id, periode)` |
| `ia_appel` | MVP, autonome seulement | `dossier_id null`, `role`, `modele`, `version_consigne`, `statut` (`ok` \| `refuse` \| `echec`), `code null`, `tentatives`, `jetons_entree`, `jetons_sortie`, `jetons_cache` | aucun texte envoyé ni reçu ; en mode console, pas de table (journal des appels de la console) |
| `ia_fournisseur` | autonome seulement | inchangée du kit | mode console : registre du client (`PortRegistre`) |

### 3.10 Mise en service et sortie

| Table | Version | Colonnes | Clés, index, règles |
|---|---|---|---|
| `mise_en_route` | MVP | `etape`, `faite_le null`, `faite_par null` | unique `(etape)` |
| `demande_export` | MVP | `type` (`mes_donnees` \| `historique` \| `sortie`), `demande_par`, `etat` (`demandee` \| `prete` \| `telechargee` \| `expiree`), `demande_console_id null`, `document_id null`, `lien_expire_le null` (15 minutes au plus) | index `(cree_le)` ; l'export complet de sortie est fait par la console |
| `demande_suppression` | MVP | `demande_par`, `recapitulatif_empreinte`, `annulable_jusqu_au`, `annulee_le null`, `transmise_le null`, `demande_console_id null`, `reponse null` | n'efface **rien** dans l'outil ; refusée pendant un gel pour litige ; exécutée hors de l'outil |

## 4. Tables du kit (mode autonome seulement)

`user`, `session`, `account`, `verification`, `rate_limit`, `espace`, `membre`, `invitation`, `consentement`, `journal_audit` (comptes), `limite_frequence`, `element` : inchangées. Seules `session`, `verification`, `rate_limit` et `limite_frequence` connaissent les effacements techniques de la liste fermée de R3. En mode console, ces tables n'existent pas : les comptes sont ceux de la console.

## 5. Garde « jamais d'effacement »

1. Test de code (L01-T08) : refuse tout `.delete(` et tout texte SQL d'effacement dans `src/` (sauf la liste fermée des fichiers de la brique comptes du kit, mode autonome), et tout `UPDATE` sur une table de la section 0.1.
2. Base : mode console, aucun droit `DELETE` sur le schéma ; mode autonome, `REVOKE DELETE` et `refuser_effacement`.
3. Fichiers : port sans méthode d'effacement ; stockage sans droit de suppression.
4. Suppression définitive demandée (R4) : exécutée hors de l'outil, après le délai d'annulation, tracée ; aucun script de suppression dans le dépôt.
