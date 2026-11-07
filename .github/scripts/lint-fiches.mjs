// Contrôle de cohérence des fiches avant de les lancer.
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DOSSIER_JOURNAL, MOTIF_TEST, liste, lireToutesLesFiches, motifInterdit } from "./fiches.mjs";

export function controlerFiches(fiches, journalExiste = () => true) {
  const problemes = [];
  for (const [nom, f] of Object.entries(fiches)) {
    const p = (texte) => problemes.push(`${nom} : ${texte}`);
    if (f.id !== nom) p(`l'id « ${f.id} » ne correspond pas au nom du fichier`);
    if (f.statut !== "a_faire" && f.statut !== "fait") p(`statut « ${f.statut} » inconnu (a_faire ou fait)`);
    if (!f.titre) p("titre absent");
    const fichiers = liste(f.fichiers_autorises);
    if (fichiers.length === 0) p("aucun fichier autorisé");
    for (const x of fichiers) if (motifInterdit(x, nom)) p(`motif interdit « ${x} » (zone protégée ou trop large)`);
    const taille = Number(f.taille_max_lignes);
    if (!Number.isInteger(taille) || taille <= 0) p("taille_max_lignes doit être un entier positif");
    if (f.tests_requis === "oui" && !fichiers.some((x) => MOTIF_TEST.test(x))) p("tests exigés mais aucun fichier de test autorisé");
    if (f.statut === "fait" && !journalExiste(nom)) p(`statut fait sans ${DOSSIER_JOURNAL}/${nom}.md`);
    for (const d of liste(f.depend_de)) {
      if (d === nom) p("dépend d'elle-même");
      else if (!fiches[d]) p(`dépend de ${d} qui n'existe pas`);
      else if (f.statut === "fait" && fiches[d].statut !== "fait") p(`statut fait alors que ${d} n'est pas fait`);
    }
  }
  for (const id of Object.keys(fiches)) {
    const vus = new Set();
    const pile = [...liste(fiches[id].depend_de)];
    while (pile.length > 0) {
      const x = pile.pop();
      if (x === id) {
        problemes.push(`${id} : cycle de dépendances`);
        break;
      }
      if (vus.has(x) || !fiches[x]) continue;
      vus.add(x);
      pile.push(...liste(fiches[x].depend_de));
    }
  }
  return problemes;
}

function principal() {
  const fiches = lireToutesLesFiches();
  const problemes = controlerFiches(fiches, (id) => existsSync(`${DOSSIER_JOURNAL}/${id}.md`));
  console.log(`${Object.keys(fiches).length} fiche(s) contrôlée(s), ${problemes.length} problème(s).`);
  for (const p of problemes) console.log(p);
  return problemes.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(principal());
