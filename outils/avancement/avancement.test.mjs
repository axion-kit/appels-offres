import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculer, chargerGithub, composer, depotEstPublic, echapper, estimer, etatControles, lireReprendre, lireSpec, parJour, pourcent, rendrePage,
} from "./lib.mjs";

const SPEC = `# SPEC
## 4. Exigences
### R1 : Voir la liste
- **Étant donné** x
- Version : mvp : raison
- État : fait
### R2 : Ajouter
- Version : mvp : raison
- **État** : en cours
### R3 : Exporter
- Version : v2 : confort
### R4 : Vérifié
- Version : mvp : raison
- État : recetté
## 5. Non fonctionnel
- État : fait
`;

test("lireSpec lit les exigences, la version et l'état", () => {
  const e = lireSpec(SPEC);
  assert.deepEqual(e.map((x) => [x.id, x.version, x.etat]), [[1, "mvp", "fait"], [2, "mvp", "en cours"], [3, "v2", "à faire"], [4, "mvp", "recetté"]]);
});

test("lireSpec ignore le gabarit vide et le texte absent", () => {
  assert.deepEqual(lireSpec("### R1 : (titre court)\n- Version : mvp | v2 | v3 : (raison)\n"), []);
  assert.deepEqual(lireSpec(""), []);
  assert.deepEqual(lireSpec(undefined), []);
});

test("un état inconnu compte comme à faire", () => {
  assert.equal(lireSpec("### R1 : a\n- État : bizarre\n")[0].etat, "à faire");
});

test("calculer : pourcentages, par version", () => {
  const c = calculer(lireSpec(SPEC));
  assert.equal(c.total, 4);
  assert.equal(c.faites, 2);
  assert.equal(c.recettees, 1);
  assert.equal(c.pourcentFait, 50);
  assert.equal(c.parVersion.mvp.total, 3);
  assert.equal(c.parVersion.mvp.pourcent, 66.7);
  assert.equal(c.parVersion.v3.total, 0);
});

test("pourcent ne divise pas par zéro", () => {
  assert.equal(pourcent(0, 0), 0);
  assert.equal(pourcent(1, 3), 33.3);
});

const REPRENDRE = `# REPRENDRE

ETAT: ATTENTE-WILL

**Objectif :** Suivre les stocks.

**Prochaine action :** Valider la maquette.
**Question pour le responsable :** Le bouton doit-il être orange ?

<!-- FIN DU BLOC DU HAUT (40 lignes au plus) -->
ETAT: FINI
`;

test("lireReprendre lit seulement le bloc du haut", () => {
  const r = lireReprendre(REPRENDRE);
  assert.equal(r.etat, "ATTENTE-WILL");
  assert.equal(r.objectif, "Suivre les stocks.");
  assert.equal(r.prochaineAction, "Valider la maquette.");
  assert.equal(r.question, "Le bouton doit-il être orange ?");
});

test("lireReprendre : gabarit, valeur inconnue, texte vide", () => {
  assert.equal(lireReprendre("ETAT: TRAVAIL\n**Objectif :** (une phrase)\n").objectif, "");
  assert.equal(lireReprendre("ETAT: BIZARRE\n").etat, "INCONNU");
  assert.equal(lireReprendre("").etat, "INCONNU");
});

