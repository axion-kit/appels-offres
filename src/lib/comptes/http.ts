import { contexteDepuisEntetes } from "./contexte";
import type { ContexteEspace, Env } from "./env";
import type { CodeMessage } from "./messages";
import { adresseIp, origineValide } from "./reseau";

export type Fournisseur = () => Promise<Env>;

export function redirection(chemin: string, cookies: string[] = []): Response {
  const entetes = new Headers({ Location: chemin });
  for (const cookie of cookies) entetes.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers: entetes });
}

export const versMessage = (chemin: string, code: CodeMessage) => redirection(`${chemin}?m=${code}`);

export type Appel = { env: Env; ip: string; donnees: FormData; entetes: Headers; ctx: ContexteEspace | null };

// Cadre commun des formulaires : provenance vérifiée, personne identifiée si besoin, erreurs sans mot technique.
export async function traiter(
  requete: Request,
  fournir: Fournisseur,
  reglages: { connecte: boolean; retour: string },
  action: (appel: Appel) => Promise<Response>,
): Promise<Response> {
  try {
    const env = await fournir();
    if (!origineValide(requete.headers, env.urlPublique)) return versMessage(reglages.retour, "origine_refusee");
    let ctx: ContexteEspace | null = null;
    if (reglages.connecte) {
      ctx = await contexteDepuisEntetes(env, requete.headers);
      if (ctx === null) return redirection("/connexion");
    }
    const donnees = await requete.formData();
    return await action({ env, ip: adresseIp(requete.headers, env.proxyFiable), donnees, entetes: requete.headers, ctx });
  } catch (erreur) {
    console.error("Erreur dans un formulaire", erreur);
    return versMessage(reglages.retour, "indisponible");
  }
}
