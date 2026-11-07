/**
 * Écrans déclarés de l'outil. La planche de maquettes et le contrôle de design
 * lisent cette liste. Données FICTIVES seulement (jamais de vrai nom ni de
 * vrai montant). Chaque outil remplace ce contenu par ses propres écrans.
 */

export type Bloc =
  | { type: "indicateurs"; elements: { libelle: string; valeur: string; note?: string }[] }
  | { type: "cartes"; titre: string; elements: { titre: string; detail: string; statut?: { mot: string; ton: "succes" | "alerte" | "erreur" } }[] }
  | { type: "formulaire"; champs: { libelle: string; exemple: string; saisie?: "texte" | "email" | "tel" | "nombre" }[]; bouton: string }
  | { type: "texte"; texte: string }
  | { type: "action"; bouton: string };

export type Ecran = {
  id: string;
  titre: string;
  /** Entrée du menu mise en avant (par défaut : le titre). */
  rubrique?: string;
  /** Ce que la personne doit pouvoir faire ici, en une phrase. */
  but: string;
  blocs: Bloc[];
};

export const nomOutil = "Mon outil";

/** « Voici ce que j'ai compris » : la page de synthèse en tête de planche. */
export const synthese = {
  objectif: "Suivre ses éléments et ne rien oublier de ce qui est à faire cette semaine.",
  pour: "Une personne seule ou une petite équipe, surtout sur téléphone.",
  horsSujet: ["Facturation", "Envoi automatique de messages"],
  hypotheses: ["Un seul utilisateur au départ", "Les données restent en France"],
};

export const menu = ["Accueil", "Rubrique 1", "Rubrique 2"];

export const ecrans: Ecran[] = [
  {
    id: "accueil",
    titre: "Accueil",
    but: "Voir en un coup d'œil ce qui demande mon attention.",
    blocs: [
      {
        type: "indicateurs",
        elements: [
          { libelle: "Éléments suivis", valeur: "24", note: "+3 ce mois-ci" },
          { libelle: "À rappeler", valeur: "5" },
          { libelle: "Total du mois", valeur: "-120,00 €", note: "à surveiller" },
        ],
      },
      {
        type: "cartes",
        titre: "À faire aujourd'hui",
        elements: [
          { titre: "Rappeler Élément-Au-Nom-Très-Long-Composé-De-Nombreux-Mots", detail: "Devis à confirmer", statut: { mot: "Urgent", ton: "erreur" } },
          { titre: "Envoyer le plan à Exemple A", detail: "Promis pour jeudi", statut: { mot: "Cette semaine", ton: "alerte" } },
          { titre: "Visite chez Exemple B", detail: "Terminée", statut: { mot: "Fait", ton: "succes" } },
        ],
      },
      { type: "action", bouton: "Ajouter un élément" },
    ],
  },
  {
    id: "liste",
    titre: "Rubrique 1",
    but: "Retrouver un élément et voir où j'en suis avec lui.",
    blocs: [
      {
        type: "cartes",
        titre: "Vos éléments",
        elements: [
          { titre: "Exemple A", detail: "Dernier échange : 3 novembre 2026", statut: { mot: "Actif", ton: "succes" } },
          { titre: "Exemple B", detail: "Dernier échange : 28 octobre 2026", statut: { mot: "À relancer", ton: "alerte" } },
          { titre: "Exemple C", detail: "Aucun échange pour l'instant" },
        ],
      },
      { type: "action", bouton: "Ajouter un élément" },
    ],
  },
  {
    id: "nouvel-element",
    titre: "Nouvel élément",
    rubrique: "Rubrique 1",
    but: "Ajouter un élément en moins d'une minute.",
    blocs: [
      {
        type: "formulaire",
        champs: [
          { libelle: "Nom", exemple: "Exemple A" },
          { libelle: "Adresse e-mail", exemple: "contact@exemple.fr", saisie: "email" },
          { libelle: "Téléphone", exemple: "01 23 45 67 89", saisie: "tel" },
        ],
        bouton: "Enregistrer",
      },
    ],
  },
  {
    id: "reglages",
    titre: "Rubrique 2",
    but: "Changer mon nom et la couleur de mon espace.",
    blocs: [
      { type: "texte", texte: "Vos changements sont enregistrés tout de suite." },
      {
        type: "formulaire",
        champs: [
          { libelle: "Votre nom", exemple: "Exemple D" },
          { libelle: "Nombre de rappels par semaine", exemple: "5", saisie: "nombre" },
        ],
        bouton: "Enregistrer",
      },
    ],
  },
];
