import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "./cli";
import { exemple } from "./exemple";
import { evaluer, jugerCas, lancerEval } from "./executeur";
import { empreinte, lireJeu, schemaSortie, type JeuDOr } from "./format";
import { IaErreur } from "../erreurs";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const brut = () => structuredClone(exemple) as Record<string, unknown>;
const jeu = (): JeuDOr => lireJeu(brut());

describe("format du jeu d'or", () => {
  it("lit l'exemple fourni", () => {
    expect(jeu().cas).toHaveLength(3);
    expect(schemaSortie(jeu()).lire({ categorie: "facture", urgent: true }).ok).toBe(true);
    expect(schemaSortie(jeu()).lire({ categorie: "x", urgent: true }).ok).toBe(false);
  });

  it("refuse les jeux mal formés", () => {
    const cas = (brut().cas as unknown[]);
    expect(() => lireJeu({ ...brut(), seuil: 2 })).toThrow("seuil");
    expect(() => lireJeu({ ...brut(), cas: [] })).toThrow("aucun cas");
    expect(() => lireJeu({ ...brut(), sortie: {} })).toThrow("aucune sortie");
    expect(() => lireJeu({ ...brut(), cas: [cas[0], cas[0]] })).toThrow("double");
    expect(() => lireJeu({ ...brut(), sortie: { a: "inconnu" } })).toThrow("invalide");
    expect(() => lireJeu({ ...brut(), cas: [{ id: "x", entree: "y", attendu: { a: [] } }] })).toThrow("invalide");
    expect(() => lireJeu({ ...brut(), cas: [{ id: "x", entree: "y", attendu: [] }] })).toThrow("invalide");
    expect(() => lireJeu({ ...brut(), cas: [{ id: "x", entree: "y", attendu: { a: 1 }, criteres: { a: "bizarre" } }] })).toThrow("invalide");
    expect(() => lireJeu({ ...brut(), cas: [{ id: "x", entree: "y", attendu: { a: 1 }, criteres: { a: { tolerance: -1 } } }] })).toThrow("invalide");
    expect(() => lireJeu(42)).toThrow("invalide");
  });

  it("l'empreinte change si un cas ou le seuil change", () => {
    const a = empreinte(jeu());
    expect(empreinte({ ...jeu(), seuil: 0.5 })).not.toBe(a);
    expect(empreinte(jeu())).toBe(a);
    expect(empreinte({ ...jeu(), version_prompt: "v2" })).not.toBe(a);
    expect(empreinte({ ...jeu(), invite: "autre consigne" })).not.toBe(a);
  });

  it("le champ `approuve` d'un fichier est retiré, jamais lu", () => {
    const lu = lireJeu({ ...brut(), approuve: "n'importe quoi" });
    expect(lu).not.toHaveProperty("approuve");
    expect(lu.cas).toHaveLength(3);
  });
});

