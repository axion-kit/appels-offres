import { Coque, LIENS_PUBLICS } from "@/composants/coque";
import { TexteLegal } from "@/composants/ecrans";
import { DOCUMENTS } from "@/lib/comptes/documents";

export const metadata = { title: "Politique de confidentialité" };

export default function Confidentialite() {
  return (
    <Coque actif="/confidentialite" liens={LIENS_PUBLICS(false)}>
      <TexteLegal titre="Politique de confidentialité" version={DOCUMENTS.confidentialite.version} />
    </Coque>
  );
}
