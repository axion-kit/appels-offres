/** Liste noire des mots techniques (plan, partie 13.2). Tout est comparé sans accents ni majuscules. */
export const LISTE_NOIRE = [
  "api", "webhook", "token", "api key", "integration api", "depot git", "vider le cache", "cache du serveur", "mettre en cache", "jeton", "oauth", "cle d'acces", "deployer", "deploiement",
  "mise en production", "release", "branche", "commit", "pull request", "serveur",
  "base de donnees", "requete", "exception", "stack trace", "prompt", "llm", "fichier log", "fichiers logs", "les logs", "des logs",
  "quota", "timeout", "latence", "csv", "json", "xlsx", "crm", "uuid", "localhost", "backend", "frontend",
  // mots anglais d'interface
  "dashboard", "settings", "submit", "loading", "approve", "login", "logout", "cancel", "undefined",
  "lorem", "ipsum", "john doe",
];

const MOTIFS: [RegExp, string][] = [
  [/erreur\s*\d{3}\b/, "erreur 500"],
  [/\{\{|\}\}/, "{{"],
  [/\bnull\b|\bnan\b/, "null"],
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/, "identifiant long"],
  [/(^|\s)(\/[\w.-]+){2,}/, "chemin de fichier"],
  [/\bat\s+\S+\s+\(.*:\d+:\d+\)/, "trace"],
];

/** Minuscules, sans accents, apostrophes droites. */
export function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/\p{M}/gu, "").replace(/[’‘]/g, "'").toLowerCase();
}

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Renvoie les mots ou motifs interdits trouvés dans un texte (liste vide = bon). */
export function motsInterdits(texte: string, liste: string[] = LISTE_NOIRE): string[] {
  const t = normaliser(texte);
  const trouves = new Set<string>();
  for (const mot of liste) {
    if (new RegExp(`(?<![a-z0-9])${echapper(mot)}(?![a-z0-9])`).test(t)) trouves.add(mot);
  }
  for (const [motif, nom] of MOTIFS) if (motif.test(t)) trouves.add(nom);
  return [...trouves];
}
