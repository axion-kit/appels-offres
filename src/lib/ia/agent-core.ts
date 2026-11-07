import { IaErreur } from "./erreurs";
import type { Schema } from "./schema";

export const URL_MESSAGES = "https://api.anthropic.com/v1/messages";
export const MODELE_DEFAUT = "claude-sonnet-5-5";
export const MODELE_DIFFICILE = "claude-opus-5-5";

/** Registre de dépense par client. La version en mémoire sert aux tests ; la coque branche sa base. */
export interface RegistreDepense {
  lire(client: string): number | Promise<number>;
  /**
   * Réserve `jetons` si le total reste sous `plafond`.
   * Contrat d'un registre réel : UNE SEULE requête atomique, par exemple
   * `UPDATE depense SET total = total + n WHERE client = c AND total + n <= plafond`
   * (réservé = une ligne modifiée). Jamais « lire puis écrire » en deux temps.
   */
  reserver(client: string, jetons: number, plafond: number): Promise<boolean>;
  /** Corrige la dépense (positif = de plus, négatif = rendu). Le réel est toujours enregistré, même au-delà du plafond. */
  ajuster(client: string, delta: number): Promise<void>;
}

export function registreMemoire(): RegistreDepense {
  const total = new Map<string, number>();
  return {
    lire: (client) => total.get(client) ?? 0,
    async reserver(client, jetons, plafond) {
      const actuel = total.get(client) ?? 0;
      if (actuel + jetons > plafond) return false;
      total.set(client, actuel + jetons);
      return true;
    },
    ajuster: async (client, delta) => {
      const suivant = (total.get(client) ?? 0) + delta;
      // Un total négatif trahirait une restitution en double : on l'arrête au lieu de le masquer.
      if (suivant < 0) throw new Error("registre du plafond incohérent (total négatif)");
      total.set(client, suivant);
    },
  };
}

export interface EvenementJournal {
  client: string;
  modele: string;
  version_prompt: string;
  statut: "ok" | "refuse" | "echec";
  code?: string;
  tentatives: number;
  jetons_entree: number;
  jetons_sortie: number;
  jetons_cache: number;
  /** Jetons dépensés au-delà du plafond (le coût réel a dépassé la réservation). Absent sinon. */
  depassement?: number;
}

export interface OptionsAgent {
  /** Plafond de jetons par client (entrée + sortie). Un client sans plafond est refusé. */
  plafonds: Record<string, number>;
  /** Obligatoire : un registre perdu à chaque requête remettrait le plafond à zéro. */
  registre: RegistreDepense;
  fetch?: typeof fetch;
  env?: Record<string, string | undefined>;
  attendre?: (ms: number) => Promise<void>;
  journal?: (e: EvenementJournal) => void;
  maxTentatives?: number;
  /** Attente maximale entre deux essais (borne aussi l'indication du service). */
  delaiMaxMs?: number;
  /** Attente avant le deuxième essai ; double à chaque essai. */
  delaiBaseMs?: number;
  /** Délai d'expiration d'UN appel au service, distinct de l'attente entre essais. Défaut : voir `delaiAppelParDefaut`. */
  delaiAppelMs?: number;
}

export interface DemandeIa<T> {
  client: string;
  /** Consigne fixe, mise en cache. Ne doit contenir aucune donnée de personne. */
  invite: string;
  version_prompt: string;
  /** Texte variable (peut contenir des données) : jamais écrit dans le journal. */
  entree: string;
  schema: Schema<T>;
  maxTokens: number;
  difficile?: boolean;
  modele?: string;
}

export interface ReponseIa<T> {
  sortie: T;
  modele: string;
  version_prompt: string;
  date: string;
  jetons: number;
}

const STATUTS_A_REPRENDRE = new Set([429, 529]);

/** Marge fixe pour l'enveloppe de la requête (structure, balises, cache). */
export const MARGE_ENVELOPPE_JETONS = 100;

/** Estimation au plus haut : un jeton couvre au moins un octet, donc les octets bornent les jetons. */
const estimerJetons = (texte: string) => Buffer.byteLength(texte, "utf8");

/** Délai d'un appel quand rien n'est précisé : une base fixe plus du temps pour chaque jeton de sortie permis. */
export const delaiAppelParDefaut = (maxTokens: number) => 30_000 + maxTokens * 30;

function extraireJson(texte: string): unknown {
  const nettoye = texte.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(nettoye);
}

function delaiReprise(reponse: Response, essai: number, base: number, max: number): number {
  const indice = Number(reponse.headers.get("retry-after"));
  if (Number.isFinite(indice) && indice > 0) return Math.min(indice * 1000, max);
  return Math.min(base * 2 ** essai, max);
}

