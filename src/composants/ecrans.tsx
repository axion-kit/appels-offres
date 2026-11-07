import Link from "next/link";
import { DOCUMENTS } from "@/lib/comptes/documents";
import type { ContexteEspace } from "@/lib/comptes/env";
import { Champ } from "./coque";
import { FormulaireUnique } from "./formulaire-unique";

const Envoyer = ({ texte }: { texte: string }) => (
  <button type="submit" className="bouton">
    {texte}
  </button>
);

export function FormulaireConnexion() {
  return (
    <>
      <h1>Connexion</h1>
      <FormulaireUnique action="/api/connexion">
        <Champ nom="email" libelle="Adresse e-mail" type="email" autoComplete="email" />
        <Champ nom="mot_de_passe" libelle="Mot de passe" type="password" autoComplete="current-password" />
        <Envoyer texte="Me connecter" />
      </FormulaireUnique>
      <p className="lien-aide">
        <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
      </p>
      <h2>Sans mot de passe</h2>
      <p>Recevez un lien de connexion par e-mail.</p>
      <FormulaireUnique action="/api/lien-magique">
        <Champ nom="email" libelle="Adresse e-mail" type="email" autoComplete="email" />
        <Envoyer texte="Recevoir mon lien" />
      </FormulaireUnique>
    </>
  );
}

export function FormulaireInscription({ jeton }: { jeton: string }) {
  return (
    <>
      <h1>Créer un compte</h1>
      <p>Quelques informations suffisent. Votre espace est créé tout de suite.</p>
      <FormulaireUnique action="/api/inscription">
        <Champ nom="email" libelle="Adresse e-mail" type="email" autoComplete="email" />
        <Champ nom="mot_de_passe" libelle="Mot de passe" type="password" autoComplete="new-password" minLength={12} aide="12 caractères au minimum." />
        <Champ nom="nom_entreprise" libelle="Nom de votre entreprise" autoComplete="organization" />
        <div className="piege" aria-hidden="true">
          <label htmlFor="site_web">Ne pas remplir</label>
          <input id="site_web" name="site_web" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>
        <input type="hidden" name="ouvert_le" value={jeton} />
        <div className="case">
          <input id="accepte" name="accepte" type="checkbox" value="oui" required />
          <label htmlFor="accepte">
            J&apos;accepte les <Link href={DOCUMENTS.cgu.lien}>{DOCUMENTS.cgu.titre}</Link> et la{" "}
            <Link href={DOCUMENTS.confidentialite.lien}>{DOCUMENTS.confidentialite.titre}</Link>.
          </label>
        </div>
        <Envoyer texte="Créer mon compte" />
      </FormulaireUnique>
      <p className="lien-aide">
        Déjà un compte ? <Link href="/connexion">Se connecter</Link>
      </p>
    </>
  );
}

export function InscriptionNonOuverte() {
  return (
    <>
      <h1>Créer un compte</h1>
      <p>Les inscriptions ne sont pas ouvertes. Contactez-nous pour obtenir un accès, ou demandez une invitation.</p>
      <p className="lien-aide">
        Déjà un compte ? <Link href="/connexion">Se connecter</Link>
      </p>
    </>
  );
}

export function EcranVerification({ code }: { code: string | undefined }) {
  const confirme = code === "adresse_confirmee";
  if (code === "lien_expire") {
    return (
      <>
        <h1>Lien expiré</h1>
        <Link href="/inscription" className="bouton">
          M&apos;inscrire à nouveau
        </Link>
      </>
    );
  }
  return (
    <>
      <h1>{confirme ? "Adresse confirmée" : "Vérifiez votre boîte e-mail"}</h1>
      <p>
        {confirme
          ? "Merci, c'est fait. Pour votre sécurité, le mot de passe saisi à l'inscription a été retiré : choisissez-en un nouveau avec « Mot de passe oublié », puis connectez-vous."
          : "Nous venons de vous envoyer un message. Ouvrez-le et appuyez sur le lien pour confirmer votre adresse. Sans cela, l'accès reste fermé."}
      </p>
      <Link href={confirme ? "/mot-de-passe-oublie" : "/connexion"} className="bouton">
        {confirme ? "Choisir mon mot de passe" : "Aller à la connexion"}
      </Link>
    </>
  );
}

