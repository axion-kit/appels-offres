import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Accueil from "./page";

describe("page d'accueil", () => {
  afterEach(() => vi.useRealTimers());

  it("dit Bonjour en journée à Paris", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T10:00:00Z"));
    expect(renderToStaticMarkup(<Accueil />)).toContain("Bonjour !");
  });
  it("dit Bonsoir le soir à Paris, même si l'heure du serveur est différente", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T17:00:00Z"));
    expect(renderToStaticMarkup(<Accueil />)).toContain("Bonsoir !");
  });
  it("n'a aucun lien mort et des libellés neutres", () => {
    const html = renderToStaticMarkup(<Accueil />);
    expect(html).not.toContain('href="#"');
    expect(html).toContain("Rubrique 1");
    expect(html).toContain("Rubrique 2");
  });
});
