import { Coque, LIENS_PUBLICS } from "@/composants/coque";
import { TexteLegal } from "@/composants/ecrans";
import { DOCUMENTS } from "@/lib/comptes/documents";

export const metadata = { title: "Conditions d'utilisation" };

export default function Cgu() {
  return (
    <Coque actif="/cgu" liens={LIENS_PUBLICS(false)}>
      <TexteLegal titre="Conditions d'utilisation" version={DOCUMENTS.cgu.version} />
    </Coque>
  );
}
