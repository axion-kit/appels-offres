import { createHmac, randomUUID } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { Base } from "./base";
import { limiteFrequence } from "./schema";

export type RegleLimite = { max: number; fenetreMs: number };

export const REGLES = {
  inscriptionIp: { max: 5, fenetreMs: 60 * 60 * 1000 },
  inscriptionEmail: { max: 3, fenetreMs: 60 * 60 * 1000 },
  courrielIp: { max: 10, fenetreMs: 60 * 60 * 1000 },
  courrielEmail: { max: 3, fenetreMs: 60 * 60 * 1000 },
  connexionIp: { max: 20, fenetreMs: 15 * 60 * 1000 },
  connexionEmail: { max: 8, fenetreMs: 15 * 60 * 1000 },
  invitationEspace: { max: 20, fenetreMs: 24 * 60 * 60 * 1000 },
} satisfies Record<string, RegleLimite>;

// Les adresses ne sont jamais gardées en clair dans la table de limitation.
export function cleLimite(secret: string, famille: string, valeur: string): string {
  return `${famille}:${createHmac("sha256", secret).update(valeur).digest("hex").slice(0, 32)}`;
}

// Fenêtre glissante en base : on compte les passages récents, on refuse s'il y en a trop.
// Un verrou par clé évite que deux demandes simultanées passent toutes les deux.
export async function autoriserPassage(
  base: Base,
  cle: string,
  regle: RegleLimite,
  maintenant: Date,
): Promise<boolean> {
  return base.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${cle}, 0))`);
    const debut = new Date(maintenant.getTime() - regle.fenetreMs);
    await tx.delete(limiteFrequence).where(and(eq(limiteFrequence.cle, cle), lt(limiteFrequence.creeLe, debut)));
    const recents = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(limiteFrequence)
      .where(and(eq(limiteFrequence.cle, cle), gt(limiteFrequence.creeLe, debut)));
    if ((recents[0]?.n ?? 0) >= regle.max) return false;
    await tx.insert(limiteFrequence).values({ id: randomUUID(), cle, creeLe: maintenant });
    return true;
  });
}

// Limite par adresse IP. Quand l'adresse n'est pas connue, on n'ignore pas la limite : on applique un plafond
// global (un seul compteur pour tout le monde) si l'appelant en fournit un.
export function controleIp(
  secret: string,
  famille: string,
  ip: string,
  regle: RegleLimite,
  plafondInconnue?: { famille: string; regle: RegleLimite },
): { cle: string; regle: RegleLimite }[] {
  if (ip !== "inconnue") return [{ cle: cleLimite(secret, famille, ip), regle }];
  return plafondInconnue === undefined ? [] : [{ cle: cleLimite(secret, plafondInconnue.famille, "global"), regle: plafondInconnue.regle }];
}

// Plusieurs clés d'un coup (par adresse IP et par adresse e-mail) : toutes doivent passer.
export async function autoriserToutes(
  base: Base,
  controles: { cle: string; regle: RegleLimite }[],
  maintenant: Date,
): Promise<boolean> {
  let autorise = true;
  for (const { cle, regle } of controles) {
    if (!(await autoriserPassage(base, cle, regle, maintenant))) autorise = false;
  }
  return autorise;
}
