/** Phrase d'accueil selon l'heure (0 à 23). */
export function salutation(heure: number): string {
  if (!Number.isInteger(heure) || heure < 0 || heure > 23) {
    return "Bonjour";
  }
  return heure >= 18 || heure < 5 ? "Bonsoir" : "Bonjour";
}
