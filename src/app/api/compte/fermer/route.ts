import { fournirEnv } from "@/lib/comptes/env-serveur";
import { redirection, traiter, versMessage } from "@/lib/comptes/http";
import { fermerCompte } from "@/lib/comptes/rgpd";
import { texteDuFormulaire as champ } from "@/lib/comptes/validation";

export async function POST(requete: Request): Promise<Response> {
  return traiter(requete, fournirEnv, { connecte: true, retour: "/compte" }, async ({ env, ctx, donnees }) => {
    if (ctx === null) return versMessage("/compte", "non_autorise");
    const resultat = await fermerCompte(env, ctx, champ(donnees, "confirmation"));
    return resultat === "ok" ? redirection("/connexion") : versMessage("/compte", resultat);
  });
}
