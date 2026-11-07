import type { Bloc, Ecran } from "../design/ecrans";

function VueBloc({ bloc }: { bloc: Bloc }) {
  switch (bloc.type) {
    case "indicateurs":
      return (
        <ul className="indicateurs">
          {bloc.elements.map((e) => (
            <li className="carte" key={e.libelle}>
              <span className="indicateur-libelle">{e.libelle}</span>
              <strong className="indicateur-valeur">{e.valeur}</strong>
              {e.note ? <span className="indicateur-note">{e.note}</span> : null}
            </li>
          ))}
        </ul>
      );
    case "cartes":
      return (
        <section>
          <h2>{bloc.titre}</h2>
          <ul className="cartes">
            {bloc.elements.map((e) => (
              <li className="carte" key={e.titre}>
                <span className="carte-titre">{e.titre}</span>
                <span className="carte-detail">{e.detail}</span>
                {e.statut ? <span className={`statut statut-${e.statut.ton}`}>{e.statut.mot}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      );
    case "formulaire":
      return (
        <form className="formulaire">
          {bloc.champs.map((c, i) => (
            <label className="champ" key={c.libelle}>
              <span>{c.libelle}</span>
              <input
                type={c.saisie === "email" ? "email" : c.saisie === "tel" ? "tel" : "text"}
                inputMode={c.saisie === "nombre" ? "numeric" : c.saisie === "tel" ? "tel" : c.saisie === "email" ? "email" : "text"}
                placeholder={c.exemple}
                name={`champ-${i}`}
              />
            </label>
          ))}
          <button className="bouton" type="submit">
            {bloc.bouton}
          </button>
        </form>
      );
    case "texte":
      return <p>{bloc.texte}</p>;
    case "action":
      return (
        <span className="bouton">{bloc.bouton}</span>
      );
  }
}

/** Contenu d'un écran déclaré (à placer dans la coque). */
export function EcranVue({ ecran, titre }: { ecran: Ecran; titre?: string }) {
  return (
    <>
      <h1>{titre ?? ecran.titre}</h1>
      {ecran.blocs.map((b, i) => (
        <VueBloc bloc={b} key={i} />
      ))}
    </>
  );
}
