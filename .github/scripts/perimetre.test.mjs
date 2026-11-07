import assert from "node:assert/strict";
import { test } from "node:test";
import { calculerPretes, pairesEnConflit } from "./pretes.mjs";
import { controlerFiches } from "./lint-fiches.mjs";
import { estAutorise, lireFiche, motifInterdit } from "./fiches.mjs";
import { compterLignes, lireLiens, lireNumstat, verifier } from "./perimetre.mjs";

const fiche = (extra = "") => `---
id: L01-T01
titre: Calcul
lot: 1
statut: a_faire
depend_de: []
fichiers_autorises: [src/lib/calcul.ts, src/lib/calcul.test.ts, src/app/**]
taille_max_lignes: 100
tests_requis: oui
sensible: non
exigences: [R1]
${extra}---
corps`;

const base = {
  branche: "lot-01/L01-T01",
  fichiers: [{ chemin: "src/lib/calcul.ts", lignes: 40 }],
  ficheTexte: () => fiche(),
  statutDe: () => "fait",
  journalExiste: () => true,
};

test("lireFiche lit les listes et les valeurs", () => {
  const f = lireFiche(fiche());
  assert.equal(f.id, "L01-T01");
  assert.deepEqual(f.depend_de, []);
  assert.equal(f.fichiers_autorises.length, 3);
  assert.equal(lireFiche("rien"), null);
});

test("estAutorise gère * et **", () => {
  assert.equal(estAutorise("src/app/a/b.tsx", ["src/app/**"]), true);
  assert.equal(estAutorise("src/lib/a/b.ts", ["src/lib/*.ts"]), false);
  assert.equal(estAutorise("src/lib/a.ts", ["src/lib/*.ts"]), true);
  assert.equal(estAutorise("srcXlib/a.ts", ["src.lib/a.ts"]), false);
});

test("lireNumstat additionne ajouts et suppressions, binaire pour une ligne", () => {
  const r = lireNumstat("3\t4\ta.ts\n-\t-\timg.png\n\n");
  assert.deepEqual(r, [
    { chemin: "a.ts", lignes: 7, binaire: false },
    { chemin: "img.png", lignes: 1, binaire: true },
  ]);
});

test("binaire hors de public/ refusé, même s'il compte une ligne", () => {
  const p = verifier({ ...base, fichiers: [{ chemin: "src/lib/calcul.ts", lignes: 1, binaire: true }] });
  assert.equal(p.length, 1);
  assert.match(p[0], /binaire refusé hors de public/);
});

test("binaire dans public/ : pas refusé comme binaire, mais la taille compte", () => {
  const f = fiche().replace("src/app/**]", "src/app/**, public/*.png]");
  const ok = verifier({ ...base, ficheTexte: () => f, fichiers: [{ chemin: "public/a.png", lignes: 3, binaire: true }] });
  assert.deepEqual(ok, []);
  const gros = verifier({ ...base, ficheTexte: () => f, fichiers: [{ chemin: "public/a.png", lignes: 500, binaire: true }] });
  assert.match(gros[0], /Trop gros/);
});

test("compterLignes : lignes réelles, avec ou sans retour final", () => {
  assert.equal(compterLignes(""), 0);
  assert.equal(compterLignes("a\nb\n"), 2);
  assert.equal(compterLignes("a\nb"), 2);
  assert.equal(compterLignes("a\0\nb\n"), 2);
});

test("lien symbolique parmi les fichiers de la PR refusé", () => {
  const p = verifier({ ...base, liens: ["src/lib/calcul.ts"] });
  assert.equal(p.length, 1);
  assert.match(p[0], /Lien symbolique refusé : src\/lib\/calcul\.ts/);
  assert.deepEqual(verifier({ ...base, liens: ["src/autre.ts"] }), []);
});

test("fiche ou journal en lien symbolique refusés même sans être listés", () => {
  const p = verifier({ ...base, liens: ["pilotage/fiches/L01-T01.md", "pilotage/journal/L01-T01.md"] });
  assert.equal(p.length, 2);
  assert.ok(p.every((x) => /Lien symbolique/.test(x)));
});

test("lireLiens ne garde que le mode 120000", () => {
  const sortie = "100644 abc 0\tsrc/a.ts\n120000 def 0\tsrc/lien.ts\n100755 aaa 0\tx.sh\n";
  assert.deepEqual(lireLiens(sortie), ["src/lien.ts"]);
});

test("zones de configuration racine : motifs refusés", () => {
  for (const x of ["vitest.config.ts", "next.config.ts", "playwright.config.ts", "eslint.config.mjs", "tsconfig.json", ".gitattributes", ".gitignore", "renovate.json", "*.json", "*.config.ts", "*.config.*", ".git*"]) {
    assert.equal(motifInterdit(x, "L01-T01"), true, x);
  }
});

test("branche qui n'est pas une fiche : rien à contrôler", () => {
  assert.deepEqual(verifier({ ...base, branche: "l13-methode" }), []);
});

