import { couples as couplesDefaut, themes as themesDefaut, type Couple, type Couleurs } from "../../design/jetons";

export type Rgba = [number, number, number, number];

/** Lit #rgb, #rrggbb, rgb() ou rgba() ; null si le format n'est pas reconnu. */
export function analyserCouleur(texte: string): Rgba | null {
  const t = texte.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(t);
  if (hex) {
    const h = hex[1] as string;
    const p = h.length === 3 ? [...h].map((c) => c + c) : (h.match(/../g) as string[]);
    return [parseInt(p[0] as string, 16), parseInt(p[1] as string, 16), parseInt(p[2] as string, 16), 1];
  }
  const f = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?\s*\)$/.exec(t);
  if (f) return [Number(f[1]), Number(f[2]), Number(f[3]), f[4] === undefined ? 1 : Number(f[4])];
  return null;
}

/** Luminance relative WCAG (0 à 1). */
export function luminance([r, g, b]: [number, number, number] | Rgba): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Rapport de contraste WCAG entre deux couleurs. */
export function rapport(a: string, b: string): number {
  const ca = analyserCouleur(a);
  const cb = analyserCouleur(b);
  if (!ca || !cb) throw new Error(`Couleur illisible : ${a} / ${b}`);
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Vérifie tous les couples des jetons dans chaque thème ; renvoie les problèmes (liste vide = bon). */
export function controlerCouples(
  themes: { clair: Couleurs; sombre: Couleurs } = themesDefaut,
  couples: Couple[] = couplesDefaut,
): string[] {
  const problemes: string[] = [];
  for (const [nomTheme, c] of Object.entries(themes) as [string, Couleurs][]) {
    for (const k of couples) {
      if (k.seulement && k.seulement !== nomTheme) continue;
      const r = rapport(c[k.avant], c[k.fond]);
      if (r < k.min) {
        problemes.push(`Contraste insuffisant (${nomTheme}) : ${k.nom} = ${r.toFixed(2)} (minimum ${k.min})`);
      }
    }
  }
  return problemes;
}
