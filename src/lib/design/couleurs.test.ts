import { describe, expect, it } from "vitest";
import { couleursEnDur } from "./couleurs";

describe("couleurs en dur", () => {
  it("accepte du code qui n'utilise que des variables", () => {
    expect(couleursEnDur("a.css", "a{color:var(--c-texte);background:transparent}")).toEqual([]);
  });
  it("attrape hex, rgb, hsl, dégradés et couleurs nommées", () => {
    const css = "a{color:#fff;background:rgb(1,2,3);border-color:hsl(1,2%,3%);background-image:linear-gradient(red,blue)}\nb{color:red}";
    const r = couleursEnDur("a.css", css);
    expect(r.length).toBeGreaterThanOrEqual(4);
    expect(r[0]).toContain("a.css:1");
  });
  it("attrape un hex dans du code TypeScript", () => {
    expect(couleursEnDur("a.tsx", 'const c = "#e8730c";')).toHaveLength(1);
  });
  it("attrape la couleur nommée d'un style en ligne TSX", () => {
    expect(couleursEnDur("a.tsx", 'const s = { color: "red" };')).toHaveLength(1);
  });
  it("ignore une ancre ou un identifiant qui ressemble à un hex", () => {
    expect(couleursEnDur("a.tsx", 'href="#"; id="#section"; const x = "a#b";')).toEqual([]);
  });
  it("attrape une couleur nommée dans var(--x, red), box-shadow et les bordures", () => {
    expect(couleursEnDur("a.css", "a{color:var(--c-texte, red)}")).toHaveLength(1);
    expect(couleursEnDur("a.css", "a{box-shadow:0 0 4px black}")).toHaveLength(1);
    expect(couleursEnDur("a.css", "a{border:1px solid white}")).toHaveLength(1);
    expect(couleursEnDur("a.css", "a{outline: 2px dashed blue}")).toHaveLength(1);
  });
  it("attrape les propriétés camelCase en TSX", () => {
    expect(couleursEnDur("a.tsx", 'const s = { borderColor: "red" };')).toHaveLength(1);
    expect(couleursEnDur("a.tsx", "const s = { backgroundColor: 'blue' };")).toHaveLength(1);
    expect(couleursEnDur("a.tsx", 'const s = { boxShadow: "0 0 2px black" };')).toHaveLength(1);
  });
  it("laisse passer un texte ordinaire qui contient un nom de couleur", () => {
    expect(couleursEnDur("a.tsx", 'const t = { titre: "Orange et vert", detail: "Reste: 3 olives" };')).toEqual([]);
    expect(couleursEnDur("a.css", "a{color:var(--c-texte);/* accent: orange */}")).toEqual([]);
  });
});
