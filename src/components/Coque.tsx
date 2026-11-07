import Link from "next/link";
import type { ReactNode } from "react";

export type CoqueProps = {
  nomOutil: string;
  menu: string[];
  actif?: string;
  children: ReactNode;
};

/**
 * Mise en page commune : barre foncée (en-tête et onglets sur téléphone, colonne à gauche sur grand écran).
 * Seule la rubrique courante est cliquable : les autres ne mènent encore nulle part.
 */
export function Coque({ nomOutil, menu, actif, children }: CoqueProps) {
  return (
    <div className="hote">
      <div className="coque">
        <header className="barre">
          <p className="marque">{nomOutil}</p>
          <nav aria-label="Menu principal">
            <ul>
              {menu.map((nom) => (
                <li key={nom}>
                  {nom === actif ? (
                    <Link className="nav-lien" href="/" aria-current="page">
                      {nom}
                    </Link>
                  ) : (
                    <span className="nav-lien nav-lien-inactif">{nom}</span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="contenu">{children}</main>
      </div>
    </div>
  );
}
