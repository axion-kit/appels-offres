import { after } from "next/server";
import type { Env } from "./env";
import { proprietesActuelles } from "./proprietes";
import { obtenirServices } from "./services";

// Environnement d'une requête réelle : heure du jour, réglages relus, courriels envoyés après la réponse.
export async function fournirEnv(): Promise<Env> {
  const services = await obtenirServices();
  return {
    ...services,
    maintenant: new Date(),
    proprietes: proprietesActuelles(),
    apres: (travail) => {
      after(travail);
    },
  };
}
