import { randomUUID } from "node:crypto";
import type { Base } from "./base";
import { journalAudit } from "./schema";

export type ActionAudit =
  | "inscription"
  | "verification_adresse"
  | "mot_de_passe_neutralise"
  | "connexion"
  | "invitation"
  | "invitation_acceptee"
  | "changement_role"
  | "export_donnees"
  | "fermeture"
  | "creation_par_administrateur";

type Ecriture = Pick<Base, "insert">;

export async function journaliser(
  base: Ecriture,
  entree: { action: ActionAudit; espaceId?: string | null; utilisateurId?: string | null; details?: string },
  maintenant: Date = new Date(),
): Promise<void> {
  await base.insert(journalAudit).values({
    id: randomUUID(),
    action: entree.action,
    espaceId: entree.espaceId ?? null,
    utilisateurId: entree.utilisateurId ?? null,
    details: entree.details ?? null,
    creeLe: maintenant,
  });
}
