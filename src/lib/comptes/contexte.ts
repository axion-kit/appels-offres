import { eq } from "drizzle-orm";
import type { ContexteEspace, Env } from "./env";
import { espace, membre, user } from "./schema";

// Qui est la personne, quel est son espace : lu côté serveur à partir de la connexion, jamais fourni par la page.
export async function contexteDepuisEntetes(env: Env, entetes: Headers): Promise<ContexteEspace | null> {
  const ouverte = await env.auth.api.getSession({ headers: entetes });
  if (ouverte === null) return null;
  return contexteDeLUtilisateur(env, ouverte.user.id);
}

export async function contexteDeLUtilisateur(env: Env, utilisateurId: string): Promise<ContexteEspace | null> {
  const lignes = await env.base
    .select({
      id: user.id,
      email: user.email,
      nom: user.name,
      verifie: user.emailVerified,
      desactiveLe: user.desactiveLe,
      espaceId: espace.id,
      nomEspace: espace.nom,
      essaiJusquAu: espace.essaiJusquAu,
      role: membre.role,
    })
    .from(user)
    .innerJoin(membre, eq(membre.utilisateurId, user.id))
    .innerJoin(espace, eq(espace.id, membre.espaceId))
    .where(eq(user.id, utilisateurId));
  const l = lignes[0];
  if (l === undefined || !l.verifie || l.desactiveLe !== null) return null;
  return {
    utilisateurId: l.id,
    email: l.email,
    nom: l.nom,
    espaceId: l.espaceId,
    nomEspace: l.nomEspace,
    role: l.role === "proprietaire" ? "proprietaire" : "membre",
    essaiJusquAu: l.essaiJusquAu,
    administrateur: env.administrateurs.includes(l.email),
  };
}

export function essaiTermine(ctx: Pick<ContexteEspace, "essaiJusquAu">, maintenant: Date): boolean {
  return ctx.essaiJusquAu !== null && ctx.essaiJusquAu.getTime() <= maintenant.getTime();
}
