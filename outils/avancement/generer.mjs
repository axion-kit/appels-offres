// Écrit _site/index.html et _site/avancement.json. Usage : node outils/avancement/generer.mjs
// Variables facultatives : GITHUB_TOKEN (lecture), GITHUB_REPOSITORY (organisation/outil),
// DEPOT_PUBLIC ("true" si le dépôt est public ; sinon objectif, prochaine action et question sont masqués).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chargerGithub, composer, depotEstPublic, rendrePage } from "./lib.mjs";

const lireFichier = (chemin) => {
  try {
    return readFileSync(chemin, "utf8");
  } catch {
    return "";
  }
};
// Dans un outil, SPEC.md et REPRENDRE.md à jour vivent sur la branche `etat` (extraite dans .etat/ par le workflow).
// Sans elle (gabarit, essai local), on lit la copie de main.
const lire = (chemin) => lireFichier(`.etat/${chemin}`) || lireFichier(chemin);

const depot = process.env.GITHUB_REPOSITORY ?? "";
let outil = depot.split("/")[1] ?? "";
if (!outil) {
  try {
    outil = JSON.parse(lire("package.json")).name ?? "";
  } catch {
    outil = "";
  }
}

const github = await chargerGithub({ depot, token: process.env.GITHUB_TOKEN });
const synthese = composer({ outil, spec: lire("SPEC.md"), reprendre: lire("REPRENDRE.md"), github, depotPublic: depotEstPublic(process.env.DEPOT_PUBLIC) });

mkdirSync("_site", { recursive: true });
writeFileSync("_site/index.html", rendrePage(synthese));
writeFileSync("_site/avancement.json", `${JSON.stringify(synthese, null, 2)}\n`);
console.log(`_site/index.html et _site/avancement.json écrits (${synthese.exigences.total} objectifs, suivi en ligne ${github.disponible ? "disponible" : "indisponible"})`);
