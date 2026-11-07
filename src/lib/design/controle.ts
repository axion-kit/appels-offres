import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ecrans } from "../../design/ecrans";
import { construirePlanche } from "../planche/planche";
import { couleursEnDur } from "./couleurs";
import { controlerCouples } from "./contraste";
import { pagesEcrans } from "./pages";
import { controlerRendu } from "./rendu";

const EXTENSIONS = /\.(css|ts|tsx)$/;
const IGNORES = new Set(["node_modules", ".next", "coverage"]);

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    if (IGNORES.has(nom)) return [];
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

/** Toute couleur écrite en dur dans `src/` hors du fichier des jetons et des tests. */
export function scannerCouleurs(racine: string): string[] {
  const src = join(racine, "src");
  return fichiers(src)
    .map((f) => relative(racine, f).split("\\").join("/"))
    .filter((f) => EXTENSIONS.test(f) && f !== "src/design/jetons.ts" && !/\.test\.tsx?$/.test(f))
    .flatMap((f) => couleursEnDur(f, readFileSync(join(racine, f), "utf8")));
}

/** Lance tous les contrôles de design. Renvoie les problèmes et un résumé de ce qui a été vérifié. */
export async function lancerControles(racine: string = process.cwd()): Promise<{ problemes: string[]; resume: string[] }> {
  const resume: string[] = [];
  const problemes: string[] = [];

  const c1 = controlerCouples();
  problemes.push(...c1);
  resume.push(`Contrastes des jetons (AA, clair et sombre) : ${c1.length ? c1.length + " problème(s)" : "bon"}`);

  const c2 = scannerCouleurs(racine);
  problemes.push(...c2);
  resume.push(`Couleurs venant toutes des jetons : ${c2.length ? c2.length + " problème(s)" : "bon"}`);

  const pages = [...pagesEcrans(), { nom: "planche", html: construirePlanche() }];
  const c3 = await controlerRendu(pages);
  problemes.push(...c3);
  resume.push(
    `Rendu réel de ${ecrans.length} écran(s) et de la planche à 360, 820 et 1280 px (débordement, cibles de 44 px, contraste mesuré, champs de 16 px, langage sans jargon) : ${c3.length ? c3.length + " problème(s)" : "bon"}`,
  );
  return { problemes, resume };
}
