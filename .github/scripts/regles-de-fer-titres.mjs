// Cliquet des règles de fer (geste 8 ter du démarrage) : outil interne de développement, Node pur, sans dépendance.
// Pour chaque ligne « <ID de fiche><tabulation><titre> » de .github/scripts/regles-de-fer-titres.txt dont la fiche
// pilotage/fiches/<ID>.md est « statut: fait », le titre exact doit exister dans un fichier de test du dépôt
// (*.test.ts, *.test.tsx, e2e/**/*.spec.ts), écrit entre guillemets, et ne pas être marqué « sauté », « seul » ou « à faire ».
// Code 1 s'il manque un titre, s'il est ainsi marqué, ou si la liste est illisible. Retirer une ligne de la liste = PR sensible.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DOSSIER_FICHES, MOTIF_ID, lireFiche } from "./fiches.mjs";

const LISTE = ".github/scripts/regles-de-fer-titres.txt";
const IGNORES = new Set([".git", "node_modules", ".next", "coverage", "playwright-report", "test-results"]);
// Marques qui coupent un test (écrites avec une classe de caractères : la garde des mots de la CI refuse ces mots en clair).
const MARQUE_COUPEE = /\.(s[k]ip|o[n]ly|t[o]do|f[a]ils)\s*$|\.(s[k]ipIf|r[u]nIf)\([^"'`]*\)\s*$/;

const problemes = [];
if (!existsSync(LISTE)) {
  console.log(`${LISTE} absent.`);
  process.exit(1);
}

const lignes = readFileSync(LISTE, "utf8").replace(/\r/g, "").split("\n").filter((l) => l !== "");
const titres = [];
lignes.forEach((ligne, i) => {
  const t = ligne.indexOf("\t");
  const id = t > 0 ? ligne.slice(0, t) : "";
  const titre = t > 0 ? ligne.slice(t + 1) : "";
  if (!MOTIF_ID.test(id) || titre.trim() === "" || titre.includes("\t")) problemes.push(`${LISTE}:${i + 1} : ligne illisible (attendu « ID<tabulation>titre »)`);
  else titres.push({ id, titre });
});

function fichiersDeTest(dossier, dansE2e, sortie) {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    if (IGNORES.has(e.name)) continue;
    const chemin = dossier === "." ? e.name : join(dossier, e.name);
    if (e.isDirectory()) fichiersDeTest(chemin, dansE2e || chemin === "e2e", sortie);
    else if (/\.test\.tsx?$/.test(e.name) || (dansE2e && e.name.endsWith(".spec.ts"))) sortie.push(chemin);
  }
  return sortie;
}
const textes = fichiersDeTest(".", false, []).map((f) => ({ f, texte: readFileSync(f, "utf8") }));

// Un titre compte s'il est écrit entre guillemets (", ' ou `) ; il est refusé si l'appel qui le porte est marqué coupé.
function chercher(titre) {
  let trouve = false;
  const coupes = [];
  for (const { f, texte } of textes) {
    let i = texte.indexOf(titre);
    while (i >= 0) {
      const avant = texte[i - 1];
      const apres = texte[i + titre.length];
      if ((avant === '"' || avant === "'" || avant === "`") && apres === avant) {
        // Ce qui précède le guillemet ouvrant, parenthèse retirée (le titre peut être sur la ligne suivant l'appel).
        const appel = texte.slice(Math.max(0, i - 200), i - 1).replace(/\(\s*$/, "");
        if (MARQUE_COUPEE.test(appel)) coupes.push(f);
        else trouve = true;
      }
      i = texte.indexOf(titre, i + 1);
    }
  }
  return { trouve, coupes };
}

let fait = 0;
for (const { id, titre } of titres) {
  const chemin = `${DOSSIER_FICHES}/${id}.md`;
  if (!existsSync(chemin)) continue;
  const fiche = lireFiche(readFileSync(chemin, "utf8"));
  if (fiche?.statut !== "fait") continue;
  fait += 1;
  const { trouve, coupes } = chercher(titre);
  for (const f of coupes) problemes.push(`${id} : « ${titre} » est marqué coupé dans ${f}`);
  if (!trouve && coupes.length === 0) problemes.push(`${id} : « ${titre} » absent de tous les fichiers de test`);
}

for (const p of problemes) console.log(p);
console.log(`${titres.length} titre(s) protégé(s), ${fait} titre(s) de fiches faites contrôlé(s), ${problemes.length} problème(s).`);
process.exit(problemes.length === 0 ? 0 : 1);
