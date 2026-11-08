import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/lib/comptes/schema.ts", "./src/lib/base/schema/*.ts"],
  out: "./.drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
