// Contrôle d'avant mise en service : aucun document rempli ne doit garder de trou.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DOCUMENTS_REQUIS = [
  "01-fiche-produit.md",
  "02-devis.md",
  "03-cgv-cgu.md",
  "04-mentions-legales.md",
  "05-confidentialite-registre.md",
  "06-contrat-sous-traitance.md",
  "07-accueil-client.md",
  "08-export-sortie.md",
  "09-suspension.md",
  "10-conservation.md",
  "formulaire-mise-en-service.md",
];

// Un trou : « [À REMPLIR… » même sans crochet fermant, ou case « - [ ] » non cochée.
const TROU = /\[\s*[ÀA]\s+REMPLIR\b/gi;
const CASE_VIDE = /^\s*(?:[-*+]|\d+\.)\s+\[\s\]/;
const MARQUE_PRO = /\[\s*À FAIRE RELIRE PAR UN PROFESSIONNEL\s*\]/gi;
const MENTION_MODELE = /modèle à faire relire par un professionnel/gi;
// Jamais d'exonération de TVA écrite : la TVA est toujours facturée.
// « 293 B » et « franchise en base » partout ; « non applicable » et « exonér… » seulement sur une ligne
// qui parle de TVA (sinon « rétractation non applicable » ou « exonéré en cas de force majeure » seraient refusés).
const EXONERATION_PARTOUT = /293\s*B|franchise en base/i;
const EXONERATION_TVA = /non applicable|exon[ée]r/i;
const TVA = /\bT\.?V\.?A\b|taxe sur la valeur ajoutée/i;
const EXONERATION = {
  test: (ligne: string) => EXONERATION_PARTOUT.test(ligne) || (TVA.test(ligne) && EXONERATION_TVA.test(ligne)),
};

/** Analyse un texte : lignes (1..n) des trous restants et nombre de marques de relecture. */
export function analyserTexte(texte: string): {
  trous: number[];
  marques: number;
  exonerations: number[];
} {
  const trous: number[] = [];
  const exonerations: number[] = [];
  let marques = 0;
  texte.split("\n").forEach((ligne, i) => {
    trous.push(...Array.from(ligne.matchAll(TROU), () => i + 1));
    if (CASE_VIDE.test(ligne)) trous.push(i + 1);
    marques += Array.from(ligne.matchAll(MARQUE_PRO)).length;
    marques += Array.from(ligne.matchAll(MENTION_MODELE)).length;
    if (EXONERATION.test(ligne)) exonerations.push(i + 1);
  });
  return { trous, marques, exonerations };
}

/** Vérifie un dossier de documents remplis. Renvoie { ok, problemes, avertissements }. */
export function verifierDossier(
  dossier: string,
  { strictPro = false }: { strictPro?: boolean } = {},
): { ok: boolean; problemes: string[]; avertissements: string[] } {
  const problemes: string[] = [];
  const avertissements: string[] = [];
  if (!existsSync(dossier)) {
    return { ok: false, problemes: [`Dossier introuvable : ${dossier}`], avertissements };
  }
  const presents = new Set(readdirSync(dossier));
  for (const nom of DOCUMENTS_REQUIS) {
    // Le préfixe « vente- » est accepté : vente-01-fiche-produit.md ou 01-fiche-produit.md.
    const fichier = presents.has(nom) ? nom : `vente-${nom}`;
    if (!presents.has(fichier)) {
      problemes.push(`${nom} : document manquant`);
      continue;
    }
    const { trous, marques, exonerations } = analyserTexte(readFileSync(join(dossier, fichier), "utf8"));
    if (exonerations.length > 0) {
      problemes.push(`${nom} : exonération de TVA écrite (lignes ${exonerations.join(", ")}) ; la TVA est toujours facturée`);
    }
    if (trous.length > 0) {
      problemes.push(`${nom} : ${trous.length} trou(s) à remplir (lignes ${trous.join(", ")})`);
    }
    if (marques > 0) {
      const msg = `${nom} : ${marques} partie(s) encore marquée(s) « à faire relire par un professionnel »`;
      (strictPro ? problemes : avertissements).push(msg);
    }
  }
  return { ok: problemes.length === 0, problemes, avertissements };
}

/** Commande en ligne : renvoie le code de sortie et les messages (testable sans sous-processus). */
export function lancer(args: string[]): { code: number; infos: string[]; erreurs: string[] } {
  const strictPro = args.includes("--relecture-obligatoire");
  const dossier = resolve(args.find((a) => !a.startsWith("--")) ?? "vente/remplis");
  const r = verifierDossier(dossier, { strictPro });
  const infos = r.avertissements.map((m) => `Attention : ${m}`);
  if (r.ok) {
    infos.push("Vente : aucun trou. Les documents sont prêts pour la mise en service.");
    return { code: 0, infos, erreurs: [] };
  }
  const erreurs = r.problemes.map((m) => `À corriger : ${m}`);
  erreurs.push("Mise en service refusée tant que ce n'est pas corrigé.");
  return { code: 1, infos, erreurs };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = lancer(process.argv.slice(2));
  r.infos.forEach((m) => console.warn(m));
  r.erreurs.forEach((m) => console.error(m));
  process.exit(r.code);
}
