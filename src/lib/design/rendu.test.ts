import { describe, expect, it } from "vitest";
import { controlerRendu, evaluerDansNavigateur } from "./rendu";
import { pageEcran, pagesEcrans } from "./pages";
import { ecrans } from "../../design/ecrans";
import { construirePlanche } from "../planche/planche";
import { cssJetons } from "../../design/jetons";

const base = (corps: string, style = "") =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${cssJetons()}body{margin:0;background:var(--c-fond);color:var(--c-texte);font-size:16px}${style}</style></head><body>${corps}</body></html>`;

describe("contrôle du rendu (navigateur réel)", () => {
  it("accepte les écrans de la coque et la planche, à 360, 820 et 1280 px, en clair et en sombre", async () => {
    const pages = [...pagesEcrans(), { nom: "planche", html: construirePlanche() }];
    expect(await controlerRendu(pages)).toEqual([]);
  }, 60_000);

  it("attrape un débordement horizontal à 360 px", async () => {
    const r = await controlerRendu([{ nom: "large", html: base('<div style="width:800px">x</div>') }]);
    expect(r.some((p) => /déborde/.test(p) && /360/.test(p))).toBe(true);
  }, 30_000);

  it("attrape une cible tactile trop petite", async () => {
    const r = await controlerRendu([{ nom: "petit", html: base('<a href="#" style="display:block;height:20px;width:100px">Aller</a>') }]);
    expect(r.some((p) => /cible/i.test(p))).toBe(true);
  }, 30_000);

  it("attrape un texte trop peu contrasté et un champ trop petit pour le téléphone", async () => {
    const r = await controlerRendu([
      { nom: "pale", html: base('<p style="color:#dddddd;background:#ffffff">Texte pâle</p><input style="font-size:12px;height:44px;width:200px">') },
    ]);
    expect(r.some((p) => /contraste/i.test(p))).toBe(true);
    expect(r.some((p) => /16 px/.test(p))).toBe(true);
  }, 30_000);

  it("attrape un mot technique visible, même dans un texte alternatif", async () => {
    const r = await controlerRendu([{ nom: "jargon", html: base('<p>Erreur 500 : le serveur ne répond pas</p><img alt="token" width="10" height="10" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">') }]);
    expect(r.some((p) => /serveur/.test(p))).toBe(true);
    expect(r.some((p) => /token/.test(p))).toBe(true);
  }, 30_000);

  it("la barre latérale foncée couvre toute la hauteur de la fenêtre à 1280 px", async () => {
    for (const e of ecrans) {
      const mesure = (await evaluerDansNavigateur(
        pageEcran(e),
        1280,
        "({ barre: document.querySelector('.barre').getBoundingClientRect().height, fenetre: window.innerHeight })",
        1000,
      )) as { barre: number; fenetre: number };
      expect(mesure.barre).toBeGreaterThanOrEqual(mesure.fenetre);
    }
  }, 60_000);
});
