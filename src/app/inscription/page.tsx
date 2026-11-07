import { Coque, LIENS_PUBLICS, Message } from "@/composants/coque";
import { FormulaireInscription, InscriptionNonOuverte } from "@/composants/ecrans";
import { fournirEnv } from "@/lib/comptes/env-serveur";
import { creerJetonOuverture } from "@/lib/comptes/piege";

export const dynamic = "force-dynamic";

export const metadata = { title: "Créer un compte" };

export default async function Inscription({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const env = await fournirEnv();
  const libre = env.proprietes.inscription === "libre";
  return (
    <Coque actif="/inscription" liens={LIENS_PUBLICS(libre)}>
      <Message code={m} />
      {libre ? <FormulaireInscription jeton={creerJetonOuverture(env.cleRobots, env.maintenant)} /> : <InscriptionNonOuverte />}
    </Coque>
  );
}
