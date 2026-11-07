import type { Proprietes } from "./proprietes";
import type { Services } from "./services";

// Tout ce dont une règle a besoin : les services, l'heure (modifiable en test) et les réglages.
export type Env = Services & {
  maintenant: Date;
  proprietes: Proprietes;
  // Permet d'envoyer les courriels après la réponse, pour répondre aussi vite avec ou sans compte.
  apres: (travail: () => Promise<void>) => void | Promise<void>;
};

export type ContexteEspace = {
  utilisateurId: string;
  email: string;
  nom: string;
  espaceId: string;
  nomEspace: string;
  role: "proprietaire" | "membre";
  essaiJusquAu: Date | null;
  administrateur: boolean;
};

export function estViolationUnicite(erreur: unknown): boolean {
  let courante: unknown = erreur;
  for (let i = 0; i < 5 && courante !== null && typeof courante === "object"; i += 1) {
    if ("code" in courante && courante.code === "23505") return true;
    courante = "cause" in courante ? courante.cause : null;
  }
  return false;
}

export class RefusMetier extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
