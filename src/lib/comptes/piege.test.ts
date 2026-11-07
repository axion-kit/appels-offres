import { describe, expect, it } from "vitest";
import { creerJetonOuverture, jugerRobot } from "./piege";

const secret = "s".repeat(40);
const t0 = new Date("2026-11-07T10:00:00Z");
const plus = (ms: number) => new Date(t0.getTime() + ms);

describe("protection contre les robots", () => {
  const jeton = creerJetonOuverture(secret, t0);
  it("laisse passer une personne qui a pris son temps", () => {
    expect(jugerRobot(secret, plus(5000), { piege: "", jeton })).toBe("ok");
  });
  it("un champ piège rempli = robot", () => {
    expect(jugerRobot(secret, plus(5000), { piege: "http://spam", jeton })).toBe("robot");
  });
  it("un envoi trop rapide est signalé", () => {
    expect(jugerRobot(secret, plus(500), { piege: "", jeton })).toBe("trop_vite");
  });
  it("une heure falsifiée, absente ou signée avec une autre clé = robot", () => {
    expect(jugerRobot(secret, plus(5000), { piege: "", jeton: `${t0.getTime() - 99999}.${jeton.split(".")[1]}` })).toBe("robot");
    expect(jugerRobot(secret, plus(5000), { piege: "", jeton: "" })).toBe("robot");
    expect(jugerRobot(secret, plus(5000), { piege: "", jeton: "abc.def" })).toBe("robot");
    expect(jugerRobot(secret, plus(5000), { piege: "", jeton: `${t0.getTime()}.court` })).toBe("robot");
    expect(jugerRobot("autre".repeat(10), plus(5000), { piege: "", jeton })).toBe("robot");
  });
  it("un formulaire trop ancien ou venu du futur = robot", () => {
    expect(jugerRobot(secret, plus(3 * 60 * 60 * 1000), { piege: "", jeton })).toBe("robot");
    expect(jugerRobot(secret, new Date(t0.getTime() - 1000), { piege: "", jeton })).toBe("robot");
  });
});
