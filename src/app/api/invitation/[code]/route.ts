import { fournirEnv } from "@/lib/comptes/env-serveur";
import { redirection, traiter } from "@/lib/comptes/http";
import { accepterInvitation } from "@/lib/comptes/invitation";
import { texteDuFormulaire as champ } from "@/lib/comptes/validation";

export async function POST(requete: Request, { params }: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await params;
  const retour = `/invitation/${encodeURIComponent(code)}`;
  return traiter(requete, fournirEnv, { connecte: false, retour }, async ({ env, donnees }) => {
    const resultat = await accepterInvitation(env, code, {
      nom: champ(donnees, "nom"),
      motDePasse: champ(donnees, "mot_de_passe"),
      nomEntreprise: champ(donnees, "nom_entreprise"),
      accepte: champ(donnees, "accepte"),
    });
    return redirection(resultat === "compte_pret" ? `/connexion?m=${resultat}` : `${retour}?m=${resultat}`);
  });
}
