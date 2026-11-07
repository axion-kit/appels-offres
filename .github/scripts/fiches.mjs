// Lecture des fiches de pilotage (outil interne de développement, Node pur).
import { existsSync, readdirSync, readFileSync } from "node:fs";

export const DOSSIER_FICHES = "pilotage/fiches";
export const DOSSIER_JOURNAL = "pilotage/journal";
export const MOTIF_ID = /^L\d{2}-T\d{2,}$/;
export const MOTIF_BRANCHE = /^lot-(\d{2})\/(L\d{2}-T\d{2,})$/;
export const MOTIF_TEST = /(\.(test|spec)\.(ts|tsx|mjs)$)|(^e2e\/)/;

function valeur(brut) {
  const v = brut.trim();
  if (v.startsWith("[") && v.endsWith("]")) {
    return v
      .slice(1, -1)
      .split(",")
      .map((x) => x.trim().replace(/^["']|["']$/g, ""))
      .filter((x) => x !== "");
  }
  return v.replace(/^["']|["']$/g, "");
}

// Lit l'en-tête d'une fiche : lignes « cle: valeur », listes écrites [a, b].
export function lireFiche(texte) {
  const m = texte.replace(/\r/g, "").match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fiche = {};
  for (const ligne of m[1].split("\n")) {
    const i = ligne.indexOf(":");
    if (i <= 0 || ligne.startsWith("#")) continue;
    fiche[ligne.slice(0, i).trim()] = valeur(ligne.slice(i + 1));
  }
  return fiche;
}

export function liste(v) {
  if (Array.isArray(v)) return v;
  return v ? [v] : [];
}

// Transforme un motif de fichier (* et **) en expression régulière.
export function motifVersRegex(motif) {
  let r = "";
  for (let i = 0; i < motif.length; i++) {
    const c = motif[i];
    if (c === "*" && motif[i + 1] === "*") {
      r += ".*";
      i++;
      if (motif[i + 1] === "/") i++;
    } else if (c === "*") r += "[^/]*";
    else r += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${r}$`);
}

export function estAutorise(chemin, motifs) {
  return motifs.some((p) => motifVersRegex(p).test(chemin));
}

export function lireToutesLesFiches(dossier = DOSSIER_FICHES) {
  const fiches = {};
  if (!existsSync(dossier)) return fiches;
  for (const nom of readdirSync(dossier)) {
    if (!/^L\d{2}-T\d{2,}\.md$/.test(nom)) continue;
    const f = lireFiche(readFileSync(`${dossier}/${nom}`, "utf8"));
    if (f) fiches[nom.replace(/\.md$/, "")] = f;
  }
  return fiches;
}

// Fichiers de configuration à la racine qu'aucune fiche ne peut autoriser (liste unique, utilisée pour les racines et pour les sondes).
// Pour en protéger un de plus, l'ajouter ici et seulement ici.
export const FICHIERS_RACINE_INTERDITS = [
  "eslint.config.mjs",
  "package.json",
  "pnpm-lock.yaml",
  "CLAUDE.md",
  "METHODE.md",
  "vitest.config.ts",
  "next.config.ts",
  "playwright.config.ts",
  "tsconfig.json",
  ".gitattributes",
  ".gitignore",
  "renovate.json",
  "drizzle.config.ts",
  "next-env.d.ts",
];
// Dossiers protégés : tout ce qu'ils contiennent est interdit.
export const DOSSIERS_INTERDITS = [".github", ".claude", "pilotage/fiches"];

// Zones que la garde protège : aucun motif autorisé par une fiche ne doit les couvrir.
const SONDES_INTERDITES = [
  ".github/x",
  ".github/workflows/ci.yml",
  ".github/scripts/x.mjs",
  ".claude/x",
  ".claude/agents/x.md",
  "pilotage/fiches/L99-T99.md",
  ...FICHIERS_RACINE_INTERDITS,
];
const RACINES_INTERDITES = [...DOSSIERS_INTERDITS, ...FICHIERS_RACINE_INTERDITS];

// Vrai si le motif couvre une zone protégée (ou est trop large). La fiche elle-même reste permise par son chemin exact.
export function motifInterdit(motif, id) {
  const m = motif.trim().replace(/^\.\//, "");
  if (m === "" || m === "*" || m === "**" || m.startsWith("/") || m.split("/").includes("..")) return true;
  if (id && m === `${DOSSIER_FICHES}/${id}.md`) return false;
  if (RACINES_INTERDITES.some((r) => m === r || m.startsWith(`${r}/`))) return true;
  const re = motifVersRegex(m);
  return SONDES_INTERDITES.some((x) => re.test(x));
}
