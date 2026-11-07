import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { journaliser } from "./audit";
import { hacherMotDePasse } from "./auth";
import { RefusMetier, estViolationUnicite, type ContexteEspace, type Env } from "./env";
import { enregistrerConsentements, emailValide, finEssai } from "./inscription";
import { autoriserPassage, cleLimite, REGLES } from "./limite";
import { messageInvitation, type CodeMessage } from "./messages";
import { account, espace, invitation, membre, user } from "./schema";
import { acceptationInvitationSchema } from "./validation";

export const INVITATION_JOURS = 7;

export const hacherCode = (code: string) => createHash("sha256").update(code).digest("hex");

async function emettre(env: Env, entree: { espaceId: string | null; nomEspace: string | null; email: string; role: "proprietaire" | "membre"; inviteParId: string }) {
  const code = randomBytes(32).toString("base64url");
  const expireLe = new Date(env.maintenant.getTime() + INVITATION_JOURS * 24 * 60 * 60 * 1000);
  await env.base.insert(invitation).values({
    id: randomUUID(),
    espaceId: entree.espaceId,
    email: entree.email,
    role: entree.role,
    codeHash: hacherCode(code),
    expireLe,
    inviteParId: entree.inviteParId,
    creeLe: env.maintenant,
  });
  const lien = `${env.urlPublique}/invitation/${code}`;
  await env.apres(() => env.expediteur.envoyer(messageInvitation(entree.email, lien, entree.nomEspace, INVITATION_JOURS)));
}

async function adresseDejaUtilisee(env: Env, email: string): Promise<boolean> {
  const lignes = await env.base.select({ id: user.id }).from(user).where(eq(user.email, email));
  return lignes.length > 0;
}

// Le propriétaire invite un collègue dans son espace. Même réponse que l'adresse ait un compte ou non.
export async function inviterColleague(env: Env, ctx: ContexteEspace, emailBrut: string): Promise<CodeMessage> {
  if (env.proprietes.inscription === "fermee" || ctx.role !== "proprietaire") return "non_autorise";
  const email = emailValide(emailBrut);
  if (email === null) return "formulaire_invalide";
  const passe = await autoriserPassage(env.base, cleLimite(env.cleLimites, "invitation-espace", ctx.espaceId), REGLES.invitationEspace, env.maintenant);
  if (!passe) return "trop_de_demandes";
  if (!(await adresseDejaUtilisee(env, email))) {
    await emettre(env, { espaceId: ctx.espaceId, nomEspace: ctx.nomEspace, email, role: "membre", inviteParId: ctx.utilisateurId });
  }
  await journaliser(env.base, { action: "invitation", espaceId: ctx.espaceId, utilisateurId: ctx.utilisateurId }, env.maintenant);
  return "invitation_envoyee";
}

// L'administrateur invite une nouvelle entreprise (elle aura son propre espace).
export async function inviterEntreprise(env: Env, ctx: ContexteEspace, emailBrut: string): Promise<CodeMessage> {
  if (!ctx.administrateur || env.proprietes.inscription === "fermee") return "non_autorise";
  const email = emailValide(emailBrut);
  if (email === null) return "formulaire_invalide";
  if (!(await adresseDejaUtilisee(env, email))) {
    await emettre(env, { espaceId: null, nomEspace: null, email, role: "proprietaire", inviteParId: ctx.utilisateurId });
  }
  await journaliser(env.base, { action: "invitation", utilisateurId: ctx.utilisateurId, details: "nouvelle entreprise" }, env.maintenant);
  return "invitation_envoyee";
}

export async function revoquerInvitations(env: Env, ctx: ContexteEspace): Promise<void> {
  if (ctx.role !== "proprietaire") throw new RefusMetier("non_autorise");
  await env.base
    .update(invitation)
    .set({ expireLe: env.maintenant })
    .where(and(eq(invitation.espaceId, ctx.espaceId), isNull(invitation.utiliseeLe), gt(invitation.expireLe, env.maintenant)));
}

export type ApercuInvitation = { email: string; nomEspace: string | null };

// Lecture seule (la page d'invitation) : ne consomme rien.
export async function apercuInvitation(env: Env, code: string): Promise<ApercuInvitation | null> {
  const lignes = await env.base
    .select({ email: invitation.email, nomEspace: espace.nom })
    .from(invitation)
    .leftJoin(espace, eq(espace.id, invitation.espaceId))
    .where(and(eq(invitation.codeHash, hacherCode(code)), isNull(invitation.utiliseeLe), gt(invitation.expireLe, env.maintenant)));
  const ligne = lignes[0];
  return ligne === undefined ? null : { email: ligne.email, nomEspace: ligne.nomEspace };
}

export type EntreeAcceptation = { nom: string; motDePasse: string; nomEntreprise: string; accepte: string };

