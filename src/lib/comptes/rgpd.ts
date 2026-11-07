import { and, eq, isNull, sql } from "drizzle-orm";
import { journaliser } from "./audit";
import type { CodeMessage } from "./messages";
import { messageFermetureCompte } from "./messages";
import type { ContexteEspace, Env } from "./env";
import { consentement, element, espace, journalAudit, membre, session, user } from "./schema";
import { normaliserEmail } from "./validation";

// Copie des données de la personne, à télécharger.
export async function exporterDonnees(env: Env, ctx: ContexteEspace) {
  const [profil] = await env.base.select({ nom: user.name, email: user.email, creeLe: user.createdAt }).from(user).where(eq(user.id, ctx.utilisateurId));
  const [monEspace] = await env.base.select({ nom: espace.nom, essaiJusquAu: espace.essaiJusquAu }).from(espace).where(eq(espace.id, ctx.espaceId));
  const consentements = await env.base.select({ document: consentement.document, version: consentement.version, accepteLe: consentement.accepteLe }).from(consentement).where(eq(consentement.utilisateurId, ctx.utilisateurId));
  const journal = await env.base.select({ action: journalAudit.action, date: journalAudit.creeLe }).from(journalAudit).where(eq(journalAudit.utilisateurId, ctx.utilisateurId));
  const elements = await env.base.select({ titre: element.titre, creeLe: element.creeLe }).from(element).where(and(eq(element.espaceId, ctx.espaceId), eq(element.creeParId, ctx.utilisateurId)));
  await journaliser(env.base, { action: "export_donnees", espaceId: ctx.espaceId, utilisateurId: ctx.utilisateurId }, env.maintenant);
  return { exporteLe: env.maintenant.toISOString(), profil, espace: monEspace, role: ctx.role, consentements, journal, elements };
}

// Fermeture = désactivation. Rien n'est effacé ; l'administrateur est prévenu.
export async function fermerCompte(env: Env, ctx: ContexteEspace, confirmation: string): Promise<CodeMessage | "ok"> {
  if (normaliserEmail(confirmation) !== ctx.email) return "fermeture_confirmation";
  const refus = await env.base.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`espace:${ctx.espaceId}`}, 0))`);
    if (ctx.role === "proprietaire") {
      const actifs = await tx
        .select({ id: membre.id, role: membre.role })
        .from(membre)
        .innerJoin(user, eq(user.id, membre.utilisateurId))
        .where(and(eq(membre.espaceId, ctx.espaceId), isNull(user.desactiveLe)));
      const autresProprietaires = actifs.filter((m) => m.role === "proprietaire").length - 1;
      if (actifs.length > 1 && autresProprietaires < 1) return "fermeture_proprietaire" as const;
    }
    await tx.update(user).set({ desactiveLe: env.maintenant, updatedAt: env.maintenant }).where(eq(user.id, ctx.utilisateurId));
    // Les connexions ouvertes sont coupées (ce sont des traces techniques, pas des données de la personne).
    await tx.delete(session).where(eq(session.userId, ctx.utilisateurId));
    await journaliser(tx, { action: "fermeture", espaceId: ctx.espaceId, utilisateurId: ctx.utilisateurId }, env.maintenant);
    return null;
  });
  if (refus !== null) return refus;
  await env.apres(async () => {
    for (const admin of env.administrateurs) {
      await env.expediteur.envoyer(messageFermetureCompte(admin, ctx.email, ctx.nomEspace));
    }
  });
  return "ok";
}

