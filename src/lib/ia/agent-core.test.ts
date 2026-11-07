import { afterEach, describe, expect, it, vi } from "vitest";
import {
  creerAgent,
  delaiAppelParDefaut,
  MARGE_ENVELOPPE_JETONS,
  registreMemoire,
  type EvenementJournal,
  type OptionsAgent,
  type RegistreDepense,
} from "./agent-core";
import { IaErreur } from "./erreurs";
import { booleen, choix, liste, nombre, objet, texte } from "./schema";

const schema = objet<{ categorie: "a" | "b"; urgent: boolean }>({
  categorie: choix(["a", "b"] as const),
  urgent: booleen(),
});
const ok = (texteReponse: string, usage = { input_tokens: 20, output_tokens: 10 }) =>
  new Response(JSON.stringify({ content: [{ type: "text", text: texteReponse }], usage }), { status: 200 });
const demande = (extra = {}) => ({
  client: "c1", invite: "Classe.", version_prompt: "v1", entree: "Bonjour Jean Dupont", schema, maxTokens: 100, ...extra,
});
const env = { ANTHROPIC_API_KEY: "cle-de-test" };
const octets = (t: string) => Buffer.byteLength(t, "utf8");
/** Coût réservé pour la demande de base (consigne « Classe. », entrée « Bonjour Jean Dupont », 100 jetons de sortie). */
const ESTIME = octets("Classe.") + octets("Bonjour Jean Dupont") + MARGE_ENVELOPPE_JETONS + 100;
const creer = (o: Omit<OptionsAgent, "registre"> & { registre?: OptionsAgent["registre"] }) =>
  creerAgent({ registre: registreMemoire(), ...o });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("agent-core", () => {
  it("rend une sortie validée, avec modèle, version et date", async () => {
    const f = vi.fn(async () => ok('{"categorie":"a","urgent":false}'));
    const r = await creer({ plafonds: { c1: 1000 }, fetch: f, env }).appeler(demande());
    expect(r.sortie).toEqual({ categorie: "a", urgent: false });
    expect(r.modele).toBe("claude-sonnet-5-5");
    expect(r.version_prompt).toBe("v1");
    expect(r.jetons).toBe(30);
    const [url, init] = (f.mock.calls as unknown as [string, RequestInit][])[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const corps = JSON.parse(String(init.body));
    expect(corps.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(new Headers(init.headers).get("x-api-key")).toBe("cle-de-test");
  });

  it("accepte du JSON entouré de balises de code et choisit Opus pour une tâche difficile", async () => {
    const f = vi.fn(async () => ok('```json\n{"categorie":"b","urgent":true}\n```'));
    const r = await creer({ plafonds: { c1: 1000 }, fetch: f, env }).appeler(demande({ difficile: true }));
    expect(r.modele).toBe("claude-opus-5-5");
    expect(r.sortie.categorie).toBe("b");
  });

  it("clé absente : erreur claire, aucun appel", async () => {
    const f = vi.fn();
    const p = creer({ plafonds: { c1: 1000 }, fetch: f, env: {} }).appeler(demande());
    await expect(p).rejects.toMatchObject({ code: "cle-absente", message: expect.stringContaining("clé") });
    expect(f).not.toHaveBeenCalled();
  });

  it("plafond dépassé : refus propre, aucun appel", async () => {
    const f = vi.fn();
    const registre = registreMemoire();
    await registre.ajuster("c1", 990);
    const p = creer({ plafonds: { c1: 1000 }, registre, fetch: f, env }).appeler(demande());
    await expect(p).rejects.toMatchObject({ code: "plafond-depasse" });
    expect(f).not.toHaveBeenCalled();
  });

  it("le plafond est suivi par client et cumulé après chaque appel", async () => {
    const f = vi.fn(async () => ok('{"categorie":"a","urgent":false}'));
    const registre = registreMemoire();
    const agent = creer({ plafonds: { c1: ESTIME + 10, c2: ESTIME + 10 }, registre, fetch: f, env });
    await agent.appeler(demande());
    expect(registre.lire("c1")).toBe(30);
    expect(registre.lire("c2")).toBe(0);
    await expect(agent.appeler(demande())).rejects.toMatchObject({ code: "plafond-depasse" });
    await expect(agent.appeler(demande({ client: "c2" }))).resolves.toBeTruthy();
  });

  it("client sans plafond : refusé", async () => {
    const p = creer({ plafonds: {}, fetch: vi.fn(), env }).appeler(demande());
    await expect(p).rejects.toMatchObject({ code: "plafond-absent" });
  });

  it("Haiku est interdit", async () => {
    const p = creer({ plafonds: { c1: 1000 }, fetch: vi.fn(), env }).appeler(demande({ modele: "claude-haiku-5-5" }));
    await expect(p).rejects.toMatchObject({ code: "modele-interdit" });
  });

  it("429 puis succès : reprise avec attente, un seul coût compté", async () => {
    const reponses = [
      new Response("{}", { status: 429, headers: { "retry-after": "2" } }),
      new Response("{}", { status: 529 }),
      ok('{"categorie":"a","urgent":true}'),
    ];
    const f = vi.fn(async () => reponses.shift() as Response);
    const attendre = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
    const registre = registreMemoire();
    const r = await creer({ plafonds: { c1: 1000 }, registre, fetch: f, env, attendre }).appeler(demande());
    expect(r.sortie.urgent).toBe(true);
    expect(f).toHaveBeenCalledTimes(3);
    expect(attendre.mock.calls.map((c) => c[0] as number)).toEqual([2000, 2000]);
    expect(registre.lire("c1")).toBe(30);
  });

  it("429 sans fin : abandon propre après les reprises", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 429 }));
    const attendre = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
    const p = creer({ plafonds: { c1: 1000 }, fetch: f, env, attendre, maxTentatives: 3 }).appeler(demande());
    await expect(p).rejects.toMatchObject({ code: "service-occupe" });
    expect(f).toHaveBeenCalledTimes(3);
    expect(attendre.mock.calls.map((c) => c[0] as number)).toEqual([1000, 2000]);
  });

  it("autre refus du service : erreur sans détail technique", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 400 }));
    const p = creer({ plafonds: { c1: 1000 }, fetch: f, env }).appeler(demande());
    await expect(p).rejects.toMatchObject({ code: "refus-service" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("réponse illisible", async () => {
    const f = vi.fn(async () => new Response("pas du json", { status: 200 }));
    await expect(creer({ plafonds: { c1: 1000 }, fetch: f, env }).appeler(demande())).rejects.toMatchObject({ code: "reponse-illisible" });
  });

  it("sortie hors schéma ou non JSON : rejetée, mais les jetons sont comptés", async () => {
    for (const mauvais of ['{"categorie":"z","urgent":false}', "du texte libre", '{"categorie":"a","urgent":false,"en_trop":1}']) {
      const registre = registreMemoire();
      const f = vi.fn(async () => ok(mauvais));
      const p = creer({ plafonds: { c1: 1000 }, registre, fetch: f, env }).appeler(demande());
      await expect(p).rejects.toBeInstanceOf(IaErreur);
      await expect(p).rejects.not.toHaveProperty("message", expect.stringContaining("categorie"));
      await expect(creer({ plafonds: { c1: 1000 }, registre, fetch: f, env }).appeler(demande())).rejects.toMatchObject({ code: "sortie-invalide" });
      expect(registre.lire("c1")).toBe(60);
    }
  });

  it("réponse sans usage : l'estimation est comptée, pas zéro", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    const registre = registreMemoire();
    await expect(creer({ plafonds: { c1: 1000 }, registre, fetch: f, env }).appeler(demande())).rejects.toMatchObject({ code: "sortie-invalide" });
    expect(registre.lire("c1")).toBe(ESTIME);
  });

  it("deux appels simultanés : le plafond n'en laisse passer qu'un", async () => {
    const f = vi.fn(async () => ok('{"categorie":"a","urgent":false}'));
    const agent = creer({ plafonds: { c1: ESTIME + 10 }, fetch: f, env });
    const r = await Promise.allSettled([agent.appeler(demande()), agent.appeler(demande())]);
    expect(r.map((x) => x.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("coupure réseau : reprise puis erreur claire, journal écrit, réservations gardées (l'appel a pu être facturé)", async () => {
    const evenements: EvenementJournal[] = [];
    const registre = registreMemoire();
    const f = vi.fn(async () => { throw new TypeError("fetch failed ECONNRESET"); });
    const attendre = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
    const p = creer({ plafonds: { c1: 1000 }, registre, fetch: f, env, attendre, maxTentatives: 2, journal: (e) => evenements.push(e) }).appeler(demande());
    await expect(p).rejects.toMatchObject({ code: "service-injoignable", message: expect.not.stringContaining("ECONNRESET") });
    expect(f).toHaveBeenCalledTimes(2);
    expect(registre.lire("c1")).toBe(2 * ESTIME);
    expect(evenements[0]).toMatchObject({ statut: "echec", code: "service-injoignable", tentatives: 2 });
  });

  it("coupure réseau puis succès", async () => {
    let n = 0;
    const f = vi.fn(async () => { if (n++ === 0) throw new Error("coupé"); return ok('{"categorie":"a","urgent":false}'); });
    const registre = registreMemoire();
    const r = await creer({ plafonds: { c1: 1000 }, registre, fetch: f, env, attendre: () => Promise.resolve() }).appeler(demande());
    expect(r.sortie.categorie).toBe("a");
    expect(registre.lire("c1")).toBe(ESTIME + 30);
  });

  it("délai dépassé : la réservation est gardée, chaque tentative en réserve une", async () => {
    const f = vi.fn(async () => { throw new DOMException("délai", "TimeoutError"); });
    const registre = registreMemoire();
    const p = creer({ plafonds: { c1: 10_000 }, registre, fetch: f, env, attendre: () => Promise.resolve(), maxTentatives: 3 }).appeler(demande());
    await expect(p).rejects.toMatchObject({ code: "service-injoignable" });
    expect(registre.lire("c1")).toBe(3 * ESTIME);
  });

  it("les nouveaux essais respectent le plafond : une tentative sans place n'est pas envoyée", async () => {
    const f = vi.fn(async () => { throw new Error("coupé"); });
    const registre = registreMemoire();
    const p = creer({ plafonds: { c1: ESTIME + 10 }, registre, fetch: f, env, attendre: () => Promise.resolve() }).appeler(demande());
    await expect(p).rejects.toMatchObject({ code: "plafond-depasse" });
    expect(f).toHaveBeenCalledTimes(1);
    expect(registre.lire("c1")).toBe(ESTIME);
  });

  it("erreur explicite du service (400, 429 final) : la réservation est rendue", async () => {
    const registre = registreMemoire();
    await expect(creer({ plafonds: { c1: 1000 }, registre, fetch: vi.fn(async () => new Response("{}", { status: 400 })), env }).appeler(demande())).rejects.toMatchObject({ code: "refus-service" });
    expect(registre.lire("c1")).toBe(0);
    const f = vi.fn(async () => new Response("{}", { status: 429 }));
    await expect(creer({ plafonds: { c1: 1000 }, registre, fetch: f, env, attendre: () => Promise.resolve(), maxTentatives: 2 }).appeler(demande())).rejects.toMatchObject({ code: "service-occupe" });
    expect(registre.lire("c1")).toBe(0);
  });

  it("plafond NaN, négatif, infini ou hérité : refusé, aucun appel", async () => {
    const f = vi.fn();
    for (const plafond of [Number.NaN, -1, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      await expect(creer({ plafonds: { c1: plafond }, fetch: f, env }).appeler(demande())).rejects.toMatchObject({ code: "plafond-absent" });
    }
    await expect(creer({ plafonds: {}, fetch: f, env }).appeler(demande({ client: "constructor" }))).rejects.toMatchObject({ code: "plafond-absent" });
    expect(f).not.toHaveBeenCalled();
  });

  it("estimation au plus haut : octets réels (emojis, chiffres, JSON, alphabets non latins) + marge fixe", async () => {
    const entrees = ["😀😀😀😀😀😀😀😀", "0123456789012345678901234567890123456789", JSON.stringify({ a: [1, 2, { b: "x" }], c: null }), "Привет, мир ! 你好，世界 مرحبا", "é".repeat(30)];
    for (const entree of entrees) {
      const registre = registreMemoire();
      const f = vi.fn(async () => new Response("{}", { status: 200 }));
      await creer({ plafonds: { c1: 100_000 }, registre, fetch: f, env }).appeler(demande({ entree })).catch(() => undefined);
      expect(registre.lire("c1")).toBe(octets("Classe.") + octets(entree) + MARGE_ENVELOPPE_JETONS + 100);
      expect(registre.lire("c1")).toBeGreaterThanOrEqual(entree.length + 100);
    }
  });

  it("coût réel au-delà du plafond : enregistré, signalé dans le journal, et les appels suivants sont bloqués", async () => {
    const evenements: EvenementJournal[] = [];
    const registre = registreMemoire();
    const f = vi.fn(async () => ok('{"categorie":"a","urgent":false}', { input_tokens: 5000, output_tokens: 10 }));
    const agent = creer({ plafonds: { c1: 1000 }, registre, fetch: f, env, journal: (e) => evenements.push(e) });
    await agent.appeler(demande());
    expect(registre.lire("c1")).toBe(5010);
    expect(evenements[0]).toMatchObject({ statut: "ok", depassement: 4010 });
    await expect(agent.appeler(demande())).rejects.toMatchObject({ code: "plafond-depasse" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("20 appels simultanés sur un registre asynchrone avec latence : le plafond n'est jamais dépassé", async () => {
    const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    let total = 0;
    let pic = 0;
    const registre: RegistreDepense = {
      lire: () => total,
      async reserver(_client, jetons, plafond) {
        await pause(2);
        // Test et écriture en un seul pas, comme une requête atomique de base de données.
        if (total + jetons > plafond) return false;
        total += jetons;
        pic = Math.max(pic, total);
        return true;
      },
      async ajuster(_client, delta) {
        await pause(10);
        total += delta;
        pic = Math.max(pic, total);
      },
    };
    const plafond = ESTIME * 4 + 50;
    const f = vi.fn(async () => { await pause(3); return ok('{"categorie":"a","urgent":false}'); });
    const agent = creer({ plafonds: { c1: plafond }, registre, fetch: f, env });
    const r = await Promise.allSettled(Array.from({ length: 20 }, () => agent.appeler(demande())));
    const reussis = r.filter((x) => x.status === "fulfilled").length;
    expect(pic).toBeLessThanOrEqual(plafond);
    expect(reussis).toBeGreaterThanOrEqual(1);
    expect(reussis).toBeLessThan(20);
    expect(f).toHaveBeenCalledTimes(reussis);
    expect(r.filter((x) => x.status === "rejected").every((x) => (x as PromiseRejectedResult).reason?.code === "plafond-depasse")).toBe(true);
    expect(total).toBe(30 * reussis);
  });

  it("délai d'un appel : réglable, distinct de l'attente entre essais, et dépendant de maxTokens par défaut", async () => {
    const minuteur = vi.spyOn(AbortSignal, "timeout");
    const f = vi.fn(async () => ok('{"categorie":"a","urgent":false}'));
    await creer({ plafonds: { c1: 100_000 }, fetch: f, env, delaiAppelMs: 1234, delaiMaxMs: 5 }).appeler(demande());
    await creer({ plafonds: { c1: 100_000 }, fetch: f, env }).appeler(demande());
    await creer({ plafonds: { c1: 100_000 }, fetch: f, env }).appeler(demande({ maxTokens: 4000 }));
    expect(minuteur.mock.calls.map((c) => c[0])).toEqual([1234, delaiAppelParDefaut(100), delaiAppelParDefaut(4000)]);
    expect(delaiAppelParDefaut(4000)).toBeGreaterThan(delaiAppelParDefaut(100));
  });

  it("maxTokens invalide : refusé avant tout appel", async () => {
    const f = vi.fn();
    for (const maxTokens of [Number.NaN, 0, -5, 1.5]) {
      await expect(creer({ plafonds: { c1: 1000 }, fetch: f, env }).appeler(demande({ maxTokens }))).rejects.toMatchObject({ code: "demande-invalide" });
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("le corps envoyé contient le modèle, le plafond de sortie et l'entrée ; retry-after est borné à 60 s", async () => {
    const reponses = [new Response("{}", { status: 429, headers: { "retry-after": "999" } }), ok('{"categorie":"a","urgent":false}')];
    const f = vi.fn(async () => reponses.shift() as Response);
    const attendre = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
    await creer({ plafonds: { c1: 1000 }, fetch: f, env, attendre }).appeler(demande());
    expect(attendre.mock.calls[0]?.[0]).toBe(60_000);
    const init = (f.mock.calls as unknown as [string, RequestInit][])[0]![1];
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "claude-sonnet-5-5", max_tokens: 100, messages: [{ role: "user", content: "Bonjour Jean Dupont" }] });
  });

  it("sortie invalide : journal en échec, sans entrée ni réponse, détail seulement dans `detail`", async () => {
    const evenements: EvenementJournal[] = [];
    const f = vi.fn(async () => ok('{"categorie":"z","urgent":false}'));
    const e = await creer({ plafonds: { c1: 1000 }, fetch: f, env, journal: (x) => evenements.push(x) }).appeler(demande()).catch((x) => x);
    expect(e.detail).toContain("categorie");
    expect(evenements[0]).toMatchObject({ statut: "echec", code: "sortie-invalide", tentatives: 1, jetons_sortie: 10 });
    expect(JSON.stringify(evenements)).not.toContain("Jean");
    expect(JSON.stringify(evenements)).not.toContain('"z"');
  });

  it("noms hérités refusés comme champs inconnus", () => {
    const s = objet<{ a: string }>({ a: texte() });
    expect(s.lire(JSON.parse('{"a":"x","constructor":1}')).ok).toBe(false);
  });

  it("le journal ne contient aucune donnée de personne", async () => {
    const evenements: EvenementJournal[] = [];
    const f = vi.fn(async () => ok('{"categorie":"a","urgent":false}', { input_tokens: 5, output_tokens: 5, cache_read_input_tokens: 7 } as never));
    await creer({ plafonds: { c1: 1000 }, fetch: f, env, journal: (e) => evenements.push(e) }).appeler(demande());
    await creer({ plafonds: {}, fetch: f, env, journal: (e) => evenements.push(e) }).appeler(demande()).catch(() => undefined);
    expect(evenements.map((e) => e.statut)).toEqual(["ok", "refuse"]);
    expect(evenements[0]?.jetons_cache).toBe(7);
    const texteJournal = JSON.stringify(evenements);
    expect(texteJournal).not.toContain("Jean Dupont");
    expect(texteJournal).not.toContain("cle-de-test");
  });

  it("refuse de tourner dans un navigateur", async () => {
    vi.stubGlobal("window", {});
    await expect(creer({ plafonds: { c1: 1 }, fetch: vi.fn(), env }).appeler(demande())).rejects.toMatchObject({ code: "navigateur" });
  });

  it("lit la clé dans l'environnement du serveur par défaut", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(creer({ plafonds: { c1: 1000 }, fetch: vi.fn() }).appeler(demande())).rejects.toMatchObject({ code: "cle-absente" });
  });
});

describe("schema", () => {
  it("valide listes, nombres et textes imbriqués", () => {
    const s = objet<{ lignes: { libelle: string; montant: number }[] }>({
      lignes: liste(objet<{ libelle: string; montant: number }>({ libelle: texte(), montant: nombre() })),
    });
    expect(s.lire({ lignes: [{ libelle: "a", montant: 2 }] }).ok).toBe(true);
    expect(s.lire({ lignes: [{ libelle: "a", montant: "2" }] })).toMatchObject({ ok: false, raison: expect.stringContaining("lignes[0].montant") });
    expect(s.lire({ lignes: "x" }).ok).toBe(false);
    expect(s.lire(null).ok).toBe(false);
    expect(s.lire([]).ok).toBe(false);
    expect(nombre().lire(Number.NaN).ok).toBe(false);
    expect(texte().lire(3).ok).toBe(false);
    expect(booleen().lire("oui").ok).toBe(false);
  });
});
