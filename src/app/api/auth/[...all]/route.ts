import { cheminLibrairieAutorise } from "@/lib/comptes/reseau";
import { fournirEnv } from "@/lib/comptes/env-serveur";

// Seuls les liens reçus par courriel passent ici ; tout le reste de la librairie reste fermé.
export async function GET(requete: Request): Promise<Response> {
  const adresse = new URL(requete.url);
  if (!cheminLibrairieAutorise("GET", adresse.pathname)) return new Response("Introuvable", { status: 404 });
  const env = await fournirEnv();
  return env.auth.handler(requete);
}