export function FormulaireInvitation({ code, apercu }: { code: string; apercu: { email: string; nomEspace: string | null } }) {
  return (
    <>
      <h1>Votre invitation</h1>
      <p>
        {apercu.nomEspace === null ? "Créez votre compte" : `Créez votre compte pour rejoindre « ${apercu.nomEspace} »`} avec l&apos;adresse <strong>{apercu.email}</strong>.
      </p>
      <FormulaireUnique action={`/api/invitation/${encodeURIComponent(code)}`}>
        <Champ nom="nom" libelle="Votre nom" autoComplete="name" />
        {apercu.nomEspace === null ? <Champ nom="nom_entreprise" libelle="Nom de votre entreprise" autoComplete="organization" /> : null}
        <Champ nom="mot_de_passe" libelle="Mot de passe" type="password" autoComplete="new-password" minLength={12} aide="12 caractères au minimum." />
        <div className="case">
          <input id="accepte" name="accepte" type="checkbox" value="oui" required />
          <label htmlFor="accepte">
            J&apos;accepte les <Link href={DOCUMENTS.cgu.lien}>{DOCUMENTS.cgu.titre}</Link> et la{" "}
            <Link href={DOCUMENTS.confidentialite.lien}>{DOCUMENTS.confidentialite.titre}</Link>.
          </label>
        </div>
        <Envoyer texte="Créer mon compte" />
      </FormulaireUnique>
    </>
  );
}

export function InvitationInvalide() {
  return (
    <>
      <h1>Invitation</h1>
      <p>Ce lien n&apos;est plus valable : il a déjà servi ou il a expiré. Demandez une nouvelle invitation à la personne qui vous l&apos;a envoyée.</p>
      <Link href="/connexion" className="bouton">
        Aller à la connexion
      </Link>
    </>
  );
}

export function FormulaireMotDePasseOublie({ lien }: { lien: string | undefined }) {
  if (lien !== undefined && lien !== "") {
    return (
      <>
        <h1>Nouveau mot de passe</h1>
        <FormulaireUnique action="/api/nouveau-mot-de-passe">
          <input type="hidden" name="lien" value={lien} />
          <Champ nom="mot_de_passe" libelle="Nouveau mot de passe" type="password" autoComplete="new-password" minLength={12} aide="12 caractères au minimum." />
          <Envoyer texte="Enregistrer" />
        </FormulaireUnique>
      </>
    );
  }
  return (
    <>
      <h1>Mot de passe oublié</h1>
      <p>Indiquez votre adresse : nous vous envoyons un lien pour en choisir un nouveau.</p>
      <FormulaireUnique action="/api/mot-de-passe-oublie">
        <Champ nom="email" libelle="Adresse e-mail" type="email" autoComplete="email" />
        <Envoyer texte="Recevoir le lien" />
      </FormulaireUnique>
      <p className="lien-aide">
        <Link href="/connexion">Retour à la connexion</Link>
      </p>
    </>
  );
}

export function EssaiTermine() {
  return (
    <>
      <h1>Votre essai est terminé</h1>
      <p>Votre essai est terminé, contactez-nous pour continuer à utiliser l&apos;outil. Vos informations sont conservées.</p>
    </>
  );
}

type Membre = { id: string; email: string; nom: string; role: string };
type Attente = { id: string; email: string };

