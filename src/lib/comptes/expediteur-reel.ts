import type { Expediteur } from "./expediteur";

// À remplacer par le service d'envoi de l'outil (la clé reste dans l'environnement).
// Tant que c'est vide, une base réelle refuse de démarrer : les liens ne doivent jamais finir dans un journal.
export const expediteurReel: Expediteur | null = null;