test("fiche absente de la base : refusé", () => {
  assert.deepEqual(verifier({ ...base, ficheTexte: () => null }), ["fiche L01-T01 absente de la base"]);
});

test("branche lot- hors motif : refusée", () => {
  assert.match(verifier({ ...base, branche: "lot-1/L01-T01" })[0], /ne suit pas le motif/);
  assert.match(verifier({ ...base, branche: "lot-01/L01-T01-bis" })[0], /ne suit pas le motif/);
});

test("fiche élargie dans la PR : refusé", () => {
  const large = fiche().replace("src/app/**]", "src/app/**, src/autre/**]");
  const p = verifier({ ...base, fichePRTexte: () => large, fichiers: [{ chemin: "src/autre/x.ts", lignes: 1 }] });
  assert.ok(p.some((x) => /change l'en-tête/.test(x)));
  assert.ok(p.some((x) => /Fichier hors de la fiche/.test(x)));
  const gros = fiche().replace("taille_max_lignes: 100", "taille_max_lignes: 900");
  assert.match(verifier({ ...base, fichePRTexte: () => gros })[0], /taille_max_lignes/);
});

test("statut seul changé dans la PR : accepté", () => {
  const fait = fiche().replace("statut: a_faire", "statut: fait");
  assert.deepEqual(verifier({ ...base, fichePRTexte: () => fait }), []);
});

test("fiche supprimée ou illisible dans la PR : refusé", () => {
  assert.match(verifier({ ...base, fichePRTexte: () => null })[0], /absente ou illisible/);
  assert.match(verifier({ ...base, fichePRTexte: () => "rien" })[0], /absente ou illisible/);
});

test("motifs interdits : refusés dans la fiche de la base", () => {
  for (const x of [".github/workflows/ci.yml", ".github/**", ".claude/**", "eslint.config.mjs", "package.json", "pnpm-lock.yaml", "CLAUDE.md", "METHODE.md", "pilotage/fiches/**", "pilotage/fiches/L01-T02.md", "**", "*", "**/*.mjs", "**/CLAUDE.md"]) {
    const f = fiche().replace("src/app/**]", `src/app/**, ${x}]`);
    const p = verifier({ ...base, ficheTexte: () => f, fichePRTexte: () => f });
    assert.ok(p.some((l) => /Motif interdit/.test(l)), x);
  }
});

test("motifInterdit : motifs ordinaires permis, fiche propre permise", () => {
  for (const x of ["src/lib/**", "src/app/*.tsx", "e2e/a.test.ts", "pilotage/fiches/L01-T01.md"]) assert.equal(motifInterdit(x, "L01-T01"), false, x);
  assert.equal(motifInterdit("pilotage/fiches/L01-T01.md", "L01-T02"), true);
});

test("périmètre respecté, fiche et journal permis", () => {
  const fichiers = [
    { chemin: "src/lib/calcul.ts", lignes: 50 },
    { chemin: "pilotage/fiches/L01-T01.md", lignes: 2 },
    { chemin: "pilotage/journal/L01-T01.md", lignes: 8 },
  ];
  assert.deepEqual(verifier({ ...base, fichiers }), []);
});

test("fichier hors périmètre refusé", () => {
  const p = verifier({ ...base, fichiers: [{ chemin: "src/lib/autre.ts", lignes: 1 }] });
  assert.equal(p.length, 1);
  assert.match(p[0], /hors de la fiche/);
});

test("autre fiche refusée", () => {
  const p = verifier({ ...base, fichiers: [{ chemin: "pilotage/fiches/L01-T02.md", lignes: 1 }] });
  assert.equal(p.length, 1);
});

test("taille : la limite exacte passe, une ligne de plus est refusée", () => {
  const ok = verifier({ ...base, fichiers: [{ chemin: "src/lib/calcul.ts", lignes: 100 }] });
  assert.deepEqual(ok, []);
  const trop = verifier({ ...base, fichiers: [{ chemin: "src/lib/calcul.ts", lignes: 101 }] });
  assert.match(trop[0], /Trop gros : 101 lignes/);
});

test("taille maximale absente ou invalide refusée", () => {
  const sans = fiche().replace("taille_max_lignes: 100", "taille_max_lignes: abc");
  assert.match(verifier({ ...base, ficheTexte: () => sans })[0], /taille maximale/);
});

test("id et lot incohérents refusés", () => {
  const autre = fiche().replace("id: L01-T01", "id: L01-T09");
  assert.match(verifier({ ...base, ficheTexte: () => autre })[0], /annonce l'id/);
  assert.match(verifier({ ...base, branche: "lot-02/L01-T01" }).join("\n"), /numéro de lot/);
});

test("en-tête illisible refusé", () => {
  assert.match(verifier({ ...base, ficheTexte: () => "sans entête" })[0], /en-tête/);
});

test("statut fait sans journal refusé", () => {
  const f = fiche().replace("statut: a_faire", "statut: fait");
  const p = verifier({ ...base, ficheTexte: () => f, journalExiste: () => false });
  assert.match(p[0], /n'existe pas/);
});

test("statut fait avec une dépendance non faite refusé", () => {
  const f = fiche().replace("statut: a_faire", "statut: fait").replace("depend_de: []", "depend_de: [L01-T00, L01-T02]");
  const p = verifier({ ...base, ficheTexte: () => f, statutDe: (id) => (id === "L01-T00" ? "fait" : "a_faire") });
  assert.equal(p.length, 1);
  assert.match(p[0], /L01-T02/);
});

const jeu = {
  "L01-T01": { id: "L01-T01", titre: "a", statut: "fait", depend_de: [], fichiers_autorises: ["src/a.ts"], taille_max_lignes: "50", tests_requis: "non" },
  "L01-T02": { id: "L01-T02", titre: "b", statut: "a_faire", depend_de: ["L01-T01"], fichiers_autorises: ["src/b.ts"], taille_max_lignes: "50", tests_requis: "non" },
  "L01-T03": { id: "L01-T03", titre: "c", statut: "a_faire", depend_de: ["L01-T02"], fichiers_autorises: ["src/b.ts"], taille_max_lignes: "50", tests_requis: "non" },
  "L01-T04": { id: "L01-T04", titre: "d", statut: "a_faire", depend_de: ["L01-T01"], fichiers_autorises: ["src/d.ts"], taille_max_lignes: "50", tests_requis: "non" },
  "L01-T05": { id: "L01-T05", titre: "e", statut: "a_faire", depend_de: ["L01-T01"], fichiers_autorises: ["src/b.ts"], taille_max_lignes: "50", tests_requis: "non", bloque_par: "décision" },
};

test("pretes : triées par fiches débloquées, bloquées écartées", () => {
  const r = calculerPretes(jeu);
  assert.deepEqual(r.map((x) => [x.id, x.debloque]), [["L01-T02", 1], ["L01-T04", 0]]);
});

test("pretes : deux fiches sur le même fichier ne partent pas ensemble", () => {
  const f = { ...jeu, "L01-T04": { ...jeu["L01-T04"], fichiers_autorises: ["src/b.ts"] } };
  const c = pairesEnConflit(f, calculerPretes(f));
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].fichiers, ["src/b.ts"]);
});

test("pretes : motif large contre fichier précis = conflit", () => {
  const f = {
    ...jeu,
    "L01-T02": { ...jeu["L01-T02"], fichiers_autorises: ["src/lib/**"] },
    "L01-T04": { ...jeu["L01-T04"], fichiers_autorises: ["src/lib/a.ts"] },
  };
  assert.equal(pairesEnConflit(f, calculerPretes(f)).length, 1);
  const g = { ...f, "L01-T04": { ...f["L01-T04"], fichiers_autorises: ["src/autre/a.ts"] } };
  assert.equal(pairesEnConflit(g, calculerPretes(g)).length, 0);
  const h = { ...f, "L01-T02": { ...f["L01-T02"], fichiers_autorises: ["src/*.ts"] }, "L01-T04": { ...f["L01-T04"], fichiers_autorises: ["src/lib/**"] } };
  assert.equal(pairesEnConflit(h, calculerPretes(h)).length, 1);
});

test("lint : motif interdit refusé", () => {
  const f = { ...jeu, "L01-T04": { ...jeu["L01-T04"], fichiers_autorises: ["src/d.ts", ".github/**"] } };
  assert.match(controlerFiches(f)[0], /motif interdit/);
});

test("lint : jeu sain sans problème", () => {
  assert.deepEqual(controlerFiches(jeu), []);
});

test("lint : tests exigés sans fichier de test autorisé", () => {
  const f = { ...jeu, "L01-T04": { ...jeu["L01-T04"], tests_requis: "oui" } };
  assert.match(controlerFiches(f)[0], /aucun fichier de test/);
  const ok = { ...jeu, "L01-T04": { ...jeu["L01-T04"], tests_requis: "oui", fichiers_autorises: ["src/d.ts", "src/d.test.ts"] } };
  assert.deepEqual(controlerFiches(ok), []);
});

test("lint : dépendance inconnue, cycle, taille et statut invalides", () => {
  const f = {
    ...jeu,
    "L01-T02": { ...jeu["L01-T02"], depend_de: ["L01-T03", "L09-T09"], taille_max_lignes: "0", statut: "encours" },
  };
  const texte = controlerFiches(f).join("\n");
  assert.match(texte, /n'existe pas/);
  assert.match(texte, /cycle/);
  assert.match(texte, /entier positif/);
  assert.match(texte, /statut « encours » inconnu/);
});

test("lint : statut fait sans journal", () => {
  assert.match(controlerFiches(jeu, () => false)[0], /sans pilotage\/journal/);
});
