import { and, eq, isNull, lt, sql } from "drizzle-orm";
import type { Base } from "./base";
import { user } from "./schema";

export const DELAI_VERIFICATION_MS = 24 * 60 * 60 * 1000;

// Un compte auto-inscrit jamais vérifié après 24 h est DÉSACTIVÉ et marqué expiré, jamais effacé.
// Son adresse est libérée (gardée dans email_initial) : une nouvelle inscription de la même adresse repart proprement.
export async function expirerComptesNonVerifies(base: Pick<Base, "update">, maintenant: Date): Promise<void> {
  const limite = new Date(maintenant.getTime() - DELAI_VERIFICATION_MS);
  await base
    .update(user)
    .set({
      desactiveLe: maintenant,
      expireLe: maintenant,
      emailInitial: user.email,
      email: sql`'expire-' || ${user.id} || '@expire.invalid'`,
      updatedAt: maintenant,
    })
    .where(and(eq(user.autoInscrit, true), eq(user.emailVerified, false), isNull(user.expireLe), lt(user.createdAt, limite)));
}
