// Liste les fiches prêtes, celles qui en débloquent le plus d'abord.
import { pathToFileURL } from "node:url";
import { liste, lireToutesLesFiches, motifVersRegex } from "./fiches.mjs";

export function calculerPretes(fiches) {
  const ids = Object.keys(fiches);
  const enfants = {};
  for (const id of ids) enfants[id] = [];
  for (const id of ids) for (const d of liste(fiches[id].depend_de)) enfants[d]?.push(id);
  const debloquees = (id) => {
    const vus = new Set();
    const pile = [...(enfants[id] ?? [])];
    while (pile.length > 0) {
      const x = pile.pop();
      if (vus.has(x)) continue;
      vus.add(x);
      if (fiches[x].statut === "a_faire") pile.push(...enfants[x]);
    }
    return [...vus].filter((x) => fiches[x].statut === "a_faire").length;
  };
  return ids
    .filter((id) => {
      const f = fiches[id];
      return f.statut === "a_faire" && !f.bloque_par && liste(f.depend_de).every((d) => fiches[d]?.statut === "fait");
    })
    .map((id) => ({ id, titre: fiches[id].titre ?? "", debloque: debloquees(id), sensible: fiches[id].sensible === "oui" }))
    .sort((a, b) => b.debloque - a.debloque || a.id.localeCompare(b.id));
}

// Dossier fixe d'un motif : la partie avant le premier joker, coupée au dernier « / ».
function dossierDe(motif) {
  const i = motif.indexOf("*");
  const tete = i >= 0 ? motif.slice(0, i) : motif;
  return tete.slice(0, tete.lastIndexOf("/") + 1);
}

// Deux entrées (fichier ou motif) se touchent si l'une couvre l'autre, ou si l'une a un joker et qu'elles partagent un dossier.
function seTouchent(x, y) {
  if (x === y) return true;
  if (motifVersRegex(x).test(y) || motifVersRegex(y).test(x)) return true;
  if (!x.includes("*") && !y.includes("*")) return false;
  const dx = dossierDe(x);
  const dy = dossierDe(y);
  return dx.startsWith(dy) || dy.startsWith(dx);
}

// Paires de fiches prêtes qui touchent le même fichier : elles ne partent jamais ensemble.
export function pairesEnConflit(fiches, pretes) {
  const paires = [];
  for (let i = 0; i < pretes.length; i++) {
    for (let j = i + 1; j < pretes.length; j++) {
      const a = liste(fiches[pretes[i].id].fichiers_autorises);
      const b = liste(fiches[pretes[j].id].fichiers_autorises);
      const commun = [];
      for (const x of a) for (const y of b) if (seTouchent(x, y)) commun.push(x === y ? x : `${x} ~ ${y}`);
      if (commun.length > 0) paires.push({ a: pretes[i].id, b: pretes[j].id, fichiers: commun });
    }
  }
  return paires;
}

function principal() {
  const fiches = lireToutesLesFiches();
  const pretes = calculerPretes(fiches);
  console.log(`${pretes.length} fiche(s) prête(s) sur ${Object.keys(fiches).length}.`);
  for (const p of pretes) console.log(`${p.id}  débloque ${p.debloque}${p.sensible ? "  (sensible)" : ""}  ${p.titre}`);
  for (const c of pairesEnConflit(fiches, pretes)) console.log(`Pas ensemble : ${c.a} et ${c.b} (même fichier : ${c.fichiers.join(", ")})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
