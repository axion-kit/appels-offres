import { and, eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword } from "better-auth/crypto";
import { magicLink } from "better-auth/plugins/magic-link";
import { randomBytes } from "node:crypto";
import { journaliser } from "./audit";
import { DELAI_VERIFICATION_MS, expirerComptesNonVerifies } from "./expiration";
import type { Base } from "./base";
import type { Expediteur } from "./expediteur";
import { messageLienMagique, messageNouveauMotDePasse, messageVerification } from "./messages";
import { account, rateLimit, session, user, verification } from "./schema";

export type ReglagesAuth = {
  base: Base;
  expediteur: Expediteur;
  secret: string;
  urlPublique: string;
  proxyFiable: boolean;
  // Heure courante (modifiable en test).
  horloge?: () => Date;
  // Hachage du mot de passe aléatoire de la neutralisation (modifiable en test pour simuler une panne).
  hacher?: (motDePasse: string) => Promise<string>;
};

export function creerAuth({ base, expediteur, secret, urlPublique, proxyFiable, horloge = () => new Date(), hacher = hashPassword }: ReglagesAuth) {
  const estDesactive = async (id: string) => {
    const lignes = await base.select({ d: user.desactiveLe }).from(user).where(eq(user.id, id));
    return lignes[0]?.d != null;
  };
  return betterAuth({
    baseURL: urlPublique,
    secret,
    trustedOrigins: [urlPublique],
    database: drizzleAdapter(base, {
      provider: "pg",
      schema: { user, session, account, verification, rateLimit },
    }),
    user: {
      additionalFields: { desactiveLe: { type: "date", required: false, input: false } },
    },
    emailAndPassword: {
      enabled: true,
      // L'inscription passe uniquement par nos routes (mode, anti-robot, limites, espace).
      disableSignUp: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
      // Verrou levé par la personne : un compte vérifié mais jamais neutralisé (panne pendant la neutralisation)
      // redevient utilisable après « mot de passe oublié », puisque l'ancien mot de passe est alors remplacé.
      // Seule la personne qui reçoit le message peut le faire. Compte non vérifié : on ne touche à rien
      // (la neutralisation et l'expiration restent à faire).
      onPasswordReset: async ({ user: personne }) => {
        await base
          .update(user)
          .set({ autoInscrit: false })
          .where(and(eq(user.id, personne.id), eq(user.autoInscrit, true), eq(user.emailVerified, true)));
      },
      sendResetPassword: async ({ user: personne, url }) => {
        if (await estDesactive(personne.id)) return;
        await expediteur.envoyer(messageNouveauMotDePasse(personne.email, url));
      },
    },
    emailVerification: {
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: 24 * 60 * 60,
      sendVerificationEmail: async ({ user: personne, url }) => {
        await expediteur.envoyer(messageVerification(personne.email, url));
      },
      afterEmailVerification: async (personne) => {
        // Lien arrivé après 24 h : le compte vient d'expirer (voir plus bas). Rien n'est écrit et la personne
        // voit « Ce lien a expiré » au lieu de « Adresse confirmée ».
        const lignes = await base.select({ expireLe: user.expireLe }).from(user).where(eq(user.id, personne.id));
        if (lignes[0]?.expireLe != null) throw new APIError("FOUND", undefined, { Location: "/verifier-adresse?m=lien_expire" });
        await journaliser(base, { action: "verification_adresse", utilisateurId: personne.id });
      },
    },
    plugins: [
      magicLink({
        disableSignUp: true,
        expiresIn: 10 * 60,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          await expediteur.envoyer(messageLienMagique(email, url));
        },
      }),
    ],
    verification: { storeIdentifier: "hashed" },
    rateLimit: { enabled: true, storage: "database" },
    advanced: proxyFiable ? { ipAddress: { ipAddressHeaders: ["x-forwarded-for"] } } : undefined,
    databaseHooks: {
      user: {
        update: {
          // Première vérification de l'adresse d'un compte auto-inscrit (lien de confirmation OU lien de connexion) :
          // le mot de passe choisi à l'inscription est remplacé par un aléa et toutes les sessions sont coupées.
          // Sinon, quelqu'un qui inscrit l'adresse d'autrui avec son propre mot de passe garderait l'accès.
          after: async (maj) => {
            if (maj?.emailVerified !== true) return;
            const lignes = await base.select({ auto: user.autoInscrit, creeLe: user.createdAt }).from(user).where(eq(user.id, maj.id));
            if (lignes[0]?.auto !== true) return;
            // Lien arrivé après 24 h : le compte expire (désactivé, jamais effacé) au lieu de s'activer.
            if (horloge().getTime() - lignes[0].creeLe.getTime() > DELAI_VERIFICATION_MS) {
              await base.update(user).set({ emailVerified: false }).where(eq(user.id, maj.id));
              await base.delete(session).where(eq(session.userId, maj.id));
              await expirerComptesNonVerifies(base, horloge());
              return;
            }
            const alea = await hacher(randomBytes(32).toString("base64url"));
            await base.transaction(async (tx) => {
              await tx.update(account).set({ password: alea }).where(and(eq(account.userId, maj.id), eq(account.providerId, "credential")));
              await tx.delete(session).where(eq(session.userId, maj.id));
              await tx.update(user).set({ autoInscrit: false }).where(eq(user.id, maj.id));
              await journaliser(tx, { action: "mot_de_passe_neutralise", utilisateurId: maj.id });
            });
          },
        },
      },
      session: {
        create: {
          before: async (nouvelle) => {
            const lignes = await base
              .select({ desactiveLe: user.desactiveLe, auto: user.autoInscrit, verifie: user.emailVerified })
              .from(user)
              .where(eq(user.id, nouvelle.userId));
            const l = lignes[0];
            if (l === undefined || l.desactiveLe !== null) return false;
            // Verrou : adresse vérifiée mais compte jamais neutralisé (la neutralisation a échoué). Le mot de passe
            // choisi à l'inscription peut être celui d'un attaquant : aucune connexion tant que la personne
            // n'a pas choisi son mot de passe avec « mot de passe oublié ». Le parcours normal n'est pas touché :
            // la neutralisation est terminée (et autoInscrit remis à faux) avant toute création de session.
            if (l.auto === true && l.verifie === true) return false;
            return { data: nouvelle };
          },
          after: async (nouvelle) => {
            await journaliser(base, { action: "connexion", utilisateurId: nouvelle.userId });
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof creerAuth>;

export async function hacherMotDePasse(auth: Auth, motDePasse: string): Promise<string> {
  const contexte = await auth.$context;
  return contexte.password.hash(motDePasse);
}
