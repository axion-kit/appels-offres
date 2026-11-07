import { renderToStaticMarkup } from "react-dom/server";
import { Coque } from "../../components/Coque";
import { EcranVue } from "../../components/EcranVue";
import { cssJetons } from "../../design/jetons";
import { ecrans as ecransDefaut, menu as menuDefaut, nomOutil as nomDefaut, type Ecran } from "../../design/ecrans";
import { feuilleCoque } from "../planche/planche";

/** Page complète d'un écran déclaré, telle que l'utilisateur la voit (pour les contrôles). */
export function pageEcran(e: Ecran, nomOutil = nomDefaut, menu = menuDefaut): string {
  const corps = renderToStaticMarkup(
    <Coque nomOutil={nomOutil} menu={menu} actif={e.rubrique ?? e.titre}>
      <EcranVue ecran={e} />
    </Coque>,
  );
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${nomOutil}</title><style>${cssJetons()}${feuilleCoque()}</style></head><body>${corps}</body></html>`;
}

export function pagesEcrans(): { nom: string; html: string }[] {
  return ecransDefaut.map((e) => ({ nom: `écran « ${e.titre} »`, html: pageEcran(e) }));
}
