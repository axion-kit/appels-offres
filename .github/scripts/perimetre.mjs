// Garde de périmètre : une branche lot-NN/LNN-Tmm ne touche que les fichiers de sa fiche, dans la taille prévue.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { DOSSIER_FICHES, DOSSIER_JOURNAL, MOTIF_BRANCHE, estAutorise, lireFiche, liste, motifInterdit } from "./fiches.mjs";

// Lit la sortie de « git diff --numstat --no-renames » : un élément par fichier modifié.
export function lireNumstat(sortie) {
  return sortie
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => {
      const [a, s, ...reste] = l.split("\t");
      // Un binaire (« - ») est signalé : verifier() le refuse hors de public/, principal() compte ses lignes réelles.
      const binaire = a === "-" || s === "-";
      return { chemin: reste.join("\t"), lignes: binaire ? 1 : Number(a) + Number(s), binaire };
    });
}

// Champs de l'en-tête qui changent entre la base et la PR, hors « statut ».
function champsChanges(base, pr) {
  const noms = new Set([...Object.keys(base), ...Object.keys(pr)]);
  noms.delete("statut");
  return [...noms].filter((n) => JSON.stringify(base[n]) !== JSON.stringify(pr[n]));
}

// Renvoie la liste des problèmes (vide si tout est bon).
// La fiche qui fait foi est celle de la BASE (ficheTexte) ; celle de la PR (fichePRTexte) ne peut changer que son statut.
// entree : { branche, fichiers, ficheTexte(id), fichePRTexte(id), statutDe(id), journalExiste(id), liens }
// liens : chemins qui sont des liens symboliques (mode 120000) ; tout lien dans les fichiers de la PR est refusé.
export function verifier({ branche, fichiers, ficheTexte, fichePRTexte, statutDe, journalExiste, liens = [] }) {
  const m = MOTIF_BRANCHE.exec(branche);
  if (!m) {
    if (branche.startsWith("lot-")) return [`La branche « ${branche} » commence par lot- mais ne suit pas le motif lot-NN/LNN-Tmm.`];
    return [];
  }
  const [, lot, id] = m;
  const texte = ficheTexte(id);
  if (texte === null) return [`fiche ${id} absente de la base`];
  const fiche = lireFiche(texte);
  if (!fiche) return [`La fiche ${id} n'a pas d'en-tête lisible.`];
  const prTexte = fichePRTexte ? fichePRTexte(id) : texte;
  const fichePR = prTexte === null ? null : lireFiche(prTexte);
  if (!fichePR) return [`La fiche ${id} est absente ou illisible dans la PR.`];
  const problemes = [];
  if (fiche.id !== id) problemes.push(`La fiche annonce l'id « ${fiche.id} » mais la branche est ${id}.`);
  if (!id.startsWith(`L${lot}-`)) problemes.push(`Le numéro de lot de la branche (${lot}) ne correspond pas à ${id}.`);
  const changes = champsChanges(fiche, fichePR);
  if (changes.length > 0) problemes.push(`La PR change l'en-tête de la fiche ${id} (${changes.join(", ")}) : seul le statut peut changer.`);
  const autorises = liste(fiche.fichiers_autorises);
  for (const x of autorises) if (motifInterdit(x, id)) problemes.push(`Motif interdit dans la fiche ${id} : ${x}`);
  const permis = [...autorises, `${DOSSIER_FICHES}/${id}.md`, `${DOSSIER_JOURNAL}/${id}.md`];
  for (const f of fichiers) {
    if (!estAutorise(f.chemin, permis)) problemes.push(`Fichier hors de la fiche ${id} : ${f.chemin}`);
  }
  for (const f of fichiers) {
    if (f.binaire && !f.chemin.startsWith("public/")) problemes.push(`Fichier binaire refusé hors de public/ : ${f.chemin}`);
    if (liens.includes(f.chemin)) problemes.push(`Lien symbolique refusé : ${f.chemin}`);
  }
  for (const c of [`${DOSSIER_FICHES}/${id}.md`, `${DOSSIER_JOURNAL}/${id}.md`]) {
    if (liens.includes(c) && !fichiers.some((f) => f.chemin === c)) problemes.push(`Lien symbolique refusé : ${c}`);
  }
  const max = Number(fiche.taille_max_lignes);
  const total = fichiers.reduce((n, f) => n + f.lignes, 0);
  if (!Number.isFinite(max) || max <= 0) problemes.push(`La fiche ${id} n'a pas de taille maximale valable.`);
  else if (total > max) problemes.push(`Trop gros : ${total} lignes changées pour ${max} permises. Compacter, ou séparer le code et la clôture.`);
  if (fichePR.statut === "fait") {
    if (!journalExiste(id)) problemes.push(`La fiche ${id} est « fait » mais ${DOSSIER_JOURNAL}/${id}.md n'existe pas.`);
    for (const d of liste(fiche.depend_de)) {
      if (statutDe(d) !== "fait") problemes.push(`La fiche ${id} est « fait » alors que ${d} ne l'est pas.`);
    }
  }
  return problemes;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024 });
}

