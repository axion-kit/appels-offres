import { fournirEnv } from "@/lib/comptes/env-serveur";
import { traiter, versMessage } from "@/lib/comptes/http";
import { changerRole } from "@/lib/comptes/espace";
import { texteDuFormulaire as champ } from "@/lib/comptes/validation";

export async function POST(requete: Request): Promise<Response> {
  return traiter(requete, fournirEnv, { connecte: true, retour: "/compte" }, async ({ env, ctx, donnees }) => {
    if (ctx === null) return versMessage("/compte", "non_autorise");
    const role = champ(donnees, "role") === "proprietaire" ? "proprietaire" : "membre";
    const fait = await changerRole(env, ctx, champ(donnees, "membre"), role);
    return versMessage("/compte", fait ? "role_change" : "role_refuse");
  });
}
