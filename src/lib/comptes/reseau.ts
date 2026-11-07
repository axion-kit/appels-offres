import { createHmac } from "node:crypto";

// Clés distinctes dérivées du secret principal (une par usage).
export function deriverCle(secret: string, usage: string): string {
  return createHmac("sha256", secret).update(`kit-comptes:${usage}`).digest("hex");
}

// Derrière un relais de confiance, on prend la DERNIÈRE adresse de la liste : c'est celle que le relais a ajoutée.
export function adresseIp(entetes: Headers, proxyFiable: boolean): string {
  if (!proxyFiable) return "inconnue";
  const liste = (entetes.get("x-forwarded-for") ?? "").split(",").map((v) => v.trim()).filter((v) => v !== "");
  return liste.at(-1) ?? "inconnue";
}

// Contrôle de provenance des formulaires : l'origine doit être exactement celle de l'outil.
export function origineValide(entetes: Headers, urlPublique: string): boolean {
  const origine = entetes.get("origin");
  if (origine === null || origine === "null") return false;
  return origine === new URL(urlPublique).origin;
}

const CHEMINS_AUTORISES: { methode: string; motif: RegExp }[] = [
  { methode: "GET", motif: /^\/api\/auth\/verify-email$/ },
  { methode: "GET", motif: /^\/api\/auth\/magic-link\/verify$/ },
  { methode: "GET", motif: /^\/api\/auth\/reset-password\/[A-Za-z0-9_-]+$/ },
];

// Seules ces adresses de la librairie sont ouvertes au public ; tout le reste passe par nos routes.
export function cheminLibrairieAutorise(methode: string, chemin: string): boolean {
  return CHEMINS_AUTORISES.some((c) => c.methode === methode && c.motif.test(chemin));
}
