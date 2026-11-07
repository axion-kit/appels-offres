import { sql } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { appliquerMigrations, creerBaseMemoire } from "./base";
import { schema } from "./schema";

type Colonne = { table_name: string; column_name: string; is_nullable: string; data_type: string };

describe("migrations et schéma", () => {
  it("la base créée par les migrations correspond au schéma décrit dans le code", async () => {
    const base = await creerBaseMemoire();
    const lu = (await base.execute(
      sql`select table_name, column_name, is_nullable, data_type from information_schema.columns where table_schema = 'public' and table_name <> 'migration_appliquee'`,
    )) as unknown as { rows: Colonne[] };
    const enBase = lu.rows.map((c) => `${c.table_name}.${c.column_name}:${c.is_nullable}:${c.data_type}`).sort();
    const decrit = Object.values(schema).flatMap((table) => {
      const config = getTableConfig(table as PgTable);
      return config.columns.map((c) => `${config.name}.${c.name}:${c.notNull ? "NO" : "YES"}:${c.getSQLType()}`);
    });
    expect(decrit.sort()).toEqual(enBase);
  });
  it("rejouer les migrations ne change rien", async () => {
    const base = await creerBaseMemoire();
    await expect(appliquerMigrations(base)).resolves.toBeUndefined();
  });
});
