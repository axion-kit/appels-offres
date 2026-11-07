import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { migrations } from "./migrations";
import { schema } from "./schema";

export type Base = PgDatabase<PgQueryResultHKT, typeof schema>;

// Applique les migrations manquantes, une seule personne à la fois (verrou en base).
export async function appliquerMigrations(base: Base): Promise<void> {
  await base.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7114001)`);
    await tx.execute(sql`create table if not exists "migration_appliquee" ("id" text primary key, "appliquee_le" timestamptz not null default now())`);
    const faites = (await tx.execute(sql`select "id" from "migration_appliquee"`)) as unknown as { rows: { id: string }[] };
    const dejaFaites = new Set(faites.rows.map((ligne) => ligne.id));
    for (const migration of migrations) {
      if (dejaFaites.has(migration.id)) continue;
      for (const instruction of migration.instructions) {
        await tx.execute(sql.raw(instruction));
      }
      await tx.execute(sql`insert into "migration_appliquee" ("id") values (${migration.id})`);
    }
  });
}

// Base en mémoire (développement, tests) : disparaît à l'arrêt.
export async function creerBaseMemoire(): Promise<Base> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const base = drizzle(new PGlite(), { schema }) as unknown as Base;
  await appliquerMigrations(base);
  return base;
}

// Base Postgres réelle, adresse fournie par l'outil (jamais écrite dans le dépôt).
export async function creerBasePostgres(adresse: string): Promise<Base> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const base = drizzle(new Pool({ connectionString: adresse, max: 10 }), { schema }) as unknown as Base;
  await appliquerMigrations(base);
  return base;
}
