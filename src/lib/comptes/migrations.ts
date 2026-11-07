// Migrations de la base, appliquées dans l'ordre et une seule fois chacune.
// Le texte doit rester identique à ce que décrit schema.ts (un test le vérifie).
export type Migration = { id: string; instructions: string[] };

export const migrations: Migration[] = [
  {
    id: "0001_comptes",
    instructions: [
      `CREATE TABLE "user" (
        "id" text PRIMARY KEY,
        "name" text NOT NULL,
        "email" text NOT NULL UNIQUE,
        "email_verified" boolean NOT NULL DEFAULT false,
        "image" text,
        "desactive_le" timestamp with time zone,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE "session" (
        "id" text PRIMARY KEY,
        "expires_at" timestamp with time zone NOT NULL,
        "token" text NOT NULL UNIQUE,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        "ip_address" text,
        "user_agent" text,
        "user_id" text NOT NULL REFERENCES "user"("id")
      )`,
      `CREATE TABLE "account" (
        "id" text PRIMARY KEY,
        "account_id" text NOT NULL,
        "provider_id" text NOT NULL,
        "user_id" text NOT NULL REFERENCES "user"("id"),
        "access_token" text,
        "refresh_token" text,
        "id_token" text,
        "access_token_expires_at" timestamp with time zone,
        "refresh_token_expires_at" timestamp with time zone,
        "scope" text,
        "password" text,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE "verification" (
        "id" text PRIMARY KEY,
        "identifier" text NOT NULL,
        "value" text NOT NULL,
        "expires_at" timestamp with time zone NOT NULL,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE "rate_limit" (
        "id" text PRIMARY KEY,
        "key" text NOT NULL UNIQUE,
        "count" integer NOT NULL,
        "last_request" bigint NOT NULL
      )`,
      `CREATE TABLE "espace" (
        "id" text PRIMARY KEY,
        "nom" text NOT NULL,
        "essai_jusqu_au" timestamp with time zone,
        "cree_le" timestamp with time zone NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE "membre" (
        "id" text PRIMARY KEY,
        "espace_id" text NOT NULL REFERENCES "espace"("id"),
        "utilisateur_id" text NOT NULL REFERENCES "user"("id"),
        "role" text NOT NULL,
        "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "membre_role_valide" CHECK ("role" in ('proprietaire', 'membre'))
      )`,
      `CREATE UNIQUE INDEX "membre_utilisateur_unique" ON "membre" ("utilisateur_id")`,
      `CREATE INDEX "membre_espace_idx" ON "membre" ("espace_id")`,
      `CREATE TABLE "invitation" (
        "id" text PRIMARY KEY,
        "espace_id" text REFERENCES "espace"("id"),
        "email" text NOT NULL,
        "role" text NOT NULL,
        "code_hash" text NOT NULL,
        "expire_le" timestamp with time zone NOT NULL,
        "utilisee_le" timestamp with time zone,
        "invite_par_id" text REFERENCES "user"("id"),
        "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "invitation_role_valide" CHECK ("role" in ('proprietaire', 'membre'))
      )`,
      `CREATE UNIQUE INDEX "invitation_code_unique" ON "invitation" ("code_hash")`,
      `CREATE TABLE "consentement" (
        "id" text PRIMARY KEY,
        "utilisateur_id" text NOT NULL REFERENCES "user"("id"),
        "document" text NOT NULL,
        "version" text NOT NULL,
        "accepte_le" timestamp with time zone NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE "journal_audit" (
        "id" text PRIMARY KEY,
        "espace_id" text,
        "utilisateur_id" text,
        "action" text NOT NULL,
        "details" text,
        "cree_le" timestamp with time zone NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX "journal_audit_utilisateur_idx" ON "journal_audit" ("utilisateur_id")`,
      `CREATE TABLE "limite_frequence" (
        "id" text PRIMARY KEY,
        "cle" text NOT NULL,
        "cree_le" timestamp with time zone NOT NULL
      )`,
      `CREATE INDEX "limite_frequence_cle_idx" ON "limite_frequence" ("cle", "cree_le")`,
      `CREATE TABLE "element" (
        "id" text PRIMARY KEY,
        "espace_id" text NOT NULL REFERENCES "espace"("id"),
        "titre" text NOT NULL,
        "cree_par_id" text NOT NULL REFERENCES "user"("id"),
        "cree_le" timestamp with time zone NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX "element_espace_idx" ON "element" ("espace_id")`,
    ],
  },
  {
    id: "0002_comptes_auto_inscrits",
    instructions: [
      `ALTER TABLE "user" ADD COLUMN "auto_inscrit" boolean NOT NULL DEFAULT false`,
      `ALTER TABLE "user" ADD COLUMN "expire_le" timestamp with time zone`,
      `ALTER TABLE "user" ADD COLUMN "email_initial" text`,
    ],
  },
];
