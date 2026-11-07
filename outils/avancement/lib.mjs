// Fonctions pures de la page d'avancement : lecture de SPEC.md et REPRENDRE.md, calculs, échappement, rendu.
// Aucune dépendance. Tout texte lu dans le dépôt est échappé avant d'être affiché.

export const ETATS = ["à faire", "en cours", "fait", "recetté"];
export const VERSIONS = ["mvp", "v2", "v3"];
const FUSEAU = "Europe/Paris";

export function echapper(valeur) {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normaliserEtat(brut) {
  const t = String(brut ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (/^recette\b/.test(t)) return "recetté";
  if (/^fait\b/.test(t)) return "fait";
  if (/^en cours\b/.test(t)) return "en cours";
  return "à faire";
}

// SPEC.md -> liste d'exigences { id, titre, version, etat }.
// Une exigence : « ### R3 : titre », puis « - Version : mvp : raison » et « - État : à faire | en cours | fait | recetté ».
// Une exigence sans ligne « État » est « à faire ». Les titres entre parenthèses (gabarit vide) sont ignorés.
export function lireSpec(texte) {
  const lignes = String(texte ?? "").replace(/\r/g, "").split("\n");
  const exigences = [];
  let courante = null;
  for (const ligne of lignes) {
    const entete = /^###\s+R(\d+)\s*:\s*(.*)$/.exec(ligne);
    if (entete) {
      courante = { id: Number(entete[1]), titre: (entete[2] ?? "").trim(), version: "mvp", etat: "à faire" };
      if (!courante.titre.startsWith("(")) exigences.push(courante);
      continue;
    }
    if (/^#{1,3}\s/.test(ligne)) {
      courante = null;
      continue;
    }
    if (!courante) continue;
    const v = /^\s*[-*]\s*(?:\*\*)?Version(?:\*\*)?\s*:\s*(?:\*\*)?\s*(mvp|v2|v3)\b/i.exec(ligne);
    if (v) courante.version = (v[1] ?? "mvp").toLowerCase();
    const e = /^\s*[-*]\s*(?:\*\*)?(?:État|Etat)(?:\*\*)?\s*:\s*(?:\*\*)?\s*([^|\n(]+)/i.exec(ligne);
    if (e) courante.etat = normaliserEtat(e[1]);
  }
  return exigences;
}

const sansPlaceholder = (t) => {
  const s = String(t ?? "").trim();
  return s === "" || (s.startsWith("(") && s.endsWith(")")) ? "" : s;
};

// Bloc du haut de REPRENDRE.md -> { etat, objectif, prochaineAction, question }.
export function lireReprendre(texte) {
  const brut = String(texte ?? "").replace(/\r/g, "");
  const fin = brut.indexOf("FIN DU BLOC DU HAUT");
  const haut = fin >= 0 ? brut.slice(0, fin) : brut.split("\n").slice(0, 40).join("\n");
  const e = /^ETAT:\s*([A-Za-z-]+)/m.exec(haut);
  const etat = e && ["TRAVAIL", "ATTENTE-WILL", "FINI"].includes((e[1] ?? "").toUpperCase()) ? (e[1] ?? "").toUpperCase() : "INCONNU";
  const champ = (nom) => {
    const m = new RegExp(`^\\*\\*${nom}\\s*:\\*\\*\\s*(.*)$`, "mi").exec(haut);
    return sansPlaceholder(m ? m[1] : "");
  };
  return {
    etat,
    objectif: champ("Objectif"),
    prochaineAction: champ("Prochaine action"),
    question: champ("Question pour (?:le responsable|Will)"),
  };
}

export const pourcent = (a, b) => (b > 0 ? Math.round((1000 * a) / b) / 10 : 0);

export function calculer(exigences) {
  const compte = { "à faire": 0, "en cours": 0, fait: 0, recetté: 0 };
  const parVersion = Object.fromEntries(VERSIONS.map((v) => [v, { total: 0, faites: 0, pourcent: 0 }]));
  for (const x of exigences) {
    compte[x.etat] = (compte[x.etat] ?? 0) + 1;
    const pv = parVersion[x.version];
    if (pv) {
      pv.total += 1;
      if (x.etat === "fait" || x.etat === "recetté") pv.faites += 1;
    }
  }
  for (const v of VERSIONS) {
    const pv = parVersion[v];
    if (pv) pv.pourcent = pourcent(pv.faites, pv.total);
  }
  const total = exigences.length;
  const faites = compte.fait + compte.recetté;
  return {
    total,
    aFaire: compte["à faire"],
    enCours: compte["en cours"],
    faites,
    recettees: compte.recetté,
    pourcentFait: pourcent(faites, total),
    pourcentRecette: pourcent(compte.recetté, total),
    parVersion,
  };
}

// Jour calendaire à Paris (AAAA-MM-JJ).
export function jourParis(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function parJour(datesFusion) {
  const jours = {};
  for (const d of datesFusion) {
    const t = new Date(d);
    if (Number.isNaN(t.getTime())) continue;
    const j = jourParis(t);
    jours[j] = (jours[j] ?? 0) + 1;
  }
  return jours;
}

// Estimation de fin selon 3 cadences (prudente, moyenne, rapide), en propositions fusionnées par jour
// sur les 14 derniers jours actifs. Le nombre d'exigences faites par proposition fusionnée vient de l'historique.
export function estimer({ resteAFaire, faites, fusionnees, jours, maintenant = new Date() }) {
  const limite = jourParis(new Date(maintenant.getTime() - 14 * 24 * 3600e3));
  const valeurs = Object.entries(jours)
    .filter(([j]) => j >= limite)
    .map(([, n]) => n);
  if (resteAFaire <= 0) return { statut: "termine", scenarios: [] };
  if (valeurs.length === 0 || fusionnees <= 0 || faites <= 0) return { statut: "sans-recul", scenarios: [] };
  const parProposition = faites / fusionnees;
  const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
  const cadences = [
    ["Prudente", Math.min(...valeurs)],
    ["Moyenne", moyenne],
    ["Rapide", Math.max(...valeurs)],
  ];
  const scenarios = cadences.map(([nom, c]) => {
    const parJourExigences = Math.max(c * parProposition, 0.01);
    const nbJours = Math.ceil(resteAFaire / parJourExigences);
    const fin = new Date(maintenant.getTime() + nbJours * 24 * 3600e3);
    return { nom, cadence: Math.round(c * 10) / 10, jours: nbJours, fin: jourParis(fin) };
  });
  return { statut: "ok", scenarios };
}

export function dateParis(date) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, dateStyle: "full", timeStyle: "short" }).format(date);
}
export function jourLisible(iso) {
  const [a, m, j] = String(iso).split("-");
  return `${j}/${m}/${a}`;
}

const LIBELLE_CI = { verte: "Tout est vert", rouge: "Un contrôle est rouge", "en cours": "Contrôle en cours", inconnue: "Indisponible" };

// Synthèse complète (sert au JSON et à la page).
// Libellés fixes affichés à la place des textes libres quand le dépôt n'est pas public (la page, elle, l'est).
export const LIBELLES_MASQUES = {
  objectif: "L'objectif n'est pas affiché sur cette page.",
  prochaineAction: "Le détail de la prochaine étape n'est pas affiché sur cette page.",
  question: "Une réponse du propriétaire est attendue",
};

// Seule la valeur exacte « true » (variable DEPOT_PUBLIC) rend le dépôt public : par défaut on masque.
export const depotEstPublic = (valeur) => String(valeur ?? "").trim().toLowerCase() === "true";

export function composer({ outil, spec, reprendre, github, maintenant = new Date(), depotPublic = false }) {
  const exigences = lireSpec(spec);
  const chiffres = calculer(exigences);
  const lu = lireReprendre(reprendre);
  const rep = depotPublic === true
    ? lu
    : {
        ...lu,
        objectif: lu.objectif ? LIBELLES_MASQUES.objectif : "",
        prochaineAction: lu.prochaineAction ? LIBELLES_MASQUES.prochaineAction : "",
        question: LIBELLES_MASQUES.question,
      };
  const gh = github && github.disponible ? github : { disponible: false, ouvertes: 0, fusionnees: 0, jours: {}, ci: "inconnue" };
  const estimation = gh.disponible
    ? estimer({ resteAFaire: chiffres.total - chiffres.faites, faites: chiffres.faites, fusionnees: gh.fusionnees, jours: gh.jours, maintenant })
    : { statut: "sans-recul", scenarios: [] };
  return {
    outil: String(outil || "cet outil"),
    miseAJour: maintenant.toISOString(),
    miseAJourParis: dateParis(maintenant),
    etat: rep.etat,
    objectif: rep.objectif,
    prochaineAction: rep.prochaineAction,
    attente: rep.etat === "ATTENTE-WILL" ? { question: rep.question || rep.prochaineAction || "Une réponse est attendue." } : null,
    exigences: chiffres,
    github: {
      disponible: gh.disponible,
      ouvertes: gh.ouvertes,
      fusionnees: gh.fusionnees,
      parJour: gh.jours,
      controles: gh.ci,
    },
    estimation,
  };
}

const CSS = `:root{--fond:#f6f4ef;--carte:#fff;--texte:#26231f;--doux:#5f5951;--trait:#e3ded4;--ok:#2d7a4f;--cours:#b8680f;--zero:#a59d91;--alerte:#a63a1b;--barre:#ebe6db;--accent:#e8730c;--bandeau:#1c1917}
@media (prefers-color-scheme:dark){:root{--fond:#1b1917;--carte:#25221f;--texte:#ece7df;--doux:#a8a094;--trait:#3a3631;--ok:#59b883;--cours:#e09a45;--zero:#7d766b;--alerte:#e2765a;--barre:#34302b}}
*{box-sizing:border-box}body{margin:0;background:var(--fond);color:var(--texte);font:16px/1.5 system-ui,"Segoe UI",Arial,sans-serif}
header{background:var(--bandeau);color:#fff;border-bottom:4px solid var(--accent);padding:16px max(16px,env(safe-area-inset-left))}
header h1{font-size:20px;margin:0}header p{margin:2px 0 0;color:#d6d0c7;font-size:14px}
main{max-width:900px;margin:0 auto;padding:16px max(16px,env(safe-area-inset-left)) 40px}
h2{font-size:18px;margin:28px 0 10px}.grille{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.carte{background:var(--carte);border:1px solid var(--trait);border-radius:10px;padding:14px 16px}.gros{font-size:32px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums}
.leg{color:var(--doux);font-size:14px}.bandeau{border-radius:10px;padding:16px;margin:0 0 16px;font-weight:600;border:2px solid var(--alerte);background:var(--carte);color:var(--alerte)}
.bandeau p{margin:6px 0 0;font-weight:400;color:var(--texte)}.ligne{margin:12px 0}.ligne .tete{display:flex;justify-content:space-between;gap:8px;font-size:15px}
.piste{height:12px;border-radius:6px;background:var(--barre);overflow:hidden;margin-top:4px}.piste i{display:block;height:100%;background:var(--accent);border-radius:6px}
.piste i.ok{background:var(--ok)}table{width:100%;border-collapse:collapse;font-size:15px}td,th{text-align:left;padding:8px 4px;border-bottom:1px solid var(--trait)}.num{text-align:right;font-variant-numeric:tabular-nums}
.note{font-size:14px;color:var(--doux)}.ok{color:var(--ok)}.alerte{color:var(--alerte)}`;

function barre(libelle, detail, p, classe = "") {
  const largeur = Math.max(0, Math.min(100, Number(p) || 0));
  return `<div class="ligne"><div class="tete"><span>${echapper(libelle)}</span><span>${echapper(detail)}</span></div><div class="piste"><i class="${classe}" style="width:${largeur}%"></i></div></div>`;
}

const NOM_VERSION = { mvp: "Première version (MVP)", v2: "Deuxième version", v3: "Troisième version" };

export function rendrePage(s) {
  const x = s.exigences;
  const g = s.github;
  const indispo = "indisponible";
  const bandeaux = [];
  if (s.attente) {
    bandeaux.push(`<div class="bandeau" role="alert">Une réponse du propriétaire est attendue : le travail est en pause.<p>${echapper(s.attente.question)}</p></div>`);
  }
  if (g.disponible && g.controles === "rouge") {
    bandeaux.push(`<div class="bandeau" role="alert">Les contrôles automatiques sont rouges sur la version principale.<p>Un correctif est nécessaire avant d'aller plus loin.</p></div>`);
  }
  const etatTexte = { TRAVAIL: "Le travail avance", "ATTENTE-WILL": "En pause : réponse attendue", FINI: "Terminé", INCONNU: "État inconnu" }[s.etat] ?? "État inconnu";
  const cartes = [
    ["Avancement", x.total ? `${x.pourcentFait} %` : "–", `${x.faites} sur ${x.total} objectifs faits`],
    ["Vérifiés sur téléphone", x.total ? `${x.pourcentRecette} %` : "–", `${x.recettees} sur ${x.total}`],
    ["Changements fusionnés", g.disponible ? String(g.fusionnees) : indispo, "déjà intégrés"],
    ["Changements en attente", g.disponible ? String(g.ouvertes) : indispo, "à relire ou à valider"],
    ["Contrôles automatiques", g.disponible ? (LIBELLE_CI[g.controles] ?? indispo) : indispo, "dernier relevé"],
  ]
    .map(([t, v, l]) => `<div class="carte"><div class="leg">${echapper(t)}</div><div class="${v === indispo ? "leg" : "gros"}">${echapper(v)}</div><div class="leg">${echapper(l)}</div></div>`)
    .join("");
  const versions = x.total
    ? VERSIONS.filter((v) => x.parVersion[v] && x.parVersion[v].total > 0)
        .map((v) => {
          const pv = x.parVersion[v];
          return barre(NOM_VERSION[v], `${pv.faites} / ${pv.total} · ${pv.pourcent} %`, pv.pourcent, pv.pourcent === 100 ? "ok" : "");
        })
        .join("")
    : `<p class="note">Le cahier des charges ne contient pas encore d'objectifs numérotés. Rien à mesurer pour l'instant.</p>`;
  const jours = Object.entries(g.parJour).sort();
  const maxJour = Math.max(1, ...jours.map(([, n]) => n));
  const blocJours = !g.disponible
    ? `<p class="note">Les informations de suivi en ligne sont indisponibles pour ce relevé.</p>`
    : jours.length === 0
      ? `<p class="note">Aucun changement fusionné pour l'instant.</p>`
      : jours.slice(-14).map(([j, n]) => barre(jourLisible(j), String(n), (100 * n) / maxJour, "ok")).join("");
  let blocFin;
  if (s.estimation.statut === "termine") blocFin = `<p class="ok">Tous les objectifs sont faits.</p>`;
  else if (s.estimation.statut !== "ok") blocFin = `<p class="note">Pas encore assez de recul pour estimer une date de fin.</p>`;
  else {
    const lignes = s.estimation.scenarios
      .map((c) => `<tr><td>${echapper(c.nom)}</td><td class="num">${echapper(c.cadence)}</td><td class="num">${echapper(c.jours)}</td><td class="num">${echapper(jourLisible(c.fin))}</td></tr>`)
      .join("");
    blocFin = `<table><tr><th>Rythme</th><th class="num">Par jour</th><th class="num">Jours</th><th class="num">Fin</th></tr>${lignes}</table><p class="note">Estimation à partir du rythme récent : ce n'est pas une promesse.</p>`;
  }
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="300"><title>Avancement de ${echapper(s.outil)}</title><style>${CSS}</style></head><body>
<header><h1>Avancement de ${echapper(s.outil)}</h1><p>${echapper(etatTexte)} · mis à jour le ${echapper(s.miseAJourParis)} (heure de Paris)</p></header>
<main>
${bandeaux.join("\n")}
${s.objectif ? `<p>${echapper(s.objectif)}</p>` : ""}
<div class="grille">${cartes}</div>
<h2>Par version</h2><div class="carte">${versions}</div>
<h2>Prochaine étape</h2><div class="carte"><p>${echapper(s.prochaineAction || "Rien de précisé pour l'instant.")}</p></div>
<h2>Changements fusionnés par jour</h2><div class="carte">${blocJours}</div>
<h2>Fin estimée</h2><div class="carte">${blocFin}</div>
</main></body></html>
`;
}

// Dernier relevé des contrôles automatiques de la version principale.
export function etatControles(run) {
  if (!run) return "inconnue";
  if (run.status && run.status !== "completed") return "en cours";
  if (run.conclusion === "success") return "verte";
  if (run.conclusion) return "rouge";
  return "inconnue";
}

export async function chargerGithub({ depot, token, appel = fetch }) {
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(String(depot ?? ""))) return { disponible: false };
  const entetes = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const lire = async (chemin) => {
    const r = await appel(`https://api.github.com/repos/${depot}${chemin}`, { headers: entetes });
    if (!r.ok) throw new Error(`réponse ${r.status}`);
    return r.json();
  };
  try {
    const ouvertes = await lire("/pulls?state=open&per_page=100");
    const dates = [];
    for (let page = 1; page <= 5; page++) {
      const lot = await lire(`/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`);
      for (const p of lot) if (p.merged_at) dates.push(p.merged_at);
      if (lot.length < 100) break;
    }
    const runs = await lire("/actions/workflows/ci.yml/runs?branch=main&event=push&per_page=1");
    return {
      disponible: true,
      ouvertes: ouvertes.length,
      fusionnees: dates.length,
      jours: parJour(dates),
      ci: etatControles(runs?.workflow_runs?.[0]),
    };
  } catch {
    return { disponible: false };
  }
}
