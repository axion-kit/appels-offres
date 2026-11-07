import { z } from "zod";

export const LONGUEUR_MIN_MOT_DE_PASSE = 12;
export const LONGUEUR_MAX_MOT_DE_PASSE = 128;

// Adresse : espaces retirés, accents composés, minuscules (« Ana@Mail.FR  » = « ana@mail.fr »).
export function normaliserEmail(valeur: string): string {
  return valeur.normalize("NFC").trim().toLowerCase();
}

export function normaliserTexte(valeur: string): string {
  return valeur.normalize("NFC").replace(/\s+/g, " ").trim();
}

const sansCaracteresDeControle = (texte: string) => !/[\p{Cc}\p{Cf}]/u.test(texte);

export const emailSchema = z
  .string()
  .max(254)
  .transform(normaliserEmail)
  .pipe(z.string().email());

export const motDePasseSchema = z
  .string()
  .refine((m) => [...m].length >= LONGUEUR_MIN_MOT_DE_PASSE, "trop_court")
  .refine((m) => m.length <= LONGUEUR_MAX_MOT_DE_PASSE, "trop_long");

export const nomSchema = z
  .string()
  .transform(normaliserTexte)
  .pipe(z.string().min(2).max(100).refine(sansCaracteresDeControle));

export const inscriptionSchema = z.object({
  email: emailSchema,
  motDePasse: motDePasseSchema,
  nomEntreprise: nomSchema,
  accepte: z.literal(true),
});

export const acceptationInvitationSchema = z.object({
  nom: nomSchema,
  motDePasse: motDePasseSchema,
  nomEntreprise: nomSchema.optional(),
});

export type Inscription = z.infer<typeof inscriptionSchema>;

// Lit une case à cocher ou un champ texte de formulaire HTML.
export function texteDuFormulaire(donnees: FormData, nom: string): string {
  const valeur = donnees.get(nom);
  return typeof valeur === "string" ? valeur : "";
}
