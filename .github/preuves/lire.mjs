// Preuves réseau des fiches L00 (geste 8 bis du démarrage) : lecture PUBLIQUE, sans compte, sans clé, sans dépendance.
// Lancé à la main seulement (workflow preuves-reseau.yml, workflow_dispatch). Usage : node .github/preuves/lire.mjs <boamp|ted|place|robots>
// Règles : au plus 5 requêtes par lancement, espacées d'1 s ; robots.txt lu avant toute page ; refus (403, 429, robots) = arrêt, aucun nouvel essai.
// Le résumé (public) ne contient que des adresses de points d'accès, des codes, des types, des nombres, des noms de champs, des durées et la date :
// JAMAIS le corps brut d'une réponse (il peut contenir des noms d'acheteurs, de villes ou de personnes).
import { appendFileSync } from "node:fs";

const AGENT = "axion-kit-appels-offres-preuves/1.0 (lecture publique, sans compte, au plus 5 requetes)";
const MAX_REQUETES = 5;
const PAUSE_MS = 1000;
const DELAI_MS = 15000;

// Adresses publiques du registre des sources (fiche L03-T39, lignes 1 à 5), rien d'autre.
const SOURCES = {
  boamp: { hote: "https://www.boamp.fr", pages: ["/", "/pages/donnees-ouvertes-et-api/"] },
  ted: { hote: "https://ted.europa.eu", pages: ["/fr/"], autres: [{ hote: "https://docs.ted.europa.eu", pages: ["/api/latest/search.html"] }] },
  place: { hote: "https://www.marches-publics.gouv.fr", pages: ["/entreprise"] },
};

const source = process.argv[2] ?? "";
if (!["boamp", "ted", "place", "robots"].includes(source)) {
  console.error("Source inconnue. Choix fermé : boamp, ted, place, robots.");
  process.exit(2);
}

const lignes = [];
let requetes = 0;
const pause = () => new Promise((r) => setTimeout(r, PAUSE_MS));

async function lire(adresse) {
  if (requetes >= MAX_REQUETES) return null;
  if (requetes > 0) await pause();
  requetes += 1;
  const debut = Date.now();
  try {
    const r = await fetch(adresse, { headers: { "User-Agent": AGENT, Accept: "*/*" }, redirect: "manual", signal: AbortSignal.timeout(DELAI_MS) });
    const texte = await r.text();
    return { code: r.status, type: (r.headers.get("content-type") ?? "absent").split(";")[0], octets: Buffer.byteLength(texte), texte, duree: Date.now() - debut };
  } catch (e) {
    return { code: 0, type: "aucun", octets: 0, texte: "", duree: Date.now() - debut, cause: e?.name === "TimeoutError" ? "délai dépassé" : "réseau injoignable" };
  }
}

// robots.txt : règles « Disallow » du groupe « User-agent: * » (lecture simple et prudente : un groupe illisible interdit tout).
function reglesRobots(texte) {
  const interdits = [];
  let groupeEtoile = false;
  for (const brute of texte.split(/\r?\n/)) {
    const ligne = brute.replace(/#.*/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(ligne);
    if (!m) continue;
    const cle = m[1].toLowerCase();
    if (cle === "user-agent") groupeEtoile = m[2].trim() === "*";
    else if (cle === "disallow" && groupeEtoile && m[2].trim() !== "") interdits.push(m[2].trim());
  }
  return interdits;
}
const permis = (chemin, interdits) => !interdits.some((p) => chemin.startsWith(p.replace(/\*.*$/, "")));

// Forme seulement : nombre d'éléments et noms de champs d'un JSON ; pour une page, aucun contenu.
function forme(rep) {
  if (!/json/.test(rep.type)) return { elements: "sans objet (page)", champs: "sans objet" };
  try {
    const d = JSON.parse(rep.texte);
    const liste = Array.isArray(d) ? d : (Object.values(d).find(Array.isArray) ?? []);
    const premier = liste.find((x) => x && typeof x === "object") ?? (Array.isArray(d) ? {} : d);
    return { elements: String(liste.length), champs: Object.keys(premier).slice(0, 40).join(", ") || "aucun" };
  } catch {
    return { elements: "illisible", champs: "illisible" };
  }
}

const refus = (code) => code === 401 || code === 403 || code === 429;
const date = () => new Date().toISOString();

async function lireHote(hote, pages) {
  const robots = await lire(`${hote}/robots.txt`);
  if (robots === null) return;
  lignes.push(`| ${hote}/robots.txt | ${robots.code} | ${robots.type} | ${robots.octets} octets | règles « Disallow » pour * : ${robots.code === 200 ? reglesRobots(robots.texte).length : "s.o."} | ${robots.duree} ms | ${date()} |`);
  if (refus(robots.code)) {
    lignes.push(`| ${hote} | NON PROUVÉ — refus de lecture automatique (${date()}, code ${robots.code}) | | | | | |`);
    return "refus";
  }
  if (robots.code !== 200 && robots.code !== 404) {
    lignes.push(`| ${hote} | NON PROUVÉ — robots.txt non lu (${date()}, code ${robots.code}${robots.cause ? `, ${robots.cause}` : ""}) : aucune page lue | | | | | |`);
    return "refus";
  }
  const interdits = robots.code === 200 ? reglesRobots(robots.texte) : [];
  for (const chemin of pages) {
    if (!permis(chemin, interdits)) {
      lignes.push(`| ${hote}${chemin} | NON PROUVÉ — refus de lecture automatique (${date()}, robots) | | | | | |`);
      continue;
    }
    const rep = await lire(`${hote}${chemin}`);
    if (rep === null) {
      lignes.push(`| ${hote}${chemin} | non lu : plafond de ${MAX_REQUETES} requêtes atteint | | | | | |`);
      continue;
    }
    if (refus(rep.code)) {
      lignes.push(`| ${hote}${chemin} | NON PROUVÉ — refus de lecture automatique (${date()}, code ${rep.code}) | | | | | |`);
      return "refus";
    }
    const f = forme(rep);
    lignes.push(`| ${hote}${chemin} | ${rep.code}${rep.cause ? ` (${rep.cause})` : ""} | ${rep.type} | ${rep.octets} octets ; éléments : ${f.elements} | champs : ${f.champs} | ${rep.duree} ms | ${date()} |`);
  }
}

if (source === "robots") {
  for (const s of Object.values(SOURCES)) if ((await lireHote(s.hote, [])) === "refus") break;
} else {
  const s = SOURCES[source];
  if ((await lireHote(s.hote, s.pages)) !== "refus") for (const a of s.autres ?? []) await lireHote(a.hote, a.pages);
}

const resume = [
  `## Preuve réseau : ${source}`,
  "",
  `Lecture publique, sans compte, ${requetes} requête(s) sur ${MAX_REQUETES} au plus, espacées d'1 s. Aucun corps de réponse n'est écrit ici.`,
  "",
  "| Adresse | Code | Type | Taille et éléments | Champs ou règles | Durée | Date |",
  "|---|---|---|---|---|---|---|",
  ...lignes,
  "",
].join("\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, resume);
console.log(resume);
