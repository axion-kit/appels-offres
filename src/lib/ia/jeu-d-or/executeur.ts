import { creerAgent, registreMemoire, type OptionsAgent } from "../agent-core";
import { IaErreur } from "../erreurs";
import { empreinte, schemaSortie, type Cas, type Critere, type JeuDOr } from "./format";

export interface ResultatEval {
  total: number;
  reussis: number;
  taux: number;
  seuil: number;
  ok: boolean;
  echecs: { id: string; raison: string }[];
}

export type FonctionIa = (entree: string) => Promise<Record<string, unknown>>;

function comparer(champ: string, attendu: unknown, obtenu: unknown, critere: Critere): string | null {
  if (critere === "contient") {
    return typeof obtenu === "string" && typeof attendu === "string" && obtenu.toLowerCase().includes(attendu.toLowerCase())
      ? null
      : `${champ} : ne contient pas « ${String(attendu)} »`;
  }
  if (typeof critere === "object") {
    return typeof obtenu === "number" && typeof attendu === "number" && Math.abs(obtenu - attendu) <= critere.tolerance
      ? null
      : `${champ} : trop loin de ${String(attendu)}`;
  }
  return obtenu === attendu ? null : `${champ} : attendu ${String(attendu)}, obtenu ${String(obtenu)}`;
}

export function jugerCas(cas: Cas, sortie: Record<string, unknown>): string | null {
  for (const [champ, attendu] of Object.entries(cas.attendu)) {
    const raison = comparer(champ, attendu, sortie[champ], cas.criteres?.[champ] ?? "exact");
    if (raison) return raison;
  }
  return null;
}

/** Joue tous les cas. Une erreur de l'IA sur un cas compte comme un échec de ce cas. */
export async function evaluer(jeu: JeuDOr, fonction: FonctionIa): Promise<ResultatEval> {
  const echecs: ResultatEval["echecs"] = [];
  for (const cas of jeu.cas) {
    try {
      const raison = jugerCas(cas, await fonction(cas.entree));
      if (raison) echecs.push({ id: cas.id, raison });
    } catch (e) {
      echecs.push({ id: cas.id, raison: e instanceof IaErreur ? e.message : "erreur inattendue" });
    }
  }
  const total = jeu.cas.length;
  const reussis = total - echecs.length;
  const taux = reussis / total;
  return { total, reussis, taux, seuil: jeu.seuil, ok: taux >= jeu.seuil, echecs };
}

/** Fonction IA générique : consigne du jeu + sortie validée, via agent-core. */
export function fonctionDepuisJeu(jeu: JeuDOr, options: OptionsAgent, client = "evals"): FonctionIa {
  const agent = creerAgent(options);
  const schema = schemaSortie(jeu);
  return async (entree) =>
    (await agent.appeler({ client, invite: jeu.invite, version_prompt: jeu.version_prompt, entree, schema, maxTokens: 500 }))
      .sortie;
}

/** Fausse IA : répond ce que le jeu attend. Aucun réseau, aucune clé. Sert en CI. */
export function fetchFaux(jeu: JeuDOr): typeof fetch {
  return async (_url, init) => {
    const corps = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
    const cas = jeu.cas.find((c) => c.entree === corps.messages[0]?.content);
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: JSON.stringify(cas?.attendu ?? {}) }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
      { status: 200 },
    );
  };
}

export type ModeEval = "faux" | "reel";

/** Lance le jeu. En mode réel : clé obligatoire et empreinte approuvée fournie par le responsable (IA_EVAL_APPROUVE), hors dépôt. */
export async function lancerEval(
  jeu: JeuDOr,
  mode: ModeEval,
  env: Record<string, string | undefined>,
  plafondJetons = 200_000,
): Promise<ResultatEval> {
  if (mode === "reel") {
    if (!env.ANTHROPIC_API_KEY) throw new IaErreur("cle-absente", "La clé du service d'intelligence artificielle n'est pas réglée.");
    if (!env.IA_EVAL_APPROUVE || env.IA_EVAL_APPROUVE !== empreinte(jeu)) {
      throw new Error("Jeu d'or non approuvé : l'empreinte ne correspond pas. Le responsable doit fournir l'empreinte de la version actuelle (IA_EVAL_APPROUVE).");
    }
    return evaluer(jeu, fonctionDepuisJeu(jeu, { plafonds: { evals: plafondJetons }, registre: registreMemoire(), env }));
  }
  const fetchSimule = fetchFaux(jeu);
  return evaluer(
    jeu,
    fonctionDepuisJeu(jeu, {
      plafonds: { evals: plafondJetons },
      registre: registreMemoire(),
      env: { ANTHROPIC_API_KEY: "cle-factice" },
      fetch: fetchSimule,
    }),
  );
}
