export type CodeIa =
  | "cle-absente"
  | "navigateur"
  | "plafond-absent"
  | "plafond-depasse"
  | "modele-interdit"
  | "service-occupe"
  | "service-injoignable"
  | "demande-invalide"
  | "refus-service"
  | "reponse-illisible"
  | "sortie-invalide";

/** Erreur de la couche IA : `message` est en français simple, sans mot technique. */
export class IaErreur extends Error {
  readonly code: CodeIa;
  /** Détail pour les développeurs : ne jamais l'afficher à l'utilisateur. */
  readonly detail?: string;
  constructor(code: CodeIa, message: string, detail?: string) {
    super(message);
    this.detail = detail;
    this.name = "IaErreur";
    this.code = code;
  }
}
