import { eq } from "drizzle-orm";
import { fournirEnv } from "@/lib/comptes/env-serveur";
import { traiter, versMessage } from "@/lib/comptes/http";
import { autoriserToutes, cleLimite, controleIp, REGLES } from "@/lib/comptes/limite";
import { user } from "@/lib/comptes/schema";
import { emailSchema, texteDuFormulaire as champ } from "@/lib/comptes/validation";

// Même réponse que l'adresse existe ou non : le message part (ou non) après la réponse.
export async function POST(requete: Request): Promise<Response> {
  return traiter(requete, fournirEnv, { connecte: false, retour: "/connexion" }, async ({ env, ip, donnees, entetes }) => {
    const email = emailSchema.safeParse(champ(donnees, "email"));
    if (!email.success) return versMessage("/connexion", "envoye");
    const passe = await autoriserToutes(
      env.base,
      [
        ...controleIp(env.cleLimites, "courriel-ip", ip, REGLES.courrielIp),
        { cle: cleLimite(env.cleLimites, "courriel-email", email.data), regle: REGLES.courrielEmail },
      ],
      env.maintenant,
    );
    if (!passe) return versMessage("/connexion", "trop_de_demandes");
    const adresse = email.data;
    await env.apres(async () => {
      const trouves = await env.base.select({ id: user.id, desactiveLe: user.desactiveLe }).from(user).where(eq(user.email, adresse));
      if (trouves[0] === undefined || trouves[0].desactiveLe !== null) return;
      await env.auth.api.signInMagicLink({ body: { email: adresse, callbackURL: "/compte" }, headers: entetes });
    });
    return versMessage("/connexion", "envoye");
  });
}
