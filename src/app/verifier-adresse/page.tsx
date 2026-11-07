import { Coque, LIENS_PUBLICS, Message } from "@/composants/coque";
import { EcranVerification } from "@/composants/ecrans";
import { codeVerification } from "@/lib/comptes/messages";
import { proprietesActuelles } from "@/lib/comptes/proprietes";

export const dynamic = "force-dynamic";

export const metadata = { title: "Vérifier mon adresse" };

// La librairie renvoie ici avec « error » quand le lien de confirmation n'est plus valable.
export default async function VerifierAdresse({ searchParams }: { searchParams: Promise<{ m?: string; error?: string }> }) {
  const { m, error } = await searchParams;
  const code = codeVerification(m, error);
  return (
    <Coque actif="/verifier-adresse" liens={LIENS_PUBLICS(proprietesActuelles().inscription === "libre")}>
      <Message code={code === "adresse_confirmee" ? undefined : code} />
      <EcranVerification code={code} />
    </Coque>
  );
}
