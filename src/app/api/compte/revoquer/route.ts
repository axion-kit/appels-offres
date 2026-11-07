import { fournirEnv } from "@/lib/comptes/env-serveur";
import { traiter, versMessage } from "@/lib/comptes/http";
import { revoquerInvitations } from "@/lib/comptes/invitation";

export async function POST(requete: Request): Promise<Response> {
  return traiter(requete, fournirEnv, { connecte: true, retour: "/compte" }, async ({ env, ctx }) => {
    if (ctx === null || ctx.role !== "proprietaire") return versMessage("/compte", "non_autorise");
    await revoquerInvitations(env, ctx);
    return versMessage("/compte", "role_change");
  });
}
