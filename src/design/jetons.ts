/**
 * Jetons de design : l'UNIQUE endroit où une couleur, un espacement ou une
 * taille de texte est écrit. Tout le reste (feuilles de style, composants,
 * planche) ne fait que lire ces valeurs, par des variables `var(--…)`.
 * `pnpm design:check` refuse toute couleur écrite en dur ailleurs.
 */

export const ACCENT = "#e8730c";

export type Couleurs = {
  fond: string;
  surface: string;
  texte: string;
  texteDoux: string;
  bordure: string;
  barre: string;
  barreTexte: string;
  barreTexteDoux: string;
  barreActif: string;
  accent: string;
  accentTexte: string;
  accentFort: string;
  succes: string;
  alerte: string;
  erreur: string;
};

export const themes: { clair: Couleurs; sombre: Couleurs } = {
  clair: {
    fond: "#faf8f5",
    surface: "#ffffff",
    texte: "#1c1c1e",
    texteDoux: "#5b5650",
    bordure: "#d9d2c8",
    barre: "#1f2228",
    barreTexte: "#ffffff",
    barreTexteDoux: "#c9ccd2",
    barreActif: "#33383f",
    accent: ACCENT,
    accentTexte: "#1c1c1e",
    accentFort: "#a14a00",
    succes: "#1d6b3a",
    alerte: "#8a5a00",
    erreur: "#b3261e",
  },
  sombre: {
    fond: "#15171b",
    surface: "#1e2127",
    texte: "#f2f0ec",
    texteDoux: "#b4b0a8",
    bordure: "#3a3f47",
    barre: "#0e1013",
    barreTexte: "#ffffff",
    barreTexteDoux: "#c9ccd2",
    barreActif: "#272b31",
    accent: ACCENT,
    accentTexte: "#1c1c1e",
    accentFort: "#f0933f",
    succes: "#5cc88a",
    alerte: "#e0b04a",
    erreur: "#ff8a80",
  },
};

export const espaces = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 24, s6: 32, s7: 48 } as const;
export const rayons = { petit: 8, moyen: 12, grand: 22 } as const;
export const typo = {
  police: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  corps: 16,
  petit: 14,
  moyen: 18,
  titre2: 22,
  titre1: 28,
} as const;
/** Taille minimale d'une cible tactile (px), exigée jusqu'à 720 px. */
export const CIBLE_MIN = 44;
/** Un seul point de rupture : en dessous, la vue téléphone. */
export const RUPTURE = 720;

export type Couple = { nom: string; avant: keyof Couleurs; fond: keyof Couleurs; min: number; seulement?: "clair" | "sombre" };

/** Couples texte / fond contrôlés (AA : 4,5 pour le texte, 3 pour les repères). */
export const couples: Couple[] = [
  { nom: "texte sur fond", avant: "texte", fond: "fond", min: 4.5 },
  { nom: "texte sur carte", avant: "texte", fond: "surface", min: 4.5 },
  { nom: "texte discret sur fond", avant: "texteDoux", fond: "fond", min: 4.5 },
  { nom: "texte discret sur carte", avant: "texteDoux", fond: "surface", min: 4.5 },
  { nom: "texte sur barre", avant: "barreTexte", fond: "barre", min: 4.5 },
  { nom: "texte discret sur barre", avant: "barreTexteDoux", fond: "barre", min: 4.5 },
  { nom: "texte sur entrée active", avant: "barreTexte", fond: "barreActif", min: 4.5 },
  { nom: "texte du bouton principal", avant: "accentTexte", fond: "accent", min: 4.5 },
  { nom: "lien sur fond", avant: "accentFort", fond: "fond", min: 4.5 },
  { nom: "lien sur carte", avant: "accentFort", fond: "surface", min: 4.5 },
  { nom: "accent sur barre (repère)", avant: "accent", fond: "barre", min: 3 },
  { nom: "succès sur carte", avant: "succes", fond: "surface", min: 4.5 },
  { nom: "alerte sur carte", avant: "alerte", fond: "surface", min: 4.5 },
  { nom: "erreur sur carte", avant: "erreur", fond: "surface", min: 4.5 },
  { nom: "barre contre le fond (repère)", avant: "barre", fond: "fond", min: 3, seulement: "clair" },
];

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function bloc(c: Couleurs): string {
  return (Object.entries(c) as [string, string][]).map(([k, v]) => `--c-${kebab(k)}:${v};`).join("");
}

/** Feuille de style des jetons : thème clair par défaut, sombre selon le système ou le réglage. */
export function cssJetons(): string {
  const echelle =
    Object.entries(espaces).map(([k, v]) => `--e-${k}:${v}px;`).join("") +
    Object.entries(rayons).map(([k, v]) => `--r-${k}:${v}px;`).join("") +
    `--police:${typo.police};--t-corps:${typo.corps}px;--t-petit:${typo.petit}px;` +
    `--t-moyen:${typo.moyen}px;--t-titre2:${typo.titre2}px;--t-titre1:${typo.titre1}px;` +
    `--cible:${CIBLE_MIN}px;`;
  const clair = bloc(themes.clair);
  const sombre = bloc(themes.sombre);
  return (
    `:root{color-scheme:light dark;${echelle}${clair}}` +
    `@media (prefers-color-scheme:dark){:root:not([data-theme="clair"]){${sombre}}}` +
    `:root[data-theme="sombre"]{${sombre}}` +
    `:root[data-theme="clair"]{${clair}}`
  );
}

/** Toutes les couleurs autorisées (minuscules), pour les contrôles. */
export function couleursJetons(): string[] {
  return [...new Set([...Object.values(themes.clair), ...Object.values(themes.sombre)].map((c) => c.toLowerCase()))];
}
