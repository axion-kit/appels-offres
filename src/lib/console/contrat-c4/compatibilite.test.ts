import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { celluleDeLaCle, controlerLecture, controlerPaquet, emplacementCoffre } from "./c4/cellule";
import { Paquet } from "./c4/evenements-executeur";
import { entetesDebitDepasse } from "./commun/debit";
import { C4_FIGE } from "./fige";
import { cellulesTexte, jsonSchemaTexte, paquetsTexte } from "./fixtures";

const sha = (t: string) => createHash("sha256").update(t).digest("hex");

describe("contrat C4 figé de la console", () => {
  it("R189 — les fixtures figées gardent les empreintes publiées par la console", () => {
    expect(sha(cellulesTexte)).toBe(C4_FIGE.empreintes.cellules);
    expect(sha(paquetsTexte)).toBe(C4_FIGE.empreintes.paquets);
    expect(sha(jsonSchemaTexte)).toBe(C4_FIGE.empreintes.jsonSchema);
  });
  it("R189 — chaque paquet d'exemple a le verdict attendu par la console", () => {
    const cas = (JSON.parse(paquetsTexte) as { cas: { nom: string; valide: boolean; corps: unknown }[] }).cas;
    expect(cas.length).toBeGreaterThan(0);
    for (const c of cas) expect(Paquet.safeParse(c.corps).success, c.nom).toBe(c.valide);
  });
  it("R189 — la copie figée refuse en entier un paquet ou une lecture d'une autre cellule, comme la console", () => {
    const cellules = JSON.parse(cellulesTexte) as {
      instances: Record<string, string>;
      paquets: { nom: string; valide: boolean; cle: string; corps: unknown }[];
      lectures: { nom: string; valide: boolean; cle: string; instanceId: string }[];
    };
    const instances = new Map(Object.entries(cellules.instances));
    const celluleDe = (id: string) => instances.get(id) ?? null;
    expect(cellules.paquets.some((c) => !c.valide) && cellules.lectures.some((c) => !c.valide)).toBe(true);
    for (const c of cellules.paquets) {
      const verdict = controlerPaquet(c.cle, Paquet.parse(c.corps), celluleDe);
      expect(verdict.ok, c.nom).toBe(c.valide);
      if (!c.valide) expect(verdict).toEqual({ ok: false, code: "action_interdite", statut: 403 });
    }
    for (const c of cellules.lectures) expect(controlerLecture(c.cle, c.instanceId, celluleDe).ok, c.nom).toBe(c.valide);
  });
  it("R189 — la clé d'une cellule a une seule forme, celle du coffre", () => {
    expect(celluleDeLaCle("c4:auto-run-1:a")).toBe("auto-run-1");
    expect(emplacementCoffre("c4:auto-run-1:cle-2")).toEqual({ canal: "c4-auto-run-1", kid: "cle-2" });
    for (const cle of ["c4:Auto_Run:a", "c4:auto-run-1:A", "c4::a", "c1:auto-run-1:a", "c4:auto:run:a", `c4:${"a".repeat(65)}:a`]) {
      expect(celluleDeLaCle(cle), cle).toBeNull();
      expect(emplacementCoffre(cle), cle).toBeNull();
    }
  });
  it("R189 — un débit dépassé rend Retry-After en secondes entières, de 1 à 60", () => {
    expect(entetesDebitDepasse(1)).toEqual({ "Retry-After": "1" });
    expect(entetesDebitDepasse(60)).toEqual({ "Retry-After": "60" });
    for (const s of [0, 61, 1.5]) expect(() => entetesDebitDepasse(s), String(s)).toThrow("Retry-After hors bornes");
  });
});
