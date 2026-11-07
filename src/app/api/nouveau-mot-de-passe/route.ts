import { fournirEnv } from "@/lib/comptes/env-serveur";
import { traiter, versMessage } from "@/lib/comptes/http";
import { motDePasseSchema, texteDuFormulaire as champ } from "@/lib/comptes/validation";

export async function POST(requete: Request): Promise<Response> {
  return traiter(requete, fournirEnv, { connecte: false, retour: "/mot-de-passe-oublie" }, async ({ env, donnees }) => {
    const lien = champ(donnees, "lien");
    const nouveau = motDePasseSchema.safeParse(champ(donnees, "mot_de_passe"));
    if (!nouveau.success) return versMessage("/mot-de-passe-oublie", "formulaire_invalide");
    const reponse = await env.auth.api.resetPassword({ body: { newPassword: nouveau.data, token: lien }, asResponse: true });
    return reponse.ok ? versMessage("/connexion", "mot_de_passe_change") : versMessage("/mot-de-passe-oublie", "lien_invalide");
  });
}