export function creerAgent(options: OptionsAgent) {
  const registre = options.registre;
  const appelFetch = options.fetch ?? fetch;
  const env = options.env ?? process.env;
  const attendre = options.attendre ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxTentatives = options.maxTentatives ?? 4;
  const delaiBase = options.delaiBaseMs ?? 1000;
  const delaiMax = options.delaiMaxMs ?? 60_000;

  async function appeler<T>(d: DemandeIa<T>): Promise<ReponseIa<T>> {
    const modele = d.modele ?? (d.difficile ? MODELE_DIFFICILE : MODELE_DEFAUT);
    const evenement: EvenementJournal = {
      client: d.client,
      modele,
      version_prompt: d.version_prompt,
      statut: "refuse",
      tentatives: 0,
      jetons_entree: 0,
      jetons_sortie: 0,
      jetons_cache: 0,
    };
    const finir = <E extends IaErreur>(e: E, statut: "refuse" | "echec" = "refuse"): never => {
      evenement.statut = statut;
      evenement.code = e.code;
      options.journal?.(evenement);
      throw e;
    };

    if (typeof window !== "undefined") {
      finir(new IaErreur("navigateur", "Cette fonction ne peut tourner que sur le serveur."));
    }
    if (/haiku/i.test(modele)) {
      finir(new IaErreur("modele-interdit", "Ce modèle n'est pas autorisé pour un outil vendu."));
    }
    const cle = env.ANTHROPIC_API_KEY;
    if (!cle) {
      finir(new IaErreur("cle-absente", "La clé du service d'intelligence artificielle n'est pas réglée sur le serveur."));
    }
    const plafond = Object.hasOwn(options.plafonds, d.client) ? options.plafonds[d.client] : undefined;
    if (typeof plafond !== "number" || !Number.isFinite(plafond) || plafond < 0) {
      return finir(new IaErreur("plafond-absent", "Aucun plafond de dépense n'est défini pour ce client."));
    }
    if (!Number.isInteger(d.maxTokens) || d.maxTokens <= 0) {
      finir(new IaErreur("demande-invalide", "La demande à l'IA est mal réglée."));
    }
    const estime = estimerJetons(d.invite) + estimerJetons(d.entree) + MARGE_ENVELOPPE_JETONS + d.maxTokens;
    const delaiAppel =
      options.delaiAppelMs !== undefined && Number.isFinite(options.delaiAppelMs) && options.delaiAppelMs > 0
        ? options.delaiAppelMs
        : delaiAppelParDefaut(d.maxTokens);

    const corps = JSON.stringify({
      model: modele,
      max_tokens: d.maxTokens,
      system: [{ type: "text", text: d.invite, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: d.entree }],
    });

    let reponse: Response | undefined;
    for (let essai = 0; essai < maxTentatives; essai++) {
      // Une réservation par tentative : chaque envoi peut être facturé.
      if (!(await registre.reserver(d.client, estime, plafond))) {
        finir(
          new IaErreur(
            "plafond-depasse",
            essai === 0
              ? "Le plafond de dépense de ce client est atteint. Aucun appel n'a été fait."
              : "Le plafond de dépense de ce client est atteint. Les nouveaux essais sont arrêtés.",
          ),
        );
      }
      evenement.tentatives = essai + 1;
      try {
        reponse = await appelFetch(URL_MESSAGES, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": cle as string,
            "anthropic-version": "2023-06-01",
          },
          body: corps,
          signal: AbortSignal.timeout(delaiAppel),
        });
      } catch {
        // Coupure ou délai dépassé : l'appel a pu être facturé, la réservation est gardée.
        reponse = undefined;
        if (essai < maxTentatives - 1) await attendre(Math.min(delaiBase * 2 ** essai, delaiMax));
        continue;
      }
      if (!STATUTS_A_REPRENDRE.has(reponse.status)) break;
      // Refus explicite du service (429, 529) : rien n'a été facturé, on rend cette réservation.
      await registre.ajuster(d.client, -estime);
      if (essai < maxTentatives - 1) await attendre(delaiReprise(reponse, essai, delaiBase, delaiMax));
    }
    if (!reponse) {
      return finir(new IaErreur("service-injoignable", "Le service est injoignable. Réessayez dans quelques minutes."), "echec");
    }
    if (STATUTS_A_REPRENDRE.has(reponse.status)) {
      return finir(new IaErreur("service-occupe", "Le service est très sollicité. Réessayez dans quelques minutes."), "echec");
    }
    if (!reponse.ok) {
      // Autre statut d'erreur explicite : pas d'appel facturé, on rend la réservation.
      await registre.ajuster(d.client, -estime);
      return finir(new IaErreur("refus-service", "Le service a refusé la demande."), "echec");
    }

    let donnees: {
      content?: { type: string; text?: string }[];
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    };
    try {
      donnees = (await reponse.json()) as typeof donnees;
    } catch {
      // L'appel a peut-être coûté : on garde la réservation.
      return finir(new IaErreur("reponse-illisible", "La réponse du service est illisible."), "echec");
    }

    const usage = donnees.usage ?? {};
    const connu = usage.input_tokens !== undefined || usage.output_tokens !== undefined;
    const cache = (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
    evenement.jetons_entree = usage.input_tokens ?? 0;
    evenement.jetons_sortie = usage.output_tokens ?? 0;
    evenement.jetons_cache = cache;
    // L'appel a eu lieu et coûte : on compte les jetons même si la sortie est refusée ensuite.
    const jetons = connu ? evenement.jetons_entree + evenement.jetons_sortie + cache : estime;
    await registre.ajuster(d.client, jetons - estime);
    const total = await registre.lire(d.client);
    if (total > plafond) {
      // Le coût réel a franchi le plafond : il est enregistré, signalé, et bloque les appels suivants.
      evenement.depassement = total - plafond;
    }

    const brut = (donnees.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    let valeur: unknown;
    try {
      valeur = extraireJson(brut);
    } catch {
      return finir(new IaErreur("sortie-invalide", "La réponse de l'IA n'a pas le bon format."), "echec");
    }
    const lu = d.schema.lire(valeur);
    if (!lu.ok) {
      return finir(new IaErreur("sortie-invalide", "La réponse de l'IA n'a pas le bon format.", lu.raison), "echec");
    }

    evenement.statut = "ok";
    options.journal?.(evenement);
    return {
      sortie: lu.valeur,
      modele,
      version_prompt: d.version_prompt,
      date: new Date().toISOString(),
      jetons,
    };
  }

  return { appeler };
}
