import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const instant = (nom: string) => timestamp(nom, { withTimezone: true });

// Tables de la librairie d'authentification (noms de champs imposés par elle).
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  desactiveLe: instant("desactive_le"),
  // Compte créé par le formulaire public : son mot de passe est neutralisé à la première vérification de l'adresse.
  autoInscrit: boolean("auto_inscrit").notNull().default(false),
  // Compte jamais vérifié après 24 h : désactivé (jamais effacé), son adresse est libérée pour une nouvelle inscription.
  expireLe: instant("expire_le"),
  emailInitial: text("email_initial"),
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: instant("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: instant("access_token_expires_at"),
  refreshTokenExpiresAt: instant("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: instant("expires_at").notNull(),
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
});

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// Tables de l'outil.
export const espace = pgTable("espace", {
  id: text("id").primaryKey(),
  nom: text("nom").notNull(),
  essaiJusquAu: instant("essai_jusqu_au"),
  creeLe: instant("cree_le").notNull().defaultNow(),
});

export const membre = pgTable(
  "membre",
  {
    id: text("id").primaryKey(),
    espaceId: text("espace_id").notNull().references(() => espace.id),
    utilisateurId: text("utilisateur_id").notNull().references(() => user.id),
    role: text("role").notNull(),
    creeLe: instant("cree_le").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("membre_utilisateur_unique").on(t.utilisateurId),
    index("membre_espace_idx").on(t.espaceId),
    check("membre_role_valide", sql`${t.role} in ('proprietaire', 'membre')`),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    espaceId: text("espace_id").references(() => espace.id),
    email: text("email").notNull(),
    role: text("role").notNull(),
    codeHash: text("code_hash").notNull(),
    expireLe: instant("expire_le").notNull(),
    utiliseeLe: instant("utilisee_le"),
    inviteParId: text("invite_par_id").references(() => user.id),
    creeLe: instant("cree_le").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invitation_code_unique").on(t.codeHash),
    check("invitation_role_valide", sql`${t.role} in ('proprietaire', 'membre')`),
  ],
);

export const consentement = pgTable("consentement", {
  id: text("id").primaryKey(),
  utilisateurId: text("utilisateur_id").notNull().references(() => user.id),
  document: text("document").notNull(),
  version: text("version").notNull(),
  accepteLe: instant("accepte_le").notNull().defaultNow(),
});

export const journalAudit = pgTable(
  "journal_audit",
  {
    id: text("id").primaryKey(),
    espaceId: text("espace_id"),
    utilisateurId: text("utilisateur_id"),
    action: text("action").notNull(),
    details: text("details"),
    creeLe: instant("cree_le").notNull().defaultNow(),
  },
  (t) => [index("journal_audit_utilisateur_idx").on(t.utilisateurId)],
);

export const limiteFrequence = pgTable(
  "limite_frequence",
  {
    id: text("id").primaryKey(),
    cle: text("cle").notNull(),
    creeLe: instant("cree_le").notNull(),
  },
  (t) => [index("limite_frequence_cle_idx").on(t.cle, t.creeLe)],
);

// Exemple de données propres à un espace : chaque lecture est filtrée par espace.
export const element = pgTable(
  "element",
  {
    id: text("id").primaryKey(),
    espaceId: text("espace_id").notNull().references(() => espace.id),
    titre: text("titre").notNull(),
    creeParId: text("cree_par_id").notNull().references(() => user.id),
    creeLe: instant("cree_le").notNull().defaultNow(),
  },
  (t) => [index("element_espace_idx").on(t.espaceId)],
);

export const schema = {
  user, session, account, verification, rateLimit,
  espace, membre, invitation, consentement, journalAudit, limiteFrequence, element,
};
