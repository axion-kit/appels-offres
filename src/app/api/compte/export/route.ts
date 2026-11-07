import { contexteDepuisEntetes } from "@/lib/comptes/contexte";
import { fournirEnv } from "@/lib/comptes/env-serveur";
import { redirection } from "@/lib/comptes/http";
import { exporterDonnees } from "@/lib/comptes/rgpd";

export async function GET(requete: Request): Promise<Response> {
  const env = await fournirEnv();
  const ctx = await contexteDepuisEntetes(env, requete.headers);
  if (ctx === null) return redirection("/connexion");
  const copie = await exporterDonnees(env, ctx);
  return new Response(JSON.stringify(copie, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mes-donnees.json"',
      "Cache-Control": "no-store",
    },
  });
}
