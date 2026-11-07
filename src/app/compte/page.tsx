import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Coque, LIENS_CONNECTES, Message } from "@/composants/coque";
import { PageCompte } from "@/composants/ecrans";
import { contexteDepuisEntetes, essaiTermine } from "@/lib/comptes/contexte";
import { fournirEnv } from "@/lib/comptes/env-serveur";
import { listerMembres } from "@/lib/comptes/espace";
import { invitationsEnAttente } from "@/lib/comptes/invitation";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mon compte" };

export default async function Compte({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const env = await fournirEnv();
  const ctx = await contexteDepuisEntetes(env, await headers());
  if (ctx === null) redirect("/connexion");
  const membres = await listerMembres(env, ctx);
  const attente = ctx.role === "proprietaire" ? await invitationsEnAttente(env, ctx) : [];
  return (
    <Coque actif="/compte" liens={LIENS_CONNECTES} deconnexion>
      <Message code={m} />
      <PageCompte ctx={ctx} membres={membres} attente={attente} essaiTermine={essaiTermine(ctx, env.maintenant)} modeInscription={env.proprietes.inscription} />
    </Coque>
  );
}
