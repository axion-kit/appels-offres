import { fournirEnv } from "@/lib/comptes/env-serveur";
import { redirection, traiter, versMessage } from "@/lib/comptes/http";
import { inscrire } from "@/lib/comptes/inscription";
import { texteDuFormulaire as champ } from "@/lib/comptes/validation";

export async function POST(requete: Request): Promise<Response> {
  return traiter(requete, fournirEnv, { connecte: false, retour: "/inscription" }, async ({ env, ip, donnees }) => {
    const code = await inscrire(
      env,
      {
        email: champ(donnees, "email"),
        motDePasse: champ(donnees, "mot_de_passe"),
        nomEntreprise: champ(donnees, "nom_entreprise"),
        accepte: champ(donnees, "accepte"),
        piege: champ(donnees, "site_web"),
        jeton: champ(donnees, "ouvert_le"),
      },
      ip,
    );
    return code === "inscription_envoyee" ? redirection("/verifier-adresse?m=inscription_envoyee") : versMessage("/inscription", code);
  });
}
