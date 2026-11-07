import { Coque, LIENS_PUBLICS, Message } from "@/composants/coque";
import { FormulaireConnexion } from "@/composants/ecrans";
import { proprietesActuelles } from "@/lib/comptes/proprietes";

export const dynamic = "force-dynamic";

export const metadata = { title: "Connexion" };

export default async function Connexion({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  return (
    <Coque actif="/connexion" liens={LIENS_PUBLICS(proprietesActuelles().inscription === "libre")}>
      <Message code={m} />
      <FormulaireConnexion />
    </Coque>
  );
}
