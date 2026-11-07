import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { journaliser } from "./audit";
import { hacherMotDePasse } from "./auth";
import { DOCUMENTS } from "./documents";
import { expirerComptesNonVerifies } from "./expiration";
import { estViolationUnicite, type Env } from "./env";
import { autoriserPassage, autoriserToutes, cleLimite, controleIp, REGLES } from "./limite";
import { messageDejaInscrit } from "./messages";
import { jugerRobot } from "./piege";
import { account, consentement, espace, membre, user } from "./schema";
import type { CodeMessage } from "./messages";
import { emailSchema, inscriptionSchema } from "./validation";

export type EntreeInscription = {
  email: string;
  motDePasse: string;
  nomEntreprise: string;
  accepte: string;
  piege: string;
  jeton: string;
};

export function finEssai(env: Pick<Env, "maintenant" | "proprietes">): Date | null {
  const jours = env.proprietes.essaiJours;
  return jours === 0 ? null : new Date(env.maintenant.getTime() + jours * 24 * 60 * 60 * 1000);
}

type Ecriture = Pick<Env["base"], "insert">;

export async function enregistrerConsentements(base: Ecriture, utilisateurId: string, maintenant: Date) {
  await base.insert(consentement).values(
    (["cgu", "confidentialite"] as const).map((cle) => ({
      id: randomUUID(),
      utilisateurId,
      document: cle,
      version: DOCUMENTS[cle].version,
      accepteLe: maintenant,
    })),
  );
}

export async function inscrire(env: Env, entree: EntreeInscription, ip: string): Promise<CodeMessage> {
  // 1. Le mode est vérifié côté serveur, avant toute autre chose.
  if (env.proprietes.inscription !== "libre") return "inscription_fermee";

  if (env.inscriptionLibreBloquee) {
    console.error("Inscription libre refusée : COMPTES_PROXY_FIABLE n'est pas réglé (voir docs/comptes.md).");
    return "indisponible";
  }

  // 2. Robots : le champ piège reçoit la même réponse qu'un succès, sans rien créer.
  const verdict = jugerRobot(env.cleRobots, env.maintenant, entree, env.delaiMinMs);
  if (verdict === "trop_vite") return "trop_vite";

  const passeIp = await autoriserToutes(env.base, controleIp(env.cleLimites, "inscription-ip", ip, REGLES.inscriptionIp, { famille: "inscription-global", regle: { max: env.plafondInscriptionGlobal, fenetreMs: REGLES.inscriptionIp.fenetreMs } }), env.maintenant);
  if (!passeIp) return "trop_de_demandes";
  if (verdict === "robot") return "inscription_envoyee";

  const lu = inscriptionSchema.safeParse({
    email: entree.email,
    motDePasse: entree.motDePasse,
    nomEntreprise: entree.nomEntreprise,
    accepte: entree.accepte === "oui",
  });
  if (!lu.success) return "formulaire_invalide";
  const { email, motDePasse, nomEntreprise } = lu.data;

  const passeEmail = await autoriserPassage(env.base, cleLimite(env.cleLimites, "inscription-email", email), REGLES.inscriptionEmail, env.maintenant);
  if (!passeEmail) return "trop_de_demandes";

  await expirerComptesNonVerifies(env.base, env.maintenant);

  // Le hachage est fait dans tous les cas : le temps de réponse ne dit pas si l'adresse existe.
  const hache = await hacherMotDePasse(env.auth, motDePasse);
  const existant = await env.base.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existant.length > 0) {
    await env.apres(() => env.expediteur.envoyer(messageDejaInscrit(email, `${env.urlPublique}/connexion`)));
    return "inscription_envoyee";
  }

  const utilisateurId = randomUUID();
  const espaceId = randomUUID();
  try {
    await env.base.transaction(async (tx) => {
      await tx.insert(user).values({ id: utilisateurId, name: nomEntreprise, email, emailVerified: false, autoInscrit: true, createdAt: env.maintenant, updatedAt: env.maintenant });
      await tx.insert(account).values({ id: randomUUID(), accountId: utilisateurId, providerId: "credential", userId: utilisateurId, password: hache, createdAt: env.maintenant, updatedAt: env.maintenant });
      await tx.insert(espace).values({ id: espaceId, nom: nomEntreprise, essaiJusquAu: finEssai(env), creeLe: env.maintenant });
      await tx.insert(membre).values({ id: randomUUID(), espaceId, utilisateurId, role: "proprietaire", creeLe: env.maintenant });
      await enregistrerConsentements(tx, utilisateurId, env.maintenant);
      await journaliser(tx, { action: "inscription", espaceId, utilisateurId }, env.maintenant);
    });
  } catch (erreur) {
    // Deux envois en même temps : le second trouve l'adresse déjà prise, même réponse.
    if (estViolationUnicite(erreur)) return "inscription_envoyee";
    throw erreur;
  }
  await env.apres(() => envoyerVerification(env, email));
  return "inscription_envoyee";
}

export async function envoyerVerification(env: Env, email: string): Promise<void> {
  await env.auth.api.sendVerificationEmail({ body: { email, callbackURL: "/verifier-adresse?m=adresse_confirmee" } });
}

export function emailValide(valeur: string): string | null {
  const lu = emailSchema.safeParse(valeur);
  return lu.success ? lu.data : null;
}
