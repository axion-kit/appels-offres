import type { Courriel } from "./expediteur";

const SIGNATURE = "\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.";

export function messageVerification(a: string, lien: string): Courriel {
  return {
    a,
    sujet: "Confirmez votre adresse",
    texte: `Bonjour,\n\nPour finir votre inscription, confirmez votre adresse en ouvrant ce lien (valable 24 heures) :\n${lien}${SIGNATURE}`,
  };
}

export function messageLienMagique(a: string, lien: string): Courriel {
  return {
    a,
    sujet: "Votre lien de connexion",
    texte: `Bonjour,\n\nOuvrez ce lien pour vous connecter, sans mot de passe (valable 10 minutes, une seule fois) :\n${lien}${SIGNATURE}`,
  };
}

export function messageNouveauMotDePasse(a: string, lien: string): Courriel {
  return {
    a,
    sujet: "Choisir un nouveau mot de passe",
    texte: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${lien}${SIGNATURE}`,
  };
}

export function messageDejaInscrit(a: string, lienConnexion: string): Courriel {
  return {
    a,
    sujet: "Vous avez déjà un compte",
    texte: `Bonjour,\n\nQuelqu'un a demandé une inscription avec cette adresse, mais un compte existe déjà. Connectez-vous ici, ou choisissez un nouveau mot de passe si besoin :\n${lienConnexion}${SIGNATURE}`,
  };
}

export function messageInvitation(a: string, lien: string, nomEspace: string | null, jours: number): Courriel {
  const debut = nomEspace === null ? "Vous êtes invité à utiliser l'outil." : `Vous êtes invité à rejoindre « ${nomEspace} ».`;
  return {
    a,
    sujet: "Votre invitation",
    texte: `Bonjour,\n\n${debut}\nOuvrez ce lien pour créer votre compte (valable ${jours} jours, une seule fois) :\n${lien}${SIGNATURE}`,
  };
}

export function messageFermetureCompte(a: string, adressePersonne: string, nomEspace: string): Courriel {
  return {
    a,
    sujet: "Demande de fermeture de compte",
    texte: `Une personne a demandé la fermeture de son compte.\nAdresse : ${adressePersonne}\nEspace : ${nomEspace}\nLe compte est désactivé ; aucune donnée n'est effacée. À vous de traiter la suite.`,
  };
}

// Messages affichés à l'écran, repérés par un court code dans l'adresse de la page.
export const MESSAGES_ECRAN = {
  envoye: "Si l'adresse est valable, un message vient de vous être envoyé. Pensez à regarder dans vos courriers indésirables.",
  inscription_envoyee: "Merci ! Si l'adresse est valable, un message de confirmation vient de vous être envoyé. Ouvrez-le pour finir votre inscription.",
  trop_vite: "C'était un peu trop rapide. Patientez quelques secondes puis réessayez.",
  trop_de_demandes: "Trop de demandes pour le moment. Réessayez dans un moment.",
  formulaire_invalide: "Vérifiez les champs : adresse valable, mot de passe d'au moins 12 caractères, nom de l'entreprise, et cases à cocher.",
  inscription_fermee: "Les inscriptions ne sont pas ouvertes. Contactez-nous pour obtenir un accès.",
  identifiants_incorrects: "Adresse ou mot de passe incorrect.",
  adresse_a_verifier: "Votre adresse n'est pas encore confirmée. Nous venons de vous renvoyer un message pour la confirmer.",
  indisponible: "Le service est momentanément indisponible. Réessayez dans un instant.",
  mot_de_passe_change: "Votre mot de passe est changé. Vous pouvez vous connecter.",
  lien_invalide: "Ce lien n'est plus valable. Demandez-en un nouveau.",
  lien_expire: "Ce lien a expiré. Inscrivez-vous à nouveau.",
  compte_pret: "Votre compte est prêt. Connectez-vous.",
  adresse_confirmee: "Votre adresse est confirmée. Pour votre sécurité, choisissez maintenant votre mot de passe : sur la page de connexion, touchez « Mot de passe oublié ».",
  invitation_envoyee: "Si l'adresse est valable, l'invitation est partie.",
  role_change: "Le rôle est modifié.",
  role_refuse: "Cette modification n'est pas possible : il faut toujours au moins un propriétaire.",
  fermeture_confirmation: "Pour fermer le compte, écrivez votre adresse exactement comme elle est enregistrée.",
  fermeture_proprietaire: "Désignez d'abord un autre propriétaire avant de fermer votre compte.",
  compte_cree: "Le compte est créé. La personne reçoit un message pour choisir son accès.",
  non_autorise: "Cette action n'est pas permise.",
  origine_refusee: "La demande n'a pas pu être vérifiée. Rechargez la page et réessayez.",
} as const;

export type CodeMessage = keyof typeof MESSAGES_ECRAN;

export function texteMessage(code: string | undefined): string | null {
  if (code === undefined) return null;
  return Object.hasOwn(MESSAGES_ECRAN, code) ? MESSAGES_ECRAN[code as CodeMessage] : null;
}

// Code affiché sur « Vérifier mon adresse » : la librairie renvoie avec « error » quand le lien est refusé.
// Jeton périmé (24 h) ou compte déjà expiré : « lien expiré » ; toute autre erreur : « lien invalide ».
export function codeVerification(m: string | undefined, error: string | undefined): string | undefined {
  // La librairie envoie le code en majuscules (TOKEN_EXPIRED) ; on accepte les deux écritures.
  const erreur = error?.toLowerCase();
  if (erreur === "token_expired" || erreur === "user_not_found") return "lien_expire";
  return error !== undefined ? "lien_invalide" : m;
}
