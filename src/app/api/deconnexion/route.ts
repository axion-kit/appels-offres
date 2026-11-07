import { fournirEnv } from "@/lib/comptes/env-serveur";
import { redirection, traiter } from "@/lib/comptes/http";

export async function POST(requete: Request): Promise<Response> {
  return traiter(requete, fournirEnv, { connecte: false, retour: "/connexion" }, async ({ env, entetes }) => {
    const reponse = await env.auth.api.signOut({ headers: entetes, asResponse: true });
    return redirection("/connexion", reponse.headers.getSetCookie());
  });
}
