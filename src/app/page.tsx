import { Coque } from "@/components/Coque";
import { EcranVue } from "@/components/EcranVue";
import { ecrans, menu, nomOutil } from "@/design/ecrans";
import { heureParis } from "@/lib/heure-paris";
import { salutation } from "@/lib/salutation";

export const dynamic = "force-dynamic";

export default function Accueil() {
  const accueil = ecrans[0];
  if (!accueil) return null;
  const message = `${salutation(heureParis(new Date()))} !`;
  return (
    <Coque nomOutil={nomOutil} menu={menu} actif={accueil.rubrique ?? accueil.titre}>
      <EcranVue ecran={accueil} titre={message} />
    </Coque>
  );
}
