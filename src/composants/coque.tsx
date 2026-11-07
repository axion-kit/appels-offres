import Link from "next/link";
import type { ReactNode } from "react";
import { texteMessage } from "@/lib/comptes/messages";

export type LienMenu = { href: string; texte: string };

// La coque du gabarit : barre foncée (en haut sur téléphone, à gauche sur grand écran), accent orange.
export function Coque({ actif, liens, children, deconnexion = false }: { actif: string; liens: LienMenu[]; children: ReactNode; deconnexion?: boolean }) {
  return (
    <div className="hote">
    <div className="coque">
      <nav className="barre" aria-label="Menu principal">
        <p className="marque">Mon outil</p>
        <ul>
          {liens.map((lien) => (
            <li key={lien.href}>
              <Link href={lien.href} className="nav-lien" aria-current={lien.href === actif ? "page" : undefined}>
                {lien.texte}
              </Link>
            </li>
          ))}
          {deconnexion ? (
            <li>
              <form method="post" action="/api/deconnexion">
                <button type="submit" className="lien-barre">
                  Se déconnecter
                </button>
              </form>
            </li>
          ) : null}
        </ul>
      </nav>
      <main className="contenu">{children}</main>
    </div>
    </div>
  );
}

export function Message({ code }: { code: string | undefined }) {
  const texte = texteMessage(code);
  return texte === null ? null : (
    <p className="message" role="status">
      {texte}
    </p>
  );
}

export function Champ(props: { nom: string; libelle: string; type?: string; autoComplete?: string; aide?: string; minLength?: number; defaut?: string }) {
  const { nom, libelle, type = "text", autoComplete, aide, minLength, defaut } = props;
  return (
    <div className="champ">
      <label htmlFor={nom}>{libelle}</label>
      <input
        id={nom}
        name={nom}
        type={type}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        defaultValue={defaut}
        autoCapitalize="none"
        spellCheck={false}
        aria-describedby={aide === undefined ? undefined : `${nom}-aide`}
      />
      {aide === undefined ? null : (
        <p className="aide" id={`${nom}-aide`}>
          {aide}
        </p>
      )}
    </div>
  );
}

export const LIENS_PUBLICS = (inscriptionLibre: boolean): LienMenu[] => [
  { href: "/connexion", texte: "Connexion" },
  ...(inscriptionLibre ? [{ href: "/inscription", texte: "Créer un compte" }] : []),
];

export const LIENS_CONNECTES: LienMenu[] = [
  { href: "/", texte: "Accueil" },
  { href: "/compte", texte: "Mon compte" },
];
