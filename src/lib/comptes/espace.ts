import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { journaliser } from "./audit";
import { RefusMetier, type ContexteEspace, type Env } from "./env";
import { essaiTermine } from "./contexte";
import { element, membre, user } from "./schema";

// Règle commune : toute lecture ou écriture de données porte l'espace de la personne connectée.
function exigerEssai(env: Env, ctx: ContexteEspace) {
  if (essaiTermine(ctx, env.maintenant)) throw new RefusMetier("essai_termine");
}

export async function ajouterElement(env: Env, ctx: ContexteEspace, titre: string) {
  exigerEssai(env, ctx);
  const id = randomUUID();
  await env.base.insert(element).values({ id, espaceId: ctx.espaceId, titre, creeParId: ctx.utilisateurId, creeLe: env.maintenant });
  return id;
}

export async function listerElements(env: Env, ctx: ContexteEspace) {
  exigerEssai(env, ctx);
  return env.base.select({ id: element.id, titre: element.titre }).from(element).where(eq(element.espaceId, ctx.espaceId));
}

export async function lireElement(env: Env, ctx: ContexteEspace, id: string) {
  exigerEssai(env, ctx);
  const lignes = await env.base
    .select({ id: element.id, titre: element.titre })
    .from(element)
    .where(and(eq(element.id, id), eq(element.espaceId, ctx.espaceId)));
  return lignes[0] ?? null;
}

export async function listerMembres(env: Env, ctx: ContexteEspace) {
  return env.base
    .select({ id: membre.id, email: user.email, nom: user.name, role: membre.role })
    .from(membre)
    .innerJoin(user, eq(user.id, membre.utilisateurId))
    .where(eq(membre.espaceId, ctx.espaceId));
}

// Changement de rôle réservé au propriétaire, dans son espace, en gardant toujours un propriétaire.
export async function changerRole(env: Env, ctx: ContexteEspace, membreId: string, role: "proprietaire" | "membre"): Promise<boolean> {
  if (ctx.role !== "proprietaire") return false;
  return env.base.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`espace:${ctx.espaceId}`}, 0))`);
    const cible = await tx.select({ id: membre.id, role: membre.role }).from(membre).where(and(eq(membre.id, membreId), eq(membre.espaceId, ctx.espaceId)));
    if (cible[0] === undefined) return false;
    if (cible[0].role === "proprietaire" && role === "membre") {
      const proprietaires = await tx.select({ id: membre.id }).from(membre).innerJoin(user, eq(user.id, membre.utilisateurId)).where(and(eq(membre.espaceId, ctx.espaceId), eq(membre.role, "proprietaire"), isNull(user.desactiveLe)));
      if (proprietaires.length < 2) return false;
    }
    await tx.update(membre).set({ role }).where(and(eq(membre.id, membreId), eq(membre.espaceId, ctx.espaceId)));
    await journaliser(tx, { action: "changement_role", espaceId: ctx.espaceId, utilisateurId: ctx.utilisateurId, details: `${membreId} -> ${role}` }, env.maintenant);
    return true;
  });
}