export async function accepterInvitation(env: Env, code: string, entree: EntreeAcceptation): Promise<CodeMessage> {
  if (env.proprietes.inscription === "fermee") return "inscription_fermee";
  const lu = acceptationInvitationSchema.safeParse({
    nom: entree.nom,
    motDePasse: entree.motDePasse,
    nomEntreprise: entree.nomEntreprise === "" ? undefined : entree.nomEntreprise,
  });
  if (!lu.success || entree.accepte !== "oui") return "formulaire_invalide";
  // Le lien est vérifié avant le calcul lourd du mot de passe.
  if ((await apercuInvitation(env, code)) === null) return "lien_invalide";
  const hache = await hacherMotDePasse(env.auth, lu.data.motDePasse);
  try {
    await env.base.transaction(async (tx) => {
      // Usage unique : une seule demande peut faire passer la ligne de « non utilisée » à « utilisée ».
      const prises = await tx
        .update(invitation)
        .set({ utiliseeLe: env.maintenant })
        .where(and(eq(invitation.codeHash, hacherCode(code)), isNull(invitation.utiliseeLe), gt(invitation.expireLe, env.maintenant)))
        .returning();
      const prise = prises[0];
      if (prise === undefined) throw new RefusMetier("lien_invalide");
      let espaceId = prise.espaceId;
      if (espaceId !== null) {
        // L'invitation ne vaut que si la personne qui l'a envoyée est toujours propriétaire active de l'espace.
        const auteurs = await tx
          .select({ id: membre.id })
          .from(membre)
          .innerJoin(user, eq(user.id, membre.utilisateurId))
          .where(and(eq(membre.espaceId, espaceId), eq(membre.utilisateurId, prise.inviteParId ?? ""), eq(membre.role, "proprietaire"), isNull(user.desactiveLe)));
        if (auteurs.length === 0) throw new RefusMetier("lien_invalide");
      }
      if (espaceId === null) {
        if (lu.data.nomEntreprise === undefined) throw new RefusMetier("formulaire_invalide");
        espaceId = randomUUID();
        await tx.insert(espace).values({ id: espaceId, nom: lu.data.nomEntreprise, essaiJusquAu: finEssai(env), creeLe: env.maintenant });
      }
      const utilisateurId = randomUUID();
      // L'adresse est celle de l'invitation (jamais celle saisie) ; le lien reçu par courriel la prouve.
      await tx.insert(user).values({ id: utilisateurId, name: lu.data.nom, email: prise.email, emailVerified: true, createdAt: env.maintenant, updatedAt: env.maintenant });
      await tx.insert(account).values({ id: randomUUID(), accountId: utilisateurId, providerId: "credential", userId: utilisateurId, password: hache, createdAt: env.maintenant, updatedAt: env.maintenant });
      await tx.insert(membre).values({ id: randomUUID(), espaceId, utilisateurId, role: prise.role, creeLe: env.maintenant });
      await enregistrerConsentements(tx, utilisateurId, env.maintenant);
      await journaliser(tx, { action: "invitation_acceptee", espaceId, utilisateurId }, env.maintenant);
    });
  } catch (erreur) {
    if (erreur instanceof RefusMetier) return erreur.code === "formulaire_invalide" ? "formulaire_invalide" : "lien_invalide";
    if (estViolationUnicite(erreur)) return "lien_invalide";
    throw erreur;
  }
  return "compte_pret";
}

// Mode « fermée » : l'administrateur crée le compte ; la personne reçoit un lien de connexion.
export async function creerCompteParAdministrateur(env: Env, ctx: ContexteEspace, emailBrut: string, nomEntrepriseBrut: string): Promise<CodeMessage> {
  if (!ctx.administrateur) return "non_autorise";
  const email = emailValide(emailBrut);
  const nom = acceptationInvitationSchema.shape.nomEntreprise.safeParse(nomEntrepriseBrut);
  if (email === null || !nom.success || nom.data === undefined) return "formulaire_invalide";
  const nomEspace: string = nom.data;
  if (await adresseDejaUtilisee(env, email)) return "compte_cree";
  const utilisateurId = randomUUID();
  const espaceId = randomUUID();
  // Mot de passe aléatoire que personne ne connaît : la personne en choisira un via le lien reçu.
  const hache = await hacherMotDePasse(env.auth, randomBytes(32).toString("base64url"));
  try {
    await env.base.transaction(async (tx) => {
      await tx.insert(user).values({ id: utilisateurId, name: nomEspace, email, emailVerified: false, createdAt: env.maintenant, updatedAt: env.maintenant });
      await tx.insert(account).values({ id: randomUUID(), accountId: utilisateurId, providerId: "credential", userId: utilisateurId, password: hache, createdAt: env.maintenant, updatedAt: env.maintenant });
      await tx.insert(espace).values({ id: espaceId, nom: nomEspace, essaiJusquAu: finEssai(env), creeLe: env.maintenant });
      await tx.insert(membre).values({ id: randomUUID(), espaceId, utilisateurId, role: "proprietaire", creeLe: env.maintenant });
      await journaliser(tx, { action: "creation_par_administrateur", espaceId, utilisateurId: ctx.utilisateurId }, env.maintenant);
    });
  } catch (erreur) {
    if (estViolationUnicite(erreur)) return "compte_cree";
    throw erreur;
  }
  await env.apres(async () => {
    await env.auth.api.signInMagicLink({ body: { email, callbackURL: "/compte" }, headers: new Headers() });
  });
  return "compte_cree";
}

export async function invitationsEnAttente(env: Env, ctx: ContexteEspace) {
  return env.base
    .select({ id: invitation.id, email: invitation.email, expireLe: invitation.expireLe })
    .from(invitation)
    .where(and(eq(invitation.espaceId, ctx.espaceId), isNull(invitation.utiliseeLe), gt(invitation.expireLe, env.maintenant)));
}
