import { Coque, LIENS_PUBLICS, Message } from "@/composants/coque";
import { FormulaireInvitation, InvitationInvalide } from "@/composants/ecrans";
import { fournirEnv } from "@/lib/comptes/env-serveur";
import { apercuInvitation } from "@/lib/comptes/invitation";

export const dynamic = "force-dynamic";

export const metadata = { title: "Invitation" };

export default async function Invitation({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ m?: string }> }) {
  const [{ code }, { m }] = await Promise.all([params, searchParams]);
  const env = await fournirEnv();
  const apercu = env.proprietes.inscription === "fermee" ? null : await apercuInvitation(env, code);
  return (
    <Coque actif="/invitation" liens={LIENS_PUBLICS(false)}>
      <Message code={m} />
      {apercu === null ? <InvitationInvalide /> : <FormulaireInvitation code={code} apercu={apercu} />}
    </Coque>
  );
}