describe("exécuteur", () => {
  it("critères exact, contient et tolérance", () => {
    const cas = { id: "x", entree: "", attendu: { a: "Bon", n: 10 }, criteres: { a: "contient", n: { tolerance: 1 } } } as const;
    expect(jugerCas({ ...cas, criteres: { ...cas.criteres } }, { a: "un bonjour", n: 10.5 })).toBeNull();
    expect(jugerCas({ ...cas, criteres: { ...cas.criteres } }, { a: "salut", n: 10 })).toContain("ne contient pas");
    expect(jugerCas({ ...cas, criteres: { ...cas.criteres } }, { a: 5, n: 10 })).toContain("ne contient pas");
    expect(jugerCas({ ...cas, criteres: { ...cas.criteres } }, { a: "bon", n: 20 })).toContain("trop loin");
    expect(jugerCas({ id: "y", entree: "", attendu: { a: 1 } }, { a: 2 })).toContain("attendu 1");
  });

  it("jeu sous le seuil : échec", async () => {
    const r = await evaluer(jeu(), async () => ({ categorie: "autre", urgent: false }));
    expect(r.ok).toBe(false);
    expect(r.taux).toBeCloseTo(0);
    expect(r.echecs).toHaveLength(3);
  });

  it("une erreur de l'IA compte comme un échec du cas", async () => {
    let n = 0;
    const r = await evaluer({ ...jeu(), seuil: 0.5 }, async (entree) => {
      n++;
      if (n === 1) throw new IaErreur("plafond-depasse", "plafond");
      if (n === 2) throw new Error("boum");
      return jeu().cas.find((c) => c.entree === entree)?.attendu ?? {};
    });
    expect(r.reussis).toBe(1);
    expect(r.echecs.map((e) => e.raison)).toEqual(["plafond", "erreur inattendue"]);
    expect(r.ok).toBe(false);
  });

  it("fausse IA : réussi sans clé ni réseau", async () => {
    const r = await lancerEval(jeu(), "faux", {});
    expect(r).toMatchObject({ ok: true, taux: 1 });
  });

  it("vraie IA : clé absente -> erreur claire", async () => {
    await expect(lancerEval(jeu(), "reel", {})).rejects.toMatchObject({ code: "cle-absente" });
  });

  it("vraie IA : jeu non approuvé -> refus, même si le fichier porte une empreinte", async () => {
    await expect(lancerEval(jeu(), "reel", { ANTHROPIC_API_KEY: "k" })).rejects.toThrow("non approuvé");
    const j = lireJeu({ ...brut(), approuve: empreinte(jeu()) });
    await expect(lancerEval(j, "reel", { ANTHROPIC_API_KEY: "k" })).rejects.toThrow("non approuvé");
  });

  it("vraie IA : mauvaise empreinte, ou empreinte d'une autre version de consigne -> refus", async () => {
    const env = { ANTHROPIC_API_KEY: "k" };
    await expect(lancerEval(jeu(), "reel", { ...env, IA_EVAL_APPROUVE: "abc" })).rejects.toThrow("non approuvé");
    const ancienne = empreinte(jeu());
    await expect(lancerEval({ ...jeu(), version_prompt: "v2" }, "reel", { ...env, IA_EVAL_APPROUVE: ancienne })).rejects.toThrow("non approuvé");
  });

  it("vraie IA : jeu approuvé -> appelle le service (simulé ici)", async () => {
    const j = jeu();
    expect(Object.getPrototypeOf(lireJeu({ ...brut(), sortie: JSON.parse('{"__proto__":"texte","a":"texte"}') }).sortie)).toBeNull();
    const appels: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      appels.push(url);
      return new Response(JSON.stringify({ content: [{ type: "text", text: '{"categorie":"autre","urgent":false}' }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 });
    });
    const r = await lancerEval(j, "reel", { ANTHROPIC_API_KEY: "k", IA_EVAL_APPROUVE: empreinte(j) });
    expect(appels).toHaveLength(3);
    expect(r.ok).toBe(false);
  });
});

describe("pnpm ia:eval (cli)", () => {
  const ecrit = () => {
    const lignes: string[] = [];
    return { lignes, ecrire: (l: string) => void lignes.push(l) };
  };
  const fichier = (contenu: unknown) => {
    const chemin = join(mkdtempSync(join(tmpdir(), "ia-")), "jeu.json");
    writeFileSync(chemin, typeof contenu === "string" ? contenu : JSON.stringify(contenu));
    return chemin;
  };

  it("sort 0 au-dessus du seuil", async () => {
    const o = ecrit();
    expect(await main([], {}, o.ecrire)).toBe(0);
    expect(o.lignes.join("\n")).toContain("RÉUSSI");
  });

  it("refuse plus d'un fichier au lieu d'en lire un autre en silence", async () => {
    const o = ecrit();
    expect(await main(["a.json", "b.json"], {}, o.ecrire)).toBe(1);
    expect(await main(["/inexistant.json"], {}, ecrit().ecrire)).toBe(1);
  });

  it("sort 1 avec fichier illisible, ou en mode réel sans clé", async () => {
    expect(await main([fichier("pas du json")], {}, ecrit().ecrire)).toBe(1);
    const o = ecrit();
    expect(await main([fichier(brut())], { IA_EVAL_MODE: "reel" }, o.ecrire)).toBe(1);
    expect(o.lignes.join("\n")).toContain("ÉCHEC");
  });

  it("sort 1 quand le taux est sous le seuil", async () => {
    // seuil impossible à tenir : une entrée dupliquée renvoie la sortie du premier cas
    const j = brut();
    const cas = j.cas as { entree: string }[];
    cas[1]!.entree = cas[0]!.entree;
    const o = ecrit();
    expect(await main([fichier({ ...j, seuil: 1 })], {}, o.ecrire)).toBe(1);
    expect(o.lignes.join("\n")).toContain("sous le seuil");
    expect(o.lignes.join("\n")).toContain("échec c2");
  });

  it("écrit sur la console par défaut", async () => {
    const vus: string[] = [];
    vi.spyOn(console, "log").mockImplementation((l: string) => void vus.push(l));
    expect(await main(["a", "b"], {})).toBe(1);
    expect(vus[0]).toContain("Un seul fichier");
  });
});
