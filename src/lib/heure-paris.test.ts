import { describe, expect, it, vi } from "vitest";
import { heureParis } from "./heure-paris";

describe("heureParis", () => {
  it("donne l'heure de Paris en hiver (UTC+1)", () => {
    expect(heureParis(new Date("2026-01-15T10:30:00Z"))).toBe(11);
  });
  it("donne l'heure de Paris en été (UTC+2)", () => {
    expect(heureParis(new Date("2026-07-15T10:30:00Z"))).toBe(12);
  });
  it("passe bien minuit (0 et non 24)", () => {
    expect(heureParis(new Date("2026-01-15T23:10:00Z"))).toBe(0);
  });
  it("ne renvoie pas une heure inventée quand la partie heure manque", () => {
    const espion = vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts").mockReturnValue([]);
    expect(Number.isNaN(heureParis(new Date("2026-01-15T10:30:00Z")))).toBe(true);
    espion.mockRestore();
  });
});