test("echapper neutralise le HTML", () => {
  assert.equal(echapper("<script>alert('x')</script>"), "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
  assert.equal(echapper(null), "");
});

test("la page n'affiche jamais un script lu dans le dépôt", () => {
  const s = composer({
    outil: "<script>alert(1)</script>",
    spec: "### R1 : <img src=x onerror=alert(1)>\n- État : fait\n",
    reprendre: "ETAT: ATTENTE-WILL\n**Prochaine action :** <script>evil()</script>\n",
    github: { disponible: false },
    maintenant: new Date("2026-03-01T10:00:00Z"),
    depotPublic: true,
  });
  const html = rendrePage(s);
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;script&gt;evil()"));
});

test("dépôt vide : page et chiffres sans plantage", () => {
  const s = composer({ outil: "", spec: "", reprendre: "", github: { disponible: false } });
  const html = rendrePage(s);
  assert.equal(s.exigences.total, 0);
  assert.equal(s.etat, "INCONNU");
  assert.equal(s.attente, null);
  assert.ok(html.includes("indisponible"));
  assert.ok(html.includes("pas encore d'objectifs"));
});

test("bandeau d'attente avec la question, et bandeau de contrôles rouges", () => {
  const s = composer({
    outil: "t", spec: SPEC, reprendre: REPRENDRE,
    github: { disponible: true, ouvertes: 1, fusionnees: 2, jours: {}, ci: "rouge" },
    depotPublic: true,
  });
  const html = rendrePage(s);
  assert.equal(s.attente.question, "Le bouton doit-il être orange ?");
  assert.ok(html.includes("Le bouton doit-il être orange ?"));
  assert.ok(html.includes("contrôles automatiques sont rouges"));
  const calme = rendrePage(composer({ outil: "t", spec: SPEC, reprendre: "ETAT: TRAVAIL\n", github: { disponible: true, ouvertes: 0, fusionnees: 0, jours: {}, ci: "verte" } }));
  assert.ok(!calme.includes('role="alert"'));
});

test("la question retombe sur la prochaine action si elle manque", () => {
  const s = composer({ outil: "t", spec: "", reprendre: "ETAT: ATTENTE-WILL\n**Prochaine action :** Dire OK.\n", github: { disponible: false }, depotPublic: true });
  assert.equal(s.attente.question, "Dire OK.");
});

test("parJour regroupe à l'heure de Paris", () => {
  const j = parJour(["2026-03-01T23:30:00Z", "2026-03-02T05:00:00Z", "n'importe quoi"]);
  assert.deepEqual(j, { "2026-03-02": 2 });
});

test("estimer : trois cadences, ou pas de recul, ou terminé", () => {
  const maintenant = new Date("2026-03-10T12:00:00Z");
  const e = estimer({ resteAFaire: 10, faites: 10, fusionnees: 5, jours: { "2026-03-08": 1, "2026-03-09": 2, "2026-03-10": 3 }, maintenant });
  assert.equal(e.statut, "ok");
  assert.deepEqual(e.scenarios.map((c) => c.jours), [5, 3, 2]);
  assert.equal(e.scenarios[0].fin, "2026-03-15");
  assert.equal(estimer({ resteAFaire: 3, faites: 0, fusionnees: 0, jours: {}, maintenant }).statut, "sans-recul");
  assert.equal(estimer({ resteAFaire: 0, faites: 3, fusionnees: 3, jours: {}, maintenant }).statut, "termine");
});

test("etatControles", () => {
  assert.equal(etatControles(undefined), "inconnue");
  assert.equal(etatControles({ status: "in_progress" }), "en cours");
  assert.equal(etatControles({ status: "completed", conclusion: "success" }), "verte");
  assert.equal(etatControles({ status: "completed", conclusion: "failure" }), "rouge");
});

test("chargerGithub : sans jeton, indisponible et aucun appel", async () => {
  let appels = 0;
  const r = await chargerGithub({ depot: "o/r", token: "", appel: async () => { appels += 1; } });
  assert.deepEqual(r, { disponible: false });
  assert.equal(appels, 0);
});

test("chargerGithub : lit les changements et les contrôles", async () => {
  const appel = async (url) => {
    const rep = (corps) => ({ ok: true, json: async () => corps });
    if (url.includes("state=open")) return rep([{}, {}]);
    if (url.includes("state=closed")) return rep([{ merged_at: "2026-03-02T10:00:00Z" }, { merged_at: null }]);
    return rep({ workflow_runs: [{ status: "completed", conclusion: "success" }] });
  };
  const r = await chargerGithub({ depot: "o/r", token: "t", appel });
  assert.equal(r.ouvertes, 2);
  assert.equal(r.fusionnees, 1);
  assert.equal(r.ci, "verte");
});

test("chargerGithub : une erreur de réponse donne indisponible", async () => {
  const r = await chargerGithub({ depot: "o/r", token: "t", appel: async () => ({ ok: false, status: 403 }) });
  assert.deepEqual(r, { disponible: false });
});

test("un état avec précision est reconnu (début du texte)", () => {
  const etat = (t) => lireSpec(`### R1 : a\n- État : ${t}\n`)[0].etat;
  assert.equal(etat("fait, PR #12"), "fait");
  assert.equal(etat("en cours — 03/11"), "en cours");
  assert.equal(etat("Recetté le 03/11"), "recetté");
  assert.equal(etat("À faire"), "à faire");
  assert.equal(etat("pas fait"), "à faire");
});

const SECRETE = "Quelle somme verser au client Dupont ?";
const REPRENDRE_SECRET = `ETAT: ATTENTE-WILL
**Objectif :** Objectif confidentiel XYZ.
**Prochaine action :** Action confidentielle ABC.
**Question pour le responsable :** ${SECRETE}
`;
const GH_OK = { disponible: true, ouvertes: 0, fusionnees: 0, jours: {}, ci: "verte" };

function sortie(options) {
  const s = composer({ outil: "t", spec: SPEC, reprendre: REPRENDRE_SECRET, github: GH_OK, ...options });
  return { s, html: rendrePage(s), json: JSON.stringify(s) };
}

test("dépôt privé : objectif, prochaine action et question n'apparaissent ni dans la page ni dans le JSON", () => {
  const { s, html, json } = sortie({ depotPublic: false });
  for (const texte of [html, json]) {
    assert.ok(!texte.includes("confidentiel"));
    assert.ok(!texte.includes("confidentielle"));
    assert.ok(!texte.includes("Dupont"));
  }
  assert.equal(s.attente.question, "Une réponse du propriétaire est attendue");
  assert.ok(html.includes('role="alert"'));
});

test("variable absente : masqué par défaut", () => {
  const { html, json } = sortie({});
  assert.ok(!html.includes("Dupont") && !json.includes("Dupont"));
  assert.equal(depotEstPublic(undefined), false);
  assert.equal(depotEstPublic(""), false);
  assert.equal(depotEstPublic("false"), false);
  assert.equal(depotEstPublic("true"), true);
});

test("dépôt public : les textes sont affichés", () => {
  const { html, json } = sortie({ depotPublic: true });
  assert.ok(html.includes("Objectif confidentiel XYZ.") && html.includes("Action confidentielle ABC.") && html.includes(SECRETE));
  assert.ok(json.includes("Dupont"));
});

test("la page demande de ne pas être indexée", () => {
  assert.ok(sortie({}).html.includes('<meta name="robots" content="noindex">'));
});

test("chargerGithub : pagination, 100 fermées puis la page suivante", async () => {
  const pages = [];
  const appel = async (url) => {
    const rep = (corps) => ({ ok: true, json: async () => corps });
    if (url.includes("state=open")) return rep([]);
    if (url.includes("state=closed")) {
      const page = Number(/&page=(\d+)/.exec(url)[1]);
      pages.push(page);
      if (page === 1) return rep(Array.from({ length: 100 }, () => ({ merged_at: "2026-03-02T10:00:00Z" })));
      return rep([{ merged_at: "2026-03-03T10:00:00Z" }, { merged_at: null }]);
    }
    return rep({ workflow_runs: [] });
  };
  const r = await chargerGithub({ depot: "o/r", token: "t", appel });
  assert.deepEqual(pages, [1, 2]);
  assert.equal(r.fusionnees, 101);
  assert.equal(r.jours["2026-03-02"], 100);
});

test("le jeton n'apparaît jamais dans le JSON ni dans la page", async () => {
  const jetons = [];
  const appel = async (url, options) => {
    jetons.push(options.headers.Authorization);
    return { ok: true, json: async () => (url.includes("/actions/") ? { workflow_runs: [] } : []) };
  };
  const gh = await chargerGithub({ depot: "o/r", token: "SECRET", appel });
  assert.ok(jetons.length > 0 && jetons.every((j) => j === "Bearer SECRET"));
  for (const depotPublic of [true, false]) {
    const s = composer({ outil: "t", spec: SPEC, reprendre: REPRENDRE_SECRET, github: gh, depotPublic });
    assert.ok(!JSON.stringify(s).includes("SECRET") && !rendrePage(s).includes("SECRET"));
  }
});
