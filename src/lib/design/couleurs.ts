const NOMS =
  "red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|brown|cyan|magenta|teal|navy|maroon|olive|lime|aqua|silver|gold|violet|indigo|crimson|coral|salmon|tomato";

const MOTIFS: [RegExp, string][] = [
  [/#[0-9a-fA-F]{3,8}\b/g, "couleur hexadécimale"],
  [/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.%]/g, "couleur en fonction"],
  [/\b(?:repeating-)?(?:linear|radial|conic)-gradient\(/g, "dégradé"],
  // propriété CSS (y compris dans une chaîne de TSX) dont la valeur contient un nom de couleur,
  // même en valeur de repli d une variable ou dans une ombre
  [
    new RegExp(
      `\\b(?:color|background|border|outline|fill|stroke|box-shadow|text-shadow|caret-color|accent-color)[a-z-]*\\s*:[^;{}"'\`]*\\b(?:${NOMS})\\b`,
      "i",
    ),
    "couleur nommée",
  ],
  // propriété camelCase en TSX (couleur de bordure, ombre, etc.) avec un nom de couleur
  [
    new RegExp(
      `\\b(?:[a-z]*Color|fill|stroke|background|border[A-Za-z]*|outline|boxShadow|textShadow)\\s*:\\s*["'\`][^"'\`]*\\b(?:${NOMS})\\b`,
      "i",
    ),
    "couleur nommée",
  ],
];

/** Cherche toute couleur écrite en dur dans un fichier (hors jetons) ; renvoie « fichier:ligne : type ». */
export function couleursEnDur(fichier: string, contenu: string): string[] {
  const problemes: string[] = [];
  contenu.split("\n").forEach((ligne, i) => {
    const code = fichier.endsWith(".css") ? ligne.replace(/\/\*.*?\*\//g, "") : ligne;
    for (const [motif, type] of MOTIFS) {
      motif.lastIndex = 0;
      if (motif.test(code)) problemes.push(`${fichier}:${i + 1} : ${type} écrite en dur (utiliser un jeton)`);
    }
  });
  return problemes;
}
