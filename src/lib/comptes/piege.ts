import { createHmac, timingSafeEqual } from "node:crypto";

export const DELAI_MIN_MS = 3000;
export const DELAI_MAX_MS = 2 * 60 * 60 * 1000;

function signer(secret: string, horodatage: number): string {
  return createHmac("sha256", secret).update(`ouverture:${horodatage}`).digest("hex");
}

// Valeur cachée mise dans le formulaire : l'heure d'ouverture, signée par le serveur.
export function creerJetonOuverture(secret: string, maintenant: Date): string {
  const horodatage = maintenant.getTime();
  return `${horodatage}.${signer(secret, horodatage)}`;
}

export type VerdictRobot = "ok" | "robot" | "trop_vite";

export function jugerRobot(
  secret: string,
  maintenant: Date,
  entree: { piege: string; jeton: string },
  delaiMinMs: number = DELAI_MIN_MS,
): VerdictRobot {
  if (entree.piege !== "") return "robot";
  const [brut, signature = ""] = entree.jeton.split(".");
  const horodatage = Number(brut);
  if (!Number.isSafeInteger(horodatage)) return "robot";
  const attendue = Buffer.from(signer(secret, horodatage));
  const recue = Buffer.from(signature);
  if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue)) return "robot";
  const ecoule = maintenant.getTime() - horodatage;
  if (ecoule > DELAI_MAX_MS || ecoule < 0) return "robot";
  return ecoule < delaiMinMs ? "trop_vite" : "ok";
}
