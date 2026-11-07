import { describe, expect, it } from "vitest";
import { evaluerDansNavigateur } from "../design/rendu";
import { decoderResultat, encoderResultat, SCRIPT_CODE, SECONDES_MAX } from "./code";

describe("code de résultat", () => {
  it("se décode à l'identique pour toutes les réponses", () => {
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        for (let c = 0; c < 3; c++) {
          const code = encoderResultat({ reponses: [a, b, c], secondes: 125 });
          expect(decoderResultat(code)).toEqual({ reponses: [a, b, c], secondes: 125 });
        }
  });
  it("borne la durée", () => {
    expect(decoderResultat(encoderResultat({ reponses: [0, 0, 0], secondes: 99999 }))?.secondes).toBe(SECONDES_MAX);
    expect(decoderResultat(encoderResultat({ reponses: [0, 0, 0], secondes: -5 }))?.secondes).toBe(0);
  });
  it("refuse un code mal recopié", () => {
    const code = encoderResultat({ reponses: [1, 2, 0], secondes: 300 });
    const faux = (code.charAt(0) === "a" ? "b" : "a") + code.slice(1);
    expect(decoderResultat(faux)).toBeNull();
    expect(decoderResultat("abc")).toBeNull();
    expect(decoderResultat("zzzzz")).toBeNull();
    expect(decoderResultat("")).toBeNull();
  });
  it("donne le même code dans le navigateur que dans le module", async () => {
    const html = `<!doctype html><html><body><script>${SCRIPT_CODE}</script></body></html>`;
    const cas: [number, number, number, number][] = [[2, 1, 0, 754], [0, 0, 0, 0], [1, 2, 2, 99999], [0, 1, 2, -5]];
    for (const [a, b, c, s] of cas) {
      const dansPage = await evaluerDansNavigateur(html, 360, `encoder(${a}, ${b}, ${c}, ${s})`);
      expect(dansPage).toBe(encoderResultat({ reponses: [a, b, c], secondes: s }));
    }
  }, 30_000);
});
