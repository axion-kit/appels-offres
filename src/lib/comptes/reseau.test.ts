import { describe, expect, it } from "vitest";
import { adresseIp, cheminLibrairieAutorise, deriverCle, origineValide } from "./reseau";

describe("réseau", () => {
  it("l'adresse IP n'est lue que derrière un relais de confiance, et c'est la dernière valeur", () => {
    const entetes = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });
    expect(adresseIp(entetes, true)).toBe("203.0.113.9");
    expect(adresseIp(entetes, false)).toBe("inconnue");
    expect(adresseIp(new Headers(), true)).toBe("inconnue");
  });
  it("une provenance différente ou absente est refusée", () => {
    const url = "https://outil.exemple.fr/";
    expect(origineValide(new Headers({ origin: "https://outil.exemple.fr" }), url)).toBe(true);
    expect(origineValide(new Headers({ origin: "https://autre.exemple.fr" }), url)).toBe(false);
    expect(origineValide(new Headers({ origin: "null" }), url)).toBe(false);
    expect(origineValide(new Headers(), url)).toBe(false);
  });
  it("seuls les liens reçus par courriel traversent vers la librairie", () => {
    expect(cheminLibrairieAutorise("GET", "/api/auth/verify-email")).toBe(true);
    expect(cheminLibrairieAutorise("GET", "/api/auth/magic-link/verify")).toBe(true);
    expect(cheminLibrairieAutorise("GET", "/api/auth/reset-password/abc_DEF-123")).toBe(true);
    for (const [methode, chemin] of [
      ["POST", "/api/auth/sign-up/email"],
      ["POST", "/api/auth/sign-in/email"],
      ["POST", "/api/auth/sign-in/magic-link"],
      ["POST", "/api/auth/request-password-reset"],
      ["POST", "/api/auth/change-password"],
      ["GET", "/api/auth/get-session"],
      ["GET", "/api/auth/reset-password/../x"],
      ["POST", "/api/auth/verify-email"],
    ] as const) {
      expect(cheminLibrairieAutorise(methode, chemin)).toBe(false);
    }
  });
  it("les clés dérivées diffèrent selon l'usage et le secret", () => {
    expect(deriverCle("a", "x")).not.toBe(deriverCle("a", "y"));
    expect(deriverCle("a", "x")).not.toBe(deriverCle("b", "x"));
  });
});
