import { fournirEnv } from "@/lib/comptes/env-serveur";
import { redirection, traiter, versMessage } from "@/lib/comptes/http";
import { expirerComptesNonVerifies } from "@/lib/comptes/expiration";
import { envoyerVerification } from "@/lib/comptes/inscription";
import { autoriserPassage, autoriserToutes, cleLimite, controleIp, REGLES } from "@/lib/comptes/limite";
import { emailSchema, texteDuFormulaire as champ } from "@/lib/comptes/validation";

export async function POST(requete: Request): Promise<Response> {
  return traiter(requete, fournirEnv, { connecte: false, retour: "/connexion" }, async ({ env, ip, donnees, entetes }) => {
    const email = emailSchema.safeParse(champ(donnees, "email"));
    const motDePasse = champ(donnees, "mot_de_passe");
    if (!email.success || motDePasse === "") return versMessage("/connexion", "identifiants_incorrects");
    const passe = await autoriserToutes(
      env.base,
      [
        ...controleIp(env.cleLimites, "connexion-ip", ip, REGLES.connexionIp),
        { cle: cleLimite(env.cleLimites, "connexion-email", email.data), regle: REGLES.connexionEmail },
      ],
      env.maintenant,
    );
    if (!passe) return versMessage("/connexion", "trop_de_demandes");
    await expirerComptesNonVerifies(env.base, env.maintenant);
    const reponse = await env.auth.api.signInEmail({ body: { email: email.data, password: motDePasse }, headers: entetes, asResponse: true });
    if (reponse.ok) return redirection("/compte", reponse.headers.getSetCookie());
    if (reponse.status === 403) {
      const cle = cleLimite(env.cleLimites, "courriel-email", email.data);
      if (await autoriserPassage(env.base, cle, REGLES.courrielEmail, env.maintenant)) {
        await env.apres(() => envoyerVerification(env, email.data));
      }
      return versMessage("/connexion", "adresse_a_verifier");
    }
    return versMessage("/connexion", "identifiants_incorrects");
  });
}
