import { describe, expect, it } from "vitest";
import { analyserCouleur, controlerCouples, luminance, rapport } from "./contraste";
import { couples, themes } from "../../design/jetons";

describe("contraste", () => {
  it("calcule le rapport noir/blanc à 21", () => {
    expect(rapport("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(rapport("#fff", "#fff")).toBeCloseTo(1, 5);
  });
  it("retrouve le rapport connu du plan : blanc sur #9a3812 = 7,12", () => {
    expect(rapport("#ffffff", "#9a3812")).toBeCloseTo(7.12, 1);
  });
  it("refuse le blanc sur l'orange #e8730c (sous 4,5)", () => {
    expect(rapport("#ffffff", "#e8730c")).toBeLessThan(4.5);
  });
  it("luminance : noir 0, blanc 1", () => {
    expect(luminance([0, 0, 0])).toBe(0);
    expect(luminance([255, 255, 255])).toBe(1);
  });
  it("lit #rgb, #rrggbb, rgb() et rgba(), refuse le reste", () => {
    expect(analyserCouleur("#f00")).toEqual([255, 0, 0, 1]);
    expect(analyserCouleur("rgb(10, 20, 30)")).toEqual([10, 20, 30, 1]);
    expect(analyserCouleur("rgba(10, 20, 30, 0.5)")).toEqual([10, 20, 30, 0.5]);
    expect(analyserCouleur("rouge")).toBeNull();
  });
  it("tous les couples des jetons passent, en clair comme en sombre", () => {
    expect(controlerCouples()).toEqual([]);
  });
  it("signale un couple qui échoue", () => {
    const mauvais = { ...themes, clair: { ...themes.clair, texte: "#faf8f4" } };
    const pb = controlerCouples(mauvais, couples);
    expect(pb.length).toBeGreaterThan(0);
    expect(pb[0]).toMatch(/clair/);
  });
});
