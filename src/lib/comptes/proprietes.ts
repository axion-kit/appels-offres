import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const MODES_INSCRIPTION = ["fermee", "sur_invitation", "libre"] as const;
export type ModeInscription = (typeof MODES_INSCRIPTION)[number];
export type Proprietes = { inscription: ModeInscription; essaiJours: number };

const MODE_PAR_DEFAUT: ModeInscription = "sur_invitation";
const ESSAI_PAR_DEFAUT = 30;

const modeSchema = z.enum(MODES_INSCRIPTION);
const joursSchema = z.coerce.number().int().min(0).max(3650);

function lireLignes(texte: string): Map<string, string> {
  const valeurs = new Map<string, string>();
  for (const brute of texte.split(/\r?\n/)) {
    const ligne = brute.replace(/\s#.*$/, "").trim();
    if (ligne === "" || ligne.startsWith("#")) continue;
    const coupe = ligne.indexOf(":");
    if (coupe < 1) continue;
    const valeur = ligne.slice(coupe + 1).trim().replace(/^["']|["']$/g, "");
    valeurs.set(ligne.slice(0, coupe).trim(), valeur);
  }
  return valeurs;
}

// Une valeur d'inscription inconnue ferme les inscriptions (on préfère refuser que laisser ouvert).
export function lireProprietes(texte: string | null, surcharge?: string): Proprietes {
  const valeurs = texte === null ? new Map<string, string>() : lireLignes(texte);
  const brut = surcharge ?? valeurs.get("inscription");
  let inscription: ModeInscription = MODE_PAR_DEFAUT;
  if (brut !== undefined && brut !== "") {
    const lu = modeSchema.safeParse(brut);
    inscription = lu.success ? lu.data : "fermee";
  }
  const jours = joursSchema.safeParse(valeurs.get("essai_jours") ?? ESSAI_PAR_DEFAUT);
  return { inscription, essaiJours: jours.success ? jours.data : ESSAI_PAR_DEFAUT };
}

export function proprietesActuelles(): Proprietes {
  let texte: string | null = null;
  try {
    texte = readFileSync(join(process.cwd(), "proprietes.yaml"), "utf8");
  } catch {
    texte = null;
  }
  return lireProprietes(texte, process.env.COMPTES_INSCRIPTION);
}
