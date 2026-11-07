const formateur = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "numeric",
  hourCycle: "h23",
});

/** Heure (0 à 23) à Paris, quel que soit le fuseau du serveur. */
export function heureParis(date: Date): number {
  const part = formateur.formatToParts(date).find((p) => p.type === "hour");
  return Number(part?.value);
}
