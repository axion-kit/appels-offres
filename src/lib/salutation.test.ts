import { describe, expect, it } from "vitest";
import { salutation } from "./salutation";

describe("salutation", () => {
  it("dit Bonjour en journée", () => {
    expect(salutation(9)).toBe("Bonjour");
  });
  it("dit Bonsoir le soir et la nuit", () => {
    expect(salutation(20)).toBe("Bonsoir");
    expect(salutation(2)).toBe("Bonsoir");
  });
  it("reste poli avec une heure invalide", () => {
    expect(salutation(30)).toBe("Bonjour");
    expect(salutation(1.5)).toBe("Bonjour");
  });
});