export function PageCompte(props: {
  ctx: ContexteEspace;
  membres: Membre[];
  attente: Attente[];
  essaiTermine: boolean;
  modeInscription: "fermee" | "sur_invitation" | "libre";
}) {
  const { ctx, membres, attente, essaiTermine, modeInscription } = props;
  const proprietaire = ctx.role === "proprietaire";
  const peutInviter = proprietaire && modeInscription !== "fermee";
  return (
    <>
      <h1>Mon compte</h1>
      <p>
        {ctx.nom}, vous êtes {proprietaire ? "propriétaire" : "membre"} de l&apos;espace « {ctx.nomEspace} ».
      </p>
      {essaiTermine ? <EssaiTermine /> : ctx.essaiJusquAu === null ? null : <p>Essai offert jusqu&apos;au {ctx.essaiJusquAu.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}.</p>}

      <h2>Les personnes de l&apos;espace</h2>
      <ul className="liste">
        {membres.map((m) => (
          <li key={m.id}>
            <span>
              {m.nom} ({m.email}) : {m.role === "proprietaire" ? "propriétaire" : "membre"}
            </span>
            {proprietaire && m.email !== ctx.email ? (
              <FormulaireUnique action="/api/compte/role">
                <input type="hidden" name="membre" value={m.id} />
                <input type="hidden" name="role" value={m.role === "proprietaire" ? "membre" : "proprietaire"} />
                <button type="submit" className="bouton-discret">
                  {m.role === "proprietaire" ? "Rendre membre" : "Rendre propriétaire"}
                </button>
              </FormulaireUnique>
            ) : null}
          </li>
        ))}
      </ul>

      {peutInviter ? (
        <>
          <h2>Inviter un collègue</h2>
          <FormulaireUnique action="/api/compte/inviter">
            <Champ nom="email" libelle="Adresse e-mail du collègue" type="email" autoComplete="off" />
            <Envoyer texte="Envoyer l'invitation" />
          </FormulaireUnique>
          {attente.length > 0 ? (
            <>
              <p>Invitations en attente : {attente.map((a) => a.email).join(", ")}.</p>
              <FormulaireUnique action="/api/compte/revoquer">
                <button type="submit" className="bouton-discret">
                  Annuler ces invitations
                </button>
              </FormulaireUnique>
            </>
          ) : null}
        </>
      ) : null}

      {ctx.administrateur ? (
        <>
          <h2>Administration</h2>
          {modeInscription === "fermee" ? (
            <FormulaireUnique action="/api/administration/creer">
              <Champ nom="email" libelle="Adresse e-mail de la personne" type="email" autoComplete="off" />
              <Champ nom="nom_entreprise" libelle="Nom de l'entreprise" />
              <Envoyer texte="Créer le compte" />
            </FormulaireUnique>
          ) : (
            <FormulaireUnique action="/api/administration/inviter">
              <Champ nom="email" libelle="Adresse e-mail à inviter (nouvelle entreprise)" type="email" autoComplete="off" />
              <Envoyer texte="Envoyer l'invitation" />
            </FormulaireUnique>
          )}
        </>
      ) : null}

      <h2>Mes données</h2>
      <p>
        <a href="/api/compte/export" className="bouton-discret" download>
          Télécharger mes données
        </a>
      </p>
      <h2>Fermer mon compte</h2>
      <p>Votre compte sera désactivé et nous serons prévenus. Rien n&apos;est effacé automatiquement.</p>
      <FormulaireUnique action="/api/compte/fermer">
        <Champ nom="confirmation" libelle="Pour confirmer, écrivez votre adresse e-mail" type="email" autoComplete="off" />
        <button type="submit" className="bouton-danger">
          Fermer mon compte
        </button>
      </FormulaireUnique>
    </>
  );
}

export function TexteLegal({ titre, version }: { titre: string; version: string }) {
  return (
    <>
      <h1>{titre}</h1>
      <p>Version du {version}.</p>
      <p>Ce texte est fourni par l&apos;éditeur de l&apos;outil. Pour toute question, contactez-nous.</p>
    </>
  );
}