// Contenu d'un fichier tel qu'il est dans HEAD (null si absent) : jamais le disque, qui peut cacher un lien.
function depuisHead(chemin) {
  try {
    return git(["show", `HEAD:${chemin}`]);
  } catch {
    return null;
  }
}

// Nombre de lignes réelles : retours à la ligne, plus une dernière ligne sans retour.
export function compterLignes(texte) {
  if (texte === "") return 0;
  return texte.split("\n").length - (texte.endsWith("\n") ? 1 : 0);
}

// Lit « git ls-files -s » et renvoie les chemins en mode 120000 (liens symboliques) ou 160000 (sous-modules).
export function lireLiens(sortie) {
  return sortie
    .split("\n")
    .filter((l) => l.startsWith("120000 ") || l.startsWith("160000 "))
    .map((l) => l.split("\t").slice(1).join("\t"));
}

function cheminsFiche(branche) {
  const m = MOTIF_BRANCHE.exec(branche);
  return m ? [`${DOSSIER_FICHES}/${m[2]}.md`, `${DOSSIER_JOURNAL}/${m[2]}.md`] : [];
}

function principal() {
  const branche = process.argv[2] ?? process.env.GITHUB_HEAD_REF ?? "";
  const base = process.argv[3] ?? `origin/${process.env.GITHUB_BASE_REF ?? "main"}`;
  if (!branche.startsWith("lot-")) {
    console.log(`Branche « ${branche} » : pas une branche de fiche, rien à contrôler.`);
    return 0;
  }
  const fichiers = lireNumstat(git(["diff", "--numstat", "--no-renames", `${base}...HEAD`])).map((f) => {
    // Binaire permis (public/) : on compte ses lignes réelles dans HEAD ; supprimé ou illisible = 1.
    if (!f.binaire || !f.chemin.startsWith("public/")) return f;
    const reel = depuisHead(f.chemin);
    return { ...f, lignes: reel === null ? 1 : Math.max(1, compterLignes(reel)) };
  });
  const chemin = (id) => `${DOSSIER_FICHES}/${id}.md`;
  const deLaBase = (id) => {
    try {
      return git(["show", `${base}:${chemin(id)}`]);
    } catch {
      return null;
    }
  };
  const liens = lireLiens(git(["--literal-pathspecs", "ls-files", "-s", "--", ...fichiers.map((f) => f.chemin), ...cheminsFiche(branche)]));
  const problemes = verifier({
    branche,
    fichiers,
    ficheTexte: deLaBase,
    fichePRTexte: (id) => depuisHead(chemin(id)),
    statutDe: (id) => {
      const t = deLaBase(id);
      return t === null ? undefined : lireFiche(t)?.statut;
    },
    journalExiste: (id) => depuisHead(`${DOSSIER_JOURNAL}/${id}.md`) !== null,
    liens,
  });
  if (problemes.length === 0) {
    console.log(`Périmètre respecté (${fichiers.length} fichier(s)).`);
    return 0;
  }
  for (const p of problemes) console.log(p);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(principal());
