import { fournirEnv } from "@/lib/comptes/env-serveur";
import { traiter, versMessage } from "@/lib/comptes/http";
import { creerCompteParAdministrateur } from "@/lib/comptes/invitation";
import { texteDuFormulaire as champ } from "@/lib/comptes/validation";

export async function POST(requete: Request): Promise<Response> {
  return traiter(requete, fournirEnv, { connecte: true, retour: "/compte" }, async ({ env, ctx, donnees }) => {
    if (ctx === null) return versMessage("/compte", "non_autorise");
    return versMessage("/compte", await creerCompteParAdministrateur(env, ctx, champ(donnees, "email"), champ(donnees, "nom_entreprise")));
  });
}
