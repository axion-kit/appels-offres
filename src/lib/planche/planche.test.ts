import { describe, expect, it } from "vitest";
import { ecrans, synthese } from "../../design/ecrans";
import { construirePlanche, feuilleCoque, QUESTIONS } from "./planche";

describe("planche de maquettes", () => {
  const html = construirePlanche();
  it("contient la synthèse, chaque écran en deux tailles et trois questions", () => {
    expect(html).toContain(synthese.objectif);
    for (const e of ecrans) expect(html).toContain(`<h2>${e.titre}</h2>`);
    expect(html.match(/<h3>Sur téléphone/g)).toHaveLength(ecrans.length);
    expect(html.match(/<h3>Sur ordinateur/g)).toHaveLength(ecrans.length);
    expect(QUESTIONS).toHaveLength(3);
    expect(html.match(/<fieldset/g)).toHaveLength(3);
  });
  it("garde le minuteur et le code, sans lien mort", () => {
    expect(html).toContain('id="minuteur"');
    expect(html).toContain('id="code"');
    expect(html).not.toContain('href="#"');
  });
  it("bloque l'envoi des formulaires de maquette (la page ne se recharge pas)", () => {
    expect(html).toContain('addEventListener("submit"');
    expect(html).toContain("preventDefault");
  });
  it("embarque la feuille de la coque", () => {
    expect(feuilleCoque()).toContain(".coque");
    expect(html).toContain(".coque");
  });
});
