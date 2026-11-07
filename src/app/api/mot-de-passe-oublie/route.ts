import { eq } from "drizzle-orm";
import { fournirEnv } from "@/lib/comptes/env-serveur";
import { traiter, versMessage } from "@/lib/comptes/http";
import { autoriserToutes, cleLimite, controleIp, REGLES } from "@/lib/comptes/limite";
import { user } from "@/lib/comptes/schema";
import { emailSchema, texteDuFormulaire as champ } from "@/lib/comptes/validation";

export async function POST(requete: Request): Promise<Response> {
  return traiter(requete, fournirEnv, { connecte: false, retour: "/mot-de-passe-oublie" }, async ({ env, ip, donnees }) => {
    const email = emailSchema.safeParse(champ(donnees, "email"));
    if (!email.success) return versMessage("/mot-de-passe-oublie", "envoye");
    const passe = await autoriserToutes(
      env.base,
      [
        ...controleIp(env.cleLimites, "courriel-ip", ip, REGLES.courrielIp),
        { cle: cleLimite(env.cleLimites, "courriel-email", email.data), regle: REGLES.courrielEmail },
      ],
      env.maintenant,
    );
    if (!passe) return versMessage("/mot-de-passe-oublie", "trop_de_demandes");
    const adresse = email.data;
    await env.apres(async () => {
      const trouves = await env.base.select({ id: user.id }).from(user).where(eq(user.email, adresse));
      if (trouves[0] === undefined) return;
      await env.auth.api.requestPasswordReset({ body: { email: adresse, redirectTo: "/mot-de-passe-oublie" } });
    });
    return versMessage("/mot-de-passe-oublie", "envoye");
  });
}
