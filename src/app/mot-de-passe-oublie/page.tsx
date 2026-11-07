import { Coque, LIENS_PUBLICS, Message } from "@/composants/coque";
import { FormulaireMotDePasseOublie } from "@/composants/ecrans";
import { proprietesActuelles } from "@/lib/comptes/proprietes";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mot de passe oublié" };

// Le lien reçu par courriel revient ici avec le code du lien ; en cas de lien périmé, « error » est présent.
export default async function MotDePasseOublie({ searchParams }: { searchParams: Promise<{ m?: string; token?: string; error?: string }> }) {
  const { m, token, error } = await searchParams;
  return (
    <Coque actif="/mot-de-passe-oublie" liens={LIENS_PUBLICS(proprietesActuelles().inscription === "libre")}>
      <Message code={error === undefined ? m : "lien_invalide"} />
      <FormulaireMotDePasseOublie lien={error === undefined ? token : undefined} />
    </Coque>
  );
}
