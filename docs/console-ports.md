# Ports de la console : signatures, comportement, erreurs, faux serveur

Ce document fait foi pour toute fiche qui touche `src/lib/console/`. Il fixe le contrat entre l'outil « Appels d'offres » et la console des automatisations : les **ports** (interfaces TypeScript) que le code métier appelle, ce qu'ils font, ce qu'ils refusent, et le **faux serveur** qui les sert dans les essais.

Règles qui valent pour tout le document :

- Le code métier n'importe que `src/lib/console/ports/*`. Seuls `src/lib/console/mode.ts` et `src/lib/console/composition.ts` importent les adaptateurs (garde : test d'architecture de L01-T24). Une page, une route ou une tâche obtient ses ports par `ports()` de `src/lib/console/composition.ts` (L01-T59, section 11), jamais en important un adaptateur.
- Chaque port a trois implémentations : un adaptateur « console », un adaptateur « autonome » (repli) et le faux serveur. Les trois passent la **même suite de tests de contrat**.
- On ne développe et on n'essaie **jamais** contre la console réelle : seulement contre le faux serveur, avec des données fictives (entreprises inventées, e-mails en `@exemple.fr`).
- Aucun port n'a de méthode d'effacement, de dépôt sur une plateforme ou d'envoi vers un tiers (règles de fer 2 et 7).
- Les identifiants de client et d'établissement viennent **toujours** de la session, jamais d'un champ de la requête, d'une adresse ou d'un fichier (règle de fer 20, R181).
- Les dates sont des `Date` en UTC ; l'affichage en heure de Paris se fait dans les écrans.
- Le mot « console » désigne la console des automatisations ; son code n'est cité ici que par des noms d'interfaces génériques (`SessionPortail`, `PasserelleIa`, `EtatVoulu`, table d'envoi unique).

## 0. Carte des ports

| Port | Fichier (dépôt de l'outil) | Posé par la fiche | Faux serveur (fiche) |
|---|---|---|---|
| Erreurs communes `ErreurPort` | `src/lib/console/ports/identite.ts` | L01-T36 | — |
| Identité, session, permissions, client et établissement : `PortIdentite` | `src/lib/console/ports/identite.ts` | L01-T36 | L01-T38 |
| Base du module : `PortBaseModule` | `src/lib/console/ports/base-module.ts` | L01-T36 | L01-T39 |
| Journal d'audit : `PortJournal` | `src/lib/console/ports/journal.ts` | L01-T36 | L01-T39 |
| Registre du client : `PortRegistre` | `src/lib/console/ports/registre.ts` | L01-T36 | L01-T60 |
| État du contrat : `PortEtatContrat` | `src/lib/console/ports/etat-contrat.ts` | L01-T36 | L01-T38 |
| Export et demandes à la console : `PortDemandesConsole` | `src/lib/console/ports/console.ts` | L01-T38 | L01-T38 |
| Fichiers : `PortFichiers` | `src/lib/console/ports/fichiers.ts` | L01-T40 | L01-T40 |
| Passerelle d'IA : `PortIa` (alias `FournisseurIa`) | `src/lib/console/ports/ia.ts` | L01-T40 (réexporté par L05-T02) | L01-T40, complété par L05-T21 |
| Tâches : `PortTaches` | `src/lib/console/ports/taches.ts` | L01-T18 | L01-T18 (en mémoire) |
| Notifications : `PortNotifications` | `src/lib/console/ports/notifications.ts` | L01-T40 | L01-T40 |
| Alertes d'exploitation : `PortAlertes` | `src/lib/console/alertes.ts` | L07-T38 | L07-T38 (en mémoire, dans le même fichier) |
| Choix du mode : `Adaptateurs`, `choisirMode` | `src/lib/console/mode.ts` | L01-T57 | — |
| Racine de composition : `Ports`, `ports()` | `src/lib/console/composition.ts` | L01-T59 | — |

Adaptateurs : la base du module a ses deux adaptateurs (console et autonome) en L01-T61, avec la suite `suiteContratBaseModule` de L01-T39. Les adaptateurs console de l'identité, du registre, de l'état du contrat et des demandes n'ont pas encore de fiche : c'est voulu tant que la console n'a rien livré, et `ports()` refuse alors `AO_MODE=console` (`mode_incomplet`, en nommant le port).

Une fiche qui pose un fichier de port recopie **mot pour mot** la signature de ce document. Changer une signature = modifier d'abord ce document (PR relue), puis les fiches.

## 1. Erreurs communes

```ts
// src/lib/console/ports/identite.ts
export type CodeErreurPort =
  | 'non_connecte'               // aucune session valable
  | 'action_interdite'           // permission absente, mauvais royaume, contexte « outil » sur un geste de personne
  | 'reauthentification_requise' // deuxième facteur absent ou de plus de 5 minutes
  | 'introuvable'                // objet absent OU d'un autre client / établissement (même réponse, aucun indice)
  | 'schema_invalide'            // paramètre ou détail refusé (clé inconnue, nom, adresse, texte libre interdit)
  | 'ecriture_refusee'           // ordre SQL interdit au module (effacement, suppression de table, droits)
  | 'lecture_seule'              // l'état du contrat ferme ce geste
  | 'gel_litige'                 // un gel pour litige est posé : demande de suppression refusée
  | 'indisponible'               // la console ne répond pas : on refuse, on ne devine jamais
  | 'modele_non_admis' | 'hors_ue_refuse' | 'hors_manifeste' | 'plafond_atteint' // passerelle d'IA
  | 'cle_invalide'               // clé d'objet hors du motif
  | 'destinataire_refuse'        // notification vers une personne hors du compte
  | 'mode_inconnu' | 'mode_melange' | 'mode_incomplet'; // choix du mode au démarrage

export class ErreurPort extends Error {
  constructor(readonly code: CodeErreurPort, message: string) {
    super(message);
    this.name = 'ErreurPort';
  }
}
```

Comportement :
- Un port lève une `ErreurPort` ; il ne rend jamais `undefined` pour dire « refusé ».
- `introuvable` sert aussi pour un objet d'un autre client ou d'un établissement non accordé : la réponse ne dit jamais si l'objet existe ailleurs.
- `indisponible` : échec fermé. Une console injoignable ne vaut jamais « permis » (ni état du contrat déduit, ni refus hors UE levé, ni permission supposée).
- `reauthentification_requise`, `introuvable`, `action_interdite`, `schema_invalide` ont le même sens que les codes du contrat commun de la console : l'adaptateur console les recopie sans les traduire.
- Le `message` est une phrase simple pour l'écran, sans identifiant interne, sans nom, sans secret.

## 2. Identité, session, permissions, client et établissement

```ts
// src/lib/console/ports/identite.ts
export type ContexteIdentite = {
  clientId: string;
  acteur: string;
  roleClient: string;
  etablissements: string[];
  etablissementActif: string | null;
  permissions: string[];
  deuxiemeFacteurLe: Date | null;
  acr: string | null;
  acces: { type: 'client' } | { type: 'axion'; role: string; supportApprouve: boolean } | { type: 'console'; role: string; voirCommeClient: boolean };
};

export interface PortIdentite {
  lireSession(): Promise<ContexteIdentite | null>;
}
```

| Champ | Sens | Mode console | Mode autonome |
|---|---|---|---|
| `clientId` | le compte client (une entité juridique) | client de la session du portail (`SessionPortail`) | espace de la brique comptes du kit |
| `acteur` | identifiant stable de la personne connectée (jamais un nom ni un e-mail) | `SessionPortail.acteur` | identifiant de l'utilisateur du kit |
| `roleClient` | rôle du portail : `administrateur`, `utilisateur`, `lecture`, `comptable` ; `outil` pour une tâche | **non fourni aujourd'hui** : la session du portail ne porte que `role: client` ; le rôle du portail est demandé à la console ; d'ici là, refus des gestes qui demandent un rôle | `proprietaire` → `administrateur`, `membre` → `utilisateur` |
| `etablissements` | établissements que la personne peut voir | liste de la session du portail | habilitations du kit |
| `etablissementActif` | établissement choisi ; le seul si la liste n'en a qu'un ; `null` si plusieurs et aucun choisi | session | session |
| `permissions` | permissions du module accordées (liste ci-dessous) | permissions déclarées par le module et accordées par la console | habilitations de l'outil traduites (L01-T41) |
| `deuxiemeFacteurLe` | heure de la dernière connexion avec deuxième facteur ; `null` sinon | `auth_time` du jeton si `acr = mfa` | deuxième facteur de la brique comptes (L01-T12, L01-T41) |
| `acr` | niveau d'authentification lu dans le jeton | `acr` du jeton | `mfa` si le deuxième facteur du kit a servi, sinon `null` |
| `acces` | qui agit : une personne du client (`client`), une personne de l'équipe d'Axion (`axion` : rôle Aide aux clients, Technique, Sources ou Surveillance de l'IA ; `supportApprouve` = accès au compte accordé et tracé), ou la console en « voir comme le client » (`console` : `dirigeant`, `second_administrateur` ; lecture seule) | `client` pour une session du royaume des clients ; les deux autres ne sont pas exposés par la console aujourd'hui (demandés) | `client` ; `axion` pour l'administrateur technique d'Axion |

Permissions du module (motif `^[a-z][a-z0-9-]{1,40}$`) :

| Permission | Gestes | Accordée par défaut aux rôles du portail |
|---|---|---|
| `appels-offres-lire` | voir annonces, dossiers, historique | `administrateur`, `utilisateur`, `lecture` |
| `appels-offres-preparer` | retenir, écarter, préparer, déposer des pièces, relire | `administrateur`, `utilisateur` |
| `appels-offres-confirmer-envoi` | « Je confirme l'envoi », « J'ai envoyé moi-même », import de l'accusé | aucun : accordée nommément |
| `appels-offres-gerer-personnes` | personnes et rôles, suppléant, départ | `administrateur` |
| `appels-offres-sources` | suivre une source, mots de recherche, réglages de veille | `administrateur` |
| `appels-offres-exporter` | Mes données, export, demande de suppression | `administrateur` |
| `appels-offres-ia` | demander un brouillon (jamais envoyé seul) | `administrateur`, `utilisateur` |

Comportement de `lireSession()` :
1. Lit la session **côté serveur** (jeton vérifié : signature, émetteur du royaume des clients, audience, expiration). Aucun champ de la requête n'est lu.
2. Rend `null` si aucune session valable ; l'appelant répond `non_connecte`.
3. Un jeton du royaume de l'équipe sur une route client : `ErreurPort('action_interdite')`.
4. `etablissementActif` est toujours dans `etablissements` ou `null` ; sinon `action_interdite`.
5. Pour une **tâche** (exécuteur ou file du mode autonome), l'adaptateur construit lui-même le contexte : `acteur: 'outil'`, `roleClient: 'outil'`, `permissions: []`, `deuxiemeFacteurLe: null`, `acr: null`, `acces: { type: 'client' }`, `etablissements` = ceux de l'objet traité. Un contexte « outil » ne passe donc **aucune** garde de permission : il ne confirme rien, ne valide rien, n'exporte rien (règles de fer 1, 2, 18).

### 2.1 Critère du deuxième facteur (garde de L01-T12)

Un geste protégé passe seulement si `ctx.acr === 'mfa'` **et** `deuxiemeFacteurLe` date de 300 secondes au plus (tolérance d'horloge de 5 secondes dans le futur). Sinon : `ErreurPort('reauthentification_requise')`, et l'écran dit pourquoi. `amr` n'est lu **que** si la console l'adopte un jour ; aucun code ne s'y fie aujourd'hui.

Gestes protégés : confirmer un envoi, habiliter une personne, gérer les personnes et les rôles, exporter, demander une suppression, accès d'Axion à un compte.

En mode console, le royaume des clients n'a pas encore de deuxième facteur (demande faite à la console) : tant qu'il manque, ces gestes répondent `reauthentification_requise` ; on ne baisse jamais la règle.

## 3. Base du module

```ts
// src/lib/console/ports/base-module.ts
import type { ContexteIdentite } from './identite';

export type TransactionModule = {
  requete(sql: string, valeurs: unknown[]): Promise<unknown[]>;
};

export interface PortBaseModule {
  transaction<T>(ctx: ContexteIdentite, f: (tx: TransactionModule) => Promise<T>): Promise<T>;
}
```

Comportement :
1. La base est choisie **par `ctx.clientId` seulement** : mode console, la base propre au client (une par client), schéma `a_appels_offres` ; mode autonome, la base de l'outil, avec `espace_id = ctx.clientId` posé pour la transaction et la sécurité par ligne. Aucun paramètre ne permet de viser un autre client.
2. L'établissement est imposé par l'adaptateur : `ctx.etablissementActif` hors de `ctx.etablissements` → `action_interdite` ; le filtre des lectures par établissement est ajouté par `filtrerParEtablissement(ctx, requete)` (L01-T45), jamais écrit à la main dans une page.
3. `requete` refuse (`ecriture_refusee`, rien n'est exécuté) tout texte qui contient `DELETE`, `TRUNCATE`, `DROP`, `GRANT`, `REVOKE`, `ALTER ROLE` ou `SET ROLE`. Les migrations ne passent pas par ce port.
4. Une exception dans `f` annule toute la transaction ; rien n'est écrit à moitié.
5. Ajout seul : aucun `UPDATE` sur `historique`, `*_version`, `confirmation_envoi`, `confirmation_tombee`, `envoi`, `accuse`, `fichier_export` (tenu par le code et le test de L01-T08 ; la base du mode console ne peut pas l'imposer).
6. Un objet d'un autre client ou d'un établissement non accordé répond `introuvable`.

Tables et colonnes : `docs/modele-donnees.md`.

## 4. Journal d'audit

```ts
// src/lib/console/ports/journal.ts
import type { ContexteIdentite } from './identite';

export interface PortJournal {
  ecrire(
    ctx: ContexteIdentite,
    evenement: { type: string; cible: string; details: Record<string, string | number | boolean> },
  ): Promise<{ id: string }>;
}
```

Comportement :
1. Écrit une ligne dans le journal d'audit chaîné : celui de la console en mode console, celui de l'outil en mode autonome (L01-T06). La ligne ne se modifie ni ne s'efface jamais.
2. `type` : liste fermée, la même que `historique.type` : les types de `docs/modele-donnees.md` plus ceux de la section « Types de ligne de journal ajoutés le 08/11/2026 » ci-dessous (constante `TYPES_JOURNAL` de L01-T36) ; un autre type → `schema_invalide`.
3. `cible` : `<type d'objet>:<identifiant>` (par exemple `dossier:<uuid>`).
4. `details` : identifiants, codes, nombres et booléens **seulement**. Refusés (`schema_invalide`) : une clé `nom`, `prenom`, `email`, `telephone`, `adresse`, `ip`, `texte`, `contenu`, `prix`, `secret`, `mot_de_passe` ; une valeur qui ressemble à une adresse e-mail ; une valeur de plus de 200 caractères.
5. Aucune adresse réseau n'est passée par l'outil (la console tient elle-même son empreinte d'adresse).
6. Ordre d'écriture (L01-T46) : d'abord `ecrire()`, puis la ligne d'`historique` avec `audit_id = id` rendu. Si `ecrire()` échoue, le geste est refusé (`indisponible`) et rien n'est écrit dans `historique`.
7. Lecture de l'empreinte d'une ligne pour l'afficher : par `PortDemandesConsole.lireEmpreinteJournal` (section 6).

Événements qui passent toujours par ce port : envoi confirmé, envoi déclaré, dépôt noté hors de l'outil, accusé confirmé, habilitation accordée ou retirée, accès d'Axion, export demandé, suppression demandée, refus d'IA, consigne ignorée, accès refusé, envoi refusé.

## 5. Registre du client

```ts
// src/lib/console/ports/registre.ts
export interface PortRegistre {
  refusHorsUe(clientId: string): Promise<boolean>;
  fournisseurIa(clientId: string): Promise<string | null>;
}
```

Comportement :
- `refusHorsUe` rend `true` par défaut, et `true` si l'information manque ou si la console ne répond pas (échec fermé). Le modèle Claude est noté hors Union européenne : tant que `refusHorsUe` vaut `true`, aucun appel d'IA ne part et l'écran dit « L'aide de l'outil n'est pas ouverte pour votre compte ».
- `fournisseurIa` rend le code du modèle admis pour ce client, ou `null` (IA fermée).
- `clientId` vient toujours de `ctx.clientId`.
- L'outil ne modifie jamais le registre : lever le refus est un geste tracé de l'équipe de la console, après accord écrit du client.

## 6. État du contrat, export et demandes à la console

### 6.1 `PortEtatContrat`

```ts
// src/lib/console/ports/etat-contrat.ts
export type EtatContrat = 'essai' | 'actif' | 'facture_en_attente' | 'lecture_seule' | 'suspendu' | 'fin' | 'inconnu';

export interface PortEtatContrat {
  lire(clientId: string): Promise<{ etat: EtatContrat; gelLitige: boolean; depuis: Date | null }>;
}
```

Correspondance (l'outil interroge et obéit, il ne décide jamais) :

| `etat` | Lu dans la console (état voulu de l'instance et dates exposées) | Veille, IA | Préparer, modifier | Confirmer un envoi | Gestes de trace (*) | Lire | Exporter |
|---|---|---|---|---|---|---|---|
| `essai` | `actif` + fin d'essai future | oui | oui | oui | oui | oui | oui |
| `actif` | `actif` | oui | oui | oui | oui | oui | oui |
| `facture_en_attente` | `actif` + impayé signalé (délai de grâce) | oui | oui | oui | oui | oui | oui |
| `lecture_seule` | `pause`, ou `actif` + fin d'essai passée | non | non | non | oui | oui (mode autonome) ; mode console : voir 7 bis | oui |
| `suspendu` | `arrete`, contrat en cours | non | non | non | oui | oui (R187 ; mode autonome) ; mode console : voir 7 bis | oui (R187) ; un risque de sécurité ne ferme l'export que par une décision tracée de la console |
| `fin` | `arrete` + date de fin passée + accès en lecture encore ouvert | non | non | non | oui | oui (90 jours) | oui (lecture 90 jours ; export à tout moment, R187) |
| `inconnu` | données absentes, version ignorée ou console injoignable | non | non | non | non | oui | oui |

(*) Gestes de trace permis en lecture seule (R187) : importer et contrôler un accusé de réception, noter un dépôt fait en dehors de l'outil, importer un courrier de l'acheteur, noter un résultat. Chacun est inscrit au journal.

Droits d'usage et paiement : `droitsUsage` absent ou vide dans l'état voulu : aucune fonction de l'outil ouverte (veille, IA, préparation fermées) ; `paiementConstate` n'est pas lu pour l'état (il ne dit pas « impayé »).

Comportement :
1. Les champs absents du contrat de la console sont **inconnus, jamais déduits** : sans date de fin d'essai, l'outil ne dit pas « essai ». Le faux serveur marque ces champs « demandés, absents du contrat C4 0.5.0 ».
2. Un état voulu de version inférieure ou égale à la dernière connue est ignoré (aucun retour en arrière par rejeu).
3. `gelLitige = true` : aucune demande de suppression n'est acceptée (`gel_litige`) ; Mes données affiche « Données gelées pour un litige depuis le jj/mm/aaaa : rien ne peut être supprimé tant que le gel dure. » L'outil ne pose ni ne lève jamais un gel.
4. `depuis` : date du dernier changement d'état, ou `null` si inconnue.
5. Aucun changement d'état n'efface, ne masque ni ne chiffre une donnée (R3, R187).
6. Arrêt des envois demandé par la console : aucune notification ne part, quel que soit l'état (section 9).
7. En mode console, une base gelée n'est pas lisible aujourd'hui : tant que la console n'a pas ouvert la lecture seule après la fin, l'export est la seule voie et Mes données le dit : « Après la fin du contrat, vos données sont remises par l'export ; la lecture dans l'outil n'est pas encore ouverte. »
7 bis. En mode console, aujourd'hui, une instance en `pause` n'est plus lisible (le code de la console refuse toute instance qui n'est pas `actif` ou qui est en pause pour impayé) : pour `lecture_seule`, la colonne « Lire » vaut « non, export seulement » tant que la console n'a pas étendu la demande sur la lecture après la fin à la pause. Même chose pour `suspendu` (instance `arrete`) : la lecture passe par l'export tant que la console ne l'a pas ouverte. Le délai de grâce (`facture_en_attente`) reste lisible (NON VÉRIFIÉ dans le code).
8. Mode autonome : l'état vient du réglage local, modifiable par l'administrateur technique d'Axion seulement (L01-T21, L07-T36).

### 6.2 `PortDemandesConsole` (export, suppression, empreinte du journal)

```ts
// src/lib/console/ports/console.ts
import type { ContexteIdentite } from './identite';

export type TypeExport = 'mes_donnees' | 'historique' | 'sortie';
export type EtatExport = 'demandee' | 'prete' | 'telechargee' | 'expiree';

export interface PortDemandesConsole {
  demanderExport(ctx: ContexteIdentite, demande: { type: TypeExport }): Promise<{ demandeId: string; etat: 'demandee' }>;
  lireExport(ctx: ContexteIdentite, demandeId: string): Promise<{ etat: EtatExport; lien: { url: string; expireLe: Date } | null }>;
  demanderSuppression(ctx: ContexteIdentite, demande: { motif: string; recapitulatifEmpreinte: string }): Promise<{ demandeId: string; etat: 'transmise' }>;
  lireEmpreinteJournal(ctx: ContexteIdentite, auditId: string): Promise<{ empreinte: string; chaineVerifiee: boolean }>;
}
```

Comportement :
- `demanderExport` et `demanderSuppression` exigent la permission `appels-offres-exporter` et le deuxième facteur (section 2.1) ; sinon `action_interdite` ou `reauthentification_requise`. Chaque demande passe d'abord par `PortJournal`.
- L'export complet est fait **par la console** (tables du module, fichiers du préfixe `appels-offres/`, manifeste signé). Avant l'export, l'outil range seulement un contenu lisible sous `appels-offres/<etablissement>/export/` par `PortFichiers` (index des dossiers, offre envoyée, liste des pièces avec empreintes, historique).
- `lien` : lien signé de 15 minutes au plus ; `null` tant que l'export n'est pas prêt.
- `demanderSuppression` n'efface **rien** : elle transmet une demande, que la console exécute après sa procédure (double validation, délai d'annulation). Refusée avec `gel_litige` si un gel est posé ; `motif` : 500 caractères au plus, jamais copié dans le journal.
- Aucune méthode de dépôt sur une plateforme d'acheteur, d'envoi vers un tiers ni d'effacement. « Déposer un envoi » au sens d'une fiche = inscrire une notification par `PortNotifications` (section 10), jamais un dépôt d'offre (règle de fer 2).

## 7. Fichiers

```ts
// src/lib/console/ports/fichiers.ts
import type { ContexteIdentite } from './identite';

export type FamilleFichier = 'acheteur' | 'entreprise' | 'export' | 'accuse' | 'quarantaine' | 'ancien';

export interface PortFichiers {
  deposer(
    ctx: ContexteIdentite,
    fichier: { etablissementId: string; famille: FamilleFichier; octets: Uint8Array; typeReel: string },
  ): Promise<{ cle: string; empreinteSha256: string; tailleOctets: number }>;
  lire(ctx: ContexteIdentite, cle: string): Promise<Uint8Array>;
  existe(ctx: ContexteIdentite, cle: string): Promise<boolean>;
  lienTelechargement(ctx: ContexteIdentite, cle: string, dureeSecondes: number): Promise<{ url: string; expireLe: Date }>;
}
```

Comportement :
1. Clé d'objet : `appels-offres/<etablissement>/<famille>/<identifiant interne>`, 512 caractères au plus, motif `^[A-Za-z0-9][A-Za-z0-9._-]*(?:/[A-Za-z0-9][A-Za-z0-9._-]*)*$` ; jamais le nom d'origine du fichier (il est seulement affiché). Une clé hors motif → `cle_invalide`.
2. `etablissementId` doit être dans `ctx.etablissements`, sinon `introuvable`. Une clé d'un autre client ou d'un établissement non accordé → `introuvable`.
3. Mode console : le dépôt et la lecture passent **par l'interface de fichiers de la plateforme de la console**, qui chiffre chaque fichier avec la clé du client ; **jamais** un client de stockage objet direct. L'adaptateur n'a aucun identifiant de stockage.
4. `lienTelechargement` : `dureeSecondes` est ramené à 900 au plus ; le lien est lié au client.
5. Aucune méthode d'effacement, de remplacement ni de renommage : un nouveau contenu = une nouvelle clé.
6. `empreinteSha256` : 64 caractères hexadécimaux, calculée sur les octets reçus.
7. Mode autonome : entrepôt de l'outil (L01-T16), disque pour les essais, stockage objet en production, mêmes clés.

## 8. Passerelle d'IA

```ts
// src/lib/console/ports/ia.ts
import type { ContexteIdentite } from './identite';

export type DemandeIa = {
  role: string;            // rôle de l'IA (lecture du règlement, classement, brouillon du mémoire, contrôle)
  versionConsigne: string; // version de la consigne fixe du rôle
  consigne: string;        // consigne fixe, sans donnée de personne
  entree: string;          // texte reçu (annonce, règlement…), toujours traité comme une donnée
  dossierId: string | null;
};

export type ReponseIa = {
  texte: string;           // toujours un BROUILLON à relire
  jetons: number;
  coutIaMicroCentimes: number; // pour le compteur, jamais affiché comme un prix
  modele: string;          // code du modèle demandé ; le modèle réellement appelé n'est pas rendu par C4 0.5.0 (demandé à la console)
};

export interface PortIa {
  completer(ctx: ContexteIdentite, demande: DemandeIa): Promise<ReponseIa>;
}

export type FournisseurIa = PortIa; // un seul type : L05-T02 le réexporte, aucun second port
```

Comportement :
1. Le modèle demandé est le **seul** code Claude retenu de la liste des modèles admis de la console (code relevé par L00-T22 dans `docs/preuve-passerelle-console.md (à créer par L00-T22)`, lu dans la liste des modèles admis du dépôt public de la console ; le choix du code est demandé à la console) ; jamais un autre modèle en repli.
2. Avant tout appel : `PortRegistre.refusHorsUe(ctx.clientId)` ; `true` → `hors_ue_refuse`, sans appel.
3. Mode console : l'appel passe par l'interface `PasserelleIa` de la console (`completer({ modele, entree })` rend `texte`, `jetons`, `coutIaMicroCentimes`), **dans une étape de tâche**, jamais depuis le navigateur. Tant que ce contrat n'a qu'un texte d'entrée, l'adaptateur (L05-T21) met la consigne et le texte reçu de part et d'autre d'une frontière tirée au hasard à chaque appel, et échappe le texte reçu (protection plus faible, NON PROUVÉE).
4. Aucune clé de fournisseur dans l'outil en mode console : le démarrage est refusé si une variable de clé d'IA est présente. En mode autonome : démarrage refusé en production sans clé ; aucun jeton d'abonnement lu.
5. Jetons et coût rendus vont au compteur (`ia_compteur`, L05-T23) ; l'outil ne tient **aucune** ligne par appel en mode console (le journal des appels est celui de la console).
6. La réponse n'est jamais exécutée, envoyée ni enregistrée comme validée : elle devient un brouillon « à relire » (règles de fer 1 et 18).

Erreurs et message montré (texte exact des écrans : R110, R112 du SPEC) :

| Code | Cause | Ce que fait l'outil |
|---|---|---|
| `modele_non_admis` | le code du modèle n'est pas dans la liste admise | refus, aucun autre modèle ; alerte à Axion |
| `hors_ue_refuse` | refus de transfert hors Union européenne pour ce client | « L'aide de l'outil n'est pas ouverte pour votre compte » ; le travail continue à la main |
| `hors_manifeste` | modèle absent de la liste déclarée par le module | refus, alerte à Axion |
| `plafond_atteint` | plafond du module ou de la clé du client atteint | arrêt propre en fin d'étape, message de R110, reprise après accord d'une personne |
| `indisponible` | passerelle hors service ou délai dépassé | message de R112 ; rien de déjà écrit n'est perdu |

## 9. Tâches

```ts
// src/lib/console/ports/taches.ts
import type { ContexteIdentite } from './identite';

export type NomTache =
  | 'veille_source' | 'analyse_dossier' | 'brouillon_memoire'
  | 'rappel_accuse' | 'rappel_echeance' | 'archivage_ecartes' | 'quarantaine_30j';

export type DefinitionTache = {
  nom: NomTache;
  objetType: string;
  objetId: string;
  echeance: Date | null;
  charge: Record<string, string | number | boolean>; // identifiants et codes seulement
};

export type EtatTache = 'attente' | 'en_cours' | 'faite' | 'echec' | 'annulee';

export interface PortTaches {
  planifier(ctx: ContexteIdentite, tache: DefinitionTache): Promise<{ tacheId: string; nouvelle: boolean }>;
  etat(ctx: ContexteIdentite, tacheId: string): Promise<EtatTache>;
  battement(): Promise<{ vivant: boolean; dernierPassage: Date | null }>;
}

export const cleIdempotence = (t: DefinitionTache): string =>
  `${t.nom}:${t.objetType}:${t.objetId}:${t.echeance ? t.echeance.toISOString() : '-'}`;
```

Comportement :
1. Idempotence : deux `planifier` de même clé rendent le même `tacheId`, `nouvelle: false` ; un double clic ne crée jamais deux tâches.
2. Les tâches périodiques (veille, rappels, archivage, quarantaine) ne passent pas par `planifier` : elles sont déclarées au manifeste du module (déclencheur `cron`, ou `sondage` avec curseur pour la veille) en mode console, et par l'adaptateur de file en mode autonome. `planifier` sert aux tâches créées par un geste (`analyse_dossier`, `brouillon_memoire`).
3. Une tâche s'exécute avec un contexte « outil » (section 2, point 5) : elle ne peut ni confirmer, ni envoyer, ni valider, ni effacer. **Aucune action automatique** n'est déclarée (liste du manifeste vide).
4. Après une coupure, l'état est recalculé depuis la base ; aucune reprise ne refait un effet déjà fait.
5. `charge` : aucune donnée métier, aucun nom, aucun texte (les journaux d'exécution de la console ne gardent que des identifiants et des codes).
6. Mode console : exécuteur de la console. Mode autonome : BullMQ 6.4.2 + ioredis 6.0.0 (versions de la console) sur un Valkey propre au mode autonome ; essais : adaptateur en mémoire, aucune connexion ouverte en CI.

### 9.1 Alertes d'exploitation : `PortAlertes`

Sert aux pannes des tâches de l'outil (source en panne, rappel non parti, quarantaine au 30e jour, conversion en échec, sauvegarde ou restauration non faite, tâche qui ne tourne plus). Ce n'est pas une notification : rien ne part vers une personne du compte ; l'alerte va à l'équipe d'Axion (file d'alertes de la console en mode console, service de battements du kit en mode autonome).

```ts
// src/lib/console/alertes.ts (posé par L07-T38)
export type FamilleAlerte = 'source' | 'rappel' | 'quarantaine' | 'conversion' | 'sauvegarde' | 'tache';

export type Alerte = {
  clientId: string;
  cle: string;          // `appels-offres.<famille>.<cause>`, motif ^[a-z][a-z0-9_.-]{0,63}$
  famille: FamilleAlerte;
  cause: string;        // code court, jamais un texte reçu
  survenueLe: Date;
  objet: { type: string; id: string } | null; // identifiants seulement
};

export interface PortAlertes {
  signaler(alerte: Alerte): Promise<{ resultat: 'ouverte' | 'deja_ouverte'; occurrences: number }>;
}
```

Comportement :
1. Une seule alerte en cours par client et par `cle` : un second `signaler` de même client et même clé rend `deja_ouverte` et augmente `occurrences`.
2. `cle` hors du motif (majuscule, trop longue, autre préfixe) : `ErreurPort('cle_invalide')` (code commun, section 1), rien n'est écrit.
3. Aucun nom de client, aucune donnée de dossier, aucun texte d'annonce dans l'alerte : seulement des identifiants et des codes (même règle que `charge`, section 9).
4. L'outil ne clôt jamais une alerte : la clôture appartient à l'équipe (console) ou au service de battements (autonome).
5. Mode console : écriture dans la file d'alertes de la console (clé de regroupement au format de la console, `^[a-z0-9][a-z0-9_.:-]{0,127}$`, que le motif de l'outil respecte) ; tant que la console n'expose pas cette écriture au module, l'adaptateur console n'existe pas et `ports()` refuse `AO_MODE=console` (`mode_incomplet`, section 0). Mode autonome : même forme vers le service de battements du kit. Essais : adaptateur en mémoire.
6. Avant L07-T38 (lots 1 à 6), une tâche qui ne tourne plus est seulement visible par le battement (`PortTaches.battement()`, `dernierPassage`, L01-T19) : aucune alerte ne part encore. L07-T38 branche ensuite chaque panne sur `signaler`, y compris le battement absent de L01-T19. Aucun nouveau type de ligne de journal n'est créé pour cela (la liste de `historique.type` reste fermée).

## 10. Notifications

```ts
// src/lib/console/ports/notifications.ts
import type { ContexteIdentite } from './identite';

export type EvenementAo =
  | 'aoRappelAccuse1h' | 'aoRappelAccuse24h' | 'aoRappelAccuseQuotidien'
  | 'aoEcheanceProche' | 'aoPieceExpire' | 'aoSourceEnErreur'
  | 'aoBudgetIa80' | 'aoBudgetIa100' | 'aoTropAnnonces' | 'aoQuarantaine30j';

export interface PortNotifications {
  notifier(
    ctx: ContexteIdentite,
    notification: { evenement: EvenementAo; destinataireActeur: string; cible: { type: string; id: string } },
  ): Promise<{ resultat: 'inscrit' | 'non_declare' | 'coupe' }>;
}
```

Comportement :
1. Mode console : inscription d'un événement dans la **table d'envoi unique** de la console ; l'outil n'envoie jamais un e-mail lui-même (la table de la console nomme une catégorie de destinataire, `table.ts` l.4 ; l'envoi à une personne précise du compte est à confirmer par la console, à ajouter à la demande sur la table d'envoi). Mode autonome : expéditeur de l'outil (L01-T35), avec une table d'envois de même forme.
2. `destinataireActeur` doit être une personne active du compte (`exigerDestinataireInterne`) ; sinon `destinataire_refuse`. Jamais un acheteur, jamais une adresse saisie.
3. `non_declare` : l'événement n'existe pas (encore) dans la table de la console ; rien ne part et le rappel s'affiche seulement dans l'outil.
4. `coupe` : arrêt des envois demandé par la console, ou interrupteur de l'événement fermé ; rien ne part.
5. Le contenu n'a aucun lien qui change un état (un lien ouvre l'outil, la personne agit ensuite elle-même).
6. Les seuils d'IA suivent le compteur (L05-T23) : 50 % et 80 % une fois par seuil et par période, 100 % à l'arrêt.

## 11. Choix du mode

```ts
// src/lib/console/mode.ts
export type NomPort =
  | 'identite' | 'baseModule' | 'journal' | 'fichiers' | 'ia'
  | 'taches' | 'notifications' | 'etatContrat' | 'registre' | 'demandesConsole';

export type Adaptateurs = Record<NomPort, { mode: 'console' | 'autonome' } | undefined>;

export type DemandesBloquantes = ReadonlyArray<{ numero: string; livree: boolean }>;

export function choisirMode(
  env: Record<string, string | undefined>,
  adaptateurs: Adaptateurs,
  demandesBloquantes?: DemandesBloquantes,
): 'console' | 'autonome';
```

Comportement :
1. `AO_MODE` absent → `autonome`. `AO_MODE` vaut `autonome` ou `console` ; toute autre valeur → `mode_inconnu`.
2. Un mélange (un adaptateur d'un mode dans l'autre) → `mode_melange`, en nommant le port.
3. En mode `console`, toute clé `undefined` → `mode_incomplet`, en nommant le port.
4. `AO_MODE` est le **seul** interrupteur de l'outil pour le mode ; l'ouverture de la zone de l'outil dans le portail est un réglage de la console.
5. Le mode `console` est refusé (`mode_incomplet`) tant que `demandesBloquantes` est absent ou qu'une demande n'y est pas `livree` (registre rempli par L07-T35) : l'intégration doit être acceptée par l'équipe de la console et les demandes bloquantes livrées.
6. La clé `demandesConsole` (port de la section 6.2) fait partie du registre des adaptateurs au même titre que les neuf autres : en mode `console`, son absence est refusée comme celle de tout autre port.

### 11.1 Racine de composition (L01-T59)

```ts
// src/lib/console/composition.ts
import type { PortIdentite } from './ports/identite';
import type { PortBaseModule } from './ports/base-module';
import type { PortJournal } from './ports/journal';
import type { PortFichiers } from './ports/fichiers';
import type { PortIa } from './ports/ia';
import type { PortTaches } from './ports/taches';
import type { PortNotifications } from './ports/notifications';
import type { PortEtatContrat } from './ports/etat-contrat';
import type { PortRegistre } from './ports/registre';
import type { PortDemandesConsole } from './ports/console';

export type Ports = {
  identite: PortIdentite;
  baseModule: PortBaseModule;
  journal: PortJournal;
  fichiers: PortFichiers;
  ia: PortIa;
  taches: PortTaches;
  notifications: PortNotifications;
  etatContrat: PortEtatContrat;
  registre: PortRegistre;
  demandesConsole: PortDemandesConsole;
};

export function ports(env: Record<string, string | undefined>): Ports;
```

Comportement :
1. Mode autonome (`AO_MODE` absent ou `autonome`) : rend les adaptateurs autonomes (journal de L01-T06, fichiers de L01-T16, tâches de L01-T18, e-mails de L01-T35, identité de L01-T41) ; tant qu'un adaptateur autonome manque, le faux de L01-T38 à L01-T40 ou de L01-T60 (registre du client) prend sa place, et le port est nommé dans un avertissement au démarrage.
2. `AO_MODE=console` : appelle `choisirMode(env, adaptateurs, demandesBloquantes)` (section 11), puis refuse (`mode_incomplet`, une `ErreurPort`, en nommant le port) tant qu'un adaptateur console manque ; jamais un faux en mode console.
3. Une page, une route ou une tâche obtient ses ports par `ports()`, jamais en important un adaptateur. Une fiche qui livre un adaptateur le branche dans `ports()` (par exemple L05-T21 pour l'IA, L01-T61 pour la base).

## 12. Faux serveur de la console

Lieu : `src/lib/console/faux/` du dépôt de l'outil. En mémoire et en HTTP local (`node:http`, aucune dépendance), données **fictives** seulement. Il ne parle jamais à la console réelle.

| Partie | Fiche | Ce qu'il imite | Cas fournis |
|---|---|---|---|
| Identité et permissions | L01-T38 | session du portail, jeton signé d'essai, permissions `appels-offres-*` | client A à deux établissements, client B à un seul ; jeton avec `acr = mfa` récent, sans `acr = mfa`, trop vieux (6 minutes), royaume de l'équipe sur une route client ; identités de l'équipe d'Axion et de la console pour la non-levée (L01-T60) |
| État du contrat et demandes | L01-T38 | état voulu de l'instance, fin d'essai, impayé, fin, gel pour litige ; export et demande de suppression | chaque `etat` de la section 6 ; rejeu d'une version ancienne ignoré ; champs marqués « demandés, absents du contrat C4 0.5.0 » |
| Registre du client | L01-T60 | registre du client (refus hors UE, modèle admis) | client inconnu → `refusHorsUe = true` |
| Base du module | L01-T39 | deux bases fictives séparées, client A et client B, chacune avec son schéma `a_appels_offres` (sur une base en mémoire) | lecture de A depuis une session de B → `introuvable` ; établissement absent de la session → refus |
| Journal | L01-T39 | journal chaîné en ajout seul, chaîne d'empreintes, attestation d'essai | détail avec un nom ou une adresse → `schema_invalide` |
| Stockage | L01-T40 | compartiment par client, aucune suppression, lien de 900 secondes au plus | clé hors motif, clé d'un autre client, lien demandé à 24 h ramené à 15 minutes |
| Passerelle d'IA | L01-T40, L05-T21 | réponses enregistrées, jetons et coût | chaque code de la section 8 |
| Table d'envoi | L01-T40 | puits qui garde les événements inscrits | événement non déclaré → `non_declare` ; arrêt des envois → `coupe` |

Suites de contrat exportées (une par port, même nom de forme `suiteContrat<Port>(port)`) : par exemple `suiteContratIdentite(port)` dans `src/lib/console/faux/suite-contrat-identite.ts`. Le faux serveur, l'adaptateur autonome et, plus tard, l'adaptateur console passent la même suite.

Ce que le faux serveur n'invente pas : un champ que la console n'expose pas est marqué « demandé, absent du contrat » ; un test vérifie qu'un état voulu **sans** ces champs est accepté par le schéma copié du contrat.

## Types de ligne de journal ajoutés le 08/11/2026

Ajout par migration additive seulement ; la liste reste fermée. Une phrase par type ; `details` garde la règle 4 ci-dessus (identifiants, codes, nombres, booléens).

| Type | Quand la ligne s'écrit |
|---|---|
| `reglage_change` | Un réglage du compte change (clé, ancienne et nouvelle valeur codées, auteur) ; seul type pour un réglage ou un paramètre, R250 (`parametre_modifie` n'existe pas). |
| `deuxieme_facteur_active` | Une personne active son deuxième facteur ; la confirmation d'envoi lui devient possible (R180). |
| `secret_revoque` | Un secret ou une clé de connexion est révoqué (R198). |
| `courrier_importe` | Un courrier reçu par e-mail est importé dans un dossier (R227). |
| `etape_changee` | Un dossier change d'étape (ancienne et nouvelle étape). |
| `membre_retire` | Un membre est retiré d'un groupement ou de la liste des sous-traitants d'un dossier. |
| `connexion_modifiee` | Une connexion du compte est révoquée, renouvelée ou coupée après un incident de fuite. |
| `gel_pose` | Un gel des effacements est posé sur un compte (motif codé). |
| `gel_leve` | Ce gel est levé (motif codé). |
| `annexe_acceptee` | Le client accepte une annexe de ses conditions (version de l'annexe). |
| `source_accord` | Le client donne son accord pour suivre une source (R159). |
| `source_degradee` | Une source passe « surveillance dégradée » (R156). |
| `lien_refuse` | Un lien ajouté par la personne est refusé (code du refus, R167). |
| `fichier_en_attente` | Un fichier est mis en attente parce que l'analyse antivirus est indisponible (R170). |
| `ia_accord_note` | L'accord écrit du client pour l'IA hors de l'Union européenne est noté (R235). |
| `ia_accord_retire` | Cet accord est retiré (R235). |
| `controle_retire` | Un contrôle de qualité retirable est retiré d'un dossier, avec son motif codé (R105). |

