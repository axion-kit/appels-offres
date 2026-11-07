import { fournirEnv } from "@/lib/comptes/env-serveur";
import { boiteEnvoi } from "@/lib/comptes/expediteur";

// Pour les parcours automatiques seulement : fermée dès qu'une base réelle ou l'hébergeur est présent.
export async function GET(requete: Request): Promise<Response> {
  const env = await fournirEnv();
  const adresse = new URL(requete.url).searchParams.get("a");
  if (!env.boiteDeTest || adresse === null) return new Response("Introuvable", { status: 404 });
  const messages = boiteEnvoi().filter((m) => m.a === adresse.toLowerCase());
  return Response.json(messages, { headers: { "Cache-Control": "no-store" } });
}
