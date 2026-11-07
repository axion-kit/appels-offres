import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scannerCouleurs, lancerControles } from "./controle";

describe("scan des couleurs du dépôt", () => {
  const racine = mkdtempSync(join(tmpdir(), "dc-"));
  mkdirSync(join(racine, "src/design"), { recursive: true });
  mkdirSync(join(racine, "src/app"), { recursive: true });
  writeFileSync(join(racine, "src/design/jetons.ts"), 'export const a = "#e8730c";');
  writeFileSync(join(racine, "src/app/ok.css"), "a{color:var(--c-texte)}");
  writeFileSync(join(racine, "src/app/mauvais.css"), "a{color:#123456}");
  writeFileSync(join(racine, "src/app/x.test.ts"), 'const c = "#abcdef";');
  it("ignore les jetons et les tests, signale le reste", () => {
    const r = scannerCouleurs(racine);
    expect(r).toHaveLength(1);
    expect(r[0]).toContain("src/app/mauvais.css:1");
  });
  it("le dépôt lui-même est propre", () => {
    expect(scannerCouleurs(process.cwd())).toEqual([]);
  });
});

describe("ensemble des contrôles", () => {
  it("passe sur la coque et la planche livrées", async () => {
    const r = await lancerControles();
    expect(r.problemes).toEqual([]);
    expect(r.resume.length).toBeGreaterThanOrEqual(3);
  }, 90_000);
});
