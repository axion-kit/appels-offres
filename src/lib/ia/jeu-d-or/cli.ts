import { readFileSync } from "node:fs";
import { exemple } from "./exemple";
import { lireJeu } from "./format";
import { lancerEval, type ModeEval } from "./executeur";

/** Code de sortie : 0 = au-dessus du seuil, 1 = sous le seuil ou erreur. */
export async function main(
  args: string[],
  env: Record<string, string | undefined>,
  ecrire: (ligne: string) => void = console.log,
): Promise<number> {
  if (args.length > 1) {
    ecrire("Un seul fichier à la fois : pnpm ia:eval <fichier-du-jeu.json>");
    return 1;
  }
  // Sans argument : le jeu d'exemple fourni (contrôle local du montage : la CI ne lance pas ia:eval, seuls les tests couvrent ce jeu).
  const chemin = args[0];
  try {
    const jeu = lireJeu(chemin === undefined ? exemple : JSON.parse(readFileSync(chemin, "utf8")));
    const mode: ModeEval = env.IA_EVAL_MODE === "reel" ? "reel" : "faux";
    const r = await lancerEval(jeu, mode, env);
    ecrire(`${jeu.nom} (${mode === "reel" ? "vraie IA" : "fausse IA"}) : ${r.reussis}/${r.total} réussis, taux ${(r.taux * 100).toFixed(0)} %, seuil ${(r.seuil * 100).toFixed(0)} %`);
    for (const e of r.echecs) ecrire(`  échec ${e.id} : ${e.raison}`);
    ecrire(r.ok ? "RÉUSSI" : "ÉCHEC : sous le seuil");
    return r.ok ? 0 : 1;
  } catch (e) {
    ecrire(`ÉCHEC : ${e instanceof Error ? e.message : "erreur inattendue"}`);
    return 1;
  }
}
