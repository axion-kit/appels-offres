import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";
import { rapport, analyserCouleur } from "./contraste";
import { motsInterdits } from "./langage";
import { CIBLE_MIN, RUPTURE } from "../../design/jetons";

/** Rend une page à une largeur donnée et renvoie le résultat d'une expression évaluée dans la page. */
export async function evaluerDansNavigateur(html: string, largeur: number, expression: string, hauteur = 800): Promise<unknown> {
  const chemin = process.env.CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const navigateur = await chromium.launch(chemin ? { executablePath: chemin, args: ["--no-sandbox"] } : {});
  try {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur } });
    await page.setContent(html, { waitUntil: "load" });
    return await page.evaluate(expression);
  } finally {
    await navigateur.close();
  }
}

export type PageAControler = { nom: string; html: string };

export const LARGEURS = [360, 820, 1280];

/** Lancé dans la page (texte simple : pas de transformation de fonction). Renvoie les mesures brutes. */
const MESURES = `(() => {
  const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const fond = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      const m = /rgba?\\(([^)]+)\\)/.exec(c);
      if (m) { const p = m[1].split(/[ ,\\/]+/).map(Number); if (p.length < 4 || p[3] > 0.99) return c; }
    }
    return "canvas";
  };
  const cibles = [];
  for (const el of document.querySelectorAll("a[href], button, input, select, textarea, summary, [role=button]")) {
    if (!visible(el)) { const l = el.closest("label"); if (!l || !visible(l)) continue; }
    const lab = (el.type === "radio" || el.type === "checkbox") ? el.closest("label") : null;
    const r = (lab || el).getBoundingClientRect();
    cibles.push({ nom: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.tagName).trim().slice(0, 30), w: r.width, h: r.height });
  }
  const textes = [];
  const champs = [];
  const arbre = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = arbre.nextNode(); n; n = arbre.nextNode()) {
    const t = n.textContent.trim();
    const el = n.parentElement;
    if (!t || !el || !visible(el) || el.closest("script,style")) continue;
    const s = getComputedStyle(el);
    textes.push({ t: t.slice(0, 30), couleur: s.color, fond: fond(el), taille: parseFloat(s.fontSize), gras: parseInt(s.fontWeight, 10) >= 700 });
  }
  for (const el of document.querySelectorAll("input, select, textarea")) {
    if (visible(el) && !["radio", "checkbox", "hidden", "submit", "button"].includes(el.type)) champs.push({ nom: el.name || el.type, taille: parseFloat(getComputedStyle(el).fontSize) });
  }
  const attrs = [...document.querySelectorAll("[alt],[title],[aria-label],[placeholder]")].map((e) => [e.getAttribute("alt"), e.getAttribute("title"), e.getAttribute("aria-label"), e.getAttribute("placeholder")].filter(Boolean).join(" ")).join(" ");
  return { debordement: document.documentElement.scrollWidth - window.innerWidth, cibles, textes, champs, lisible: document.body.innerText + " " + attrs + " " + document.title };
})()`;

type Mesures = {
  debordement: number;
  cibles: { nom: string; w: number; h: number }[];
  textes: { t: string; couleur: string; fond: string; taille: number; gras: boolean }[];
  champs: { nom: string; taille: number }[];
  lisible: string;
};

/**
 * Rend chaque page dans un vrai navigateur (360, 820, 1280 px ; thème clair puis sombre) et contrôle :
 * pas de défilement horizontal, cibles tactiles, contraste AA mesuré sur l'écran, champs de 16 px,
 * texte de 12 px au moins, aucun mot technique. Renvoie les problèmes (liste vide = bon).
 */
export async function controlerRendu(pages: PageAControler[], largeurs: number[] = LARGEURS): Promise<string[]> {
  const problemes: string[] = [];
  // CHROMIUM_PATH (ou le chromium préinstallé du cloud) évite un téléchargement ; sinon navigateur de Playwright.
  const chemin = process.env.CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const navigateur = await chromium.launch(chemin ? { executablePath: chemin, args: ["--no-sandbox"] } : {});
  try {
    for (const p of pages) {
      for (const theme of ["clair", "sombre"] as const) {
        for (const l of largeurs) {
          if (theme === "sombre" && l !== largeurs[0]) continue;
          const ctx = await navigateur.newContext({ viewport: { width: l, height: 800 }, colorScheme: "light", reducedMotion: "reduce" });
          const page = await ctx.newPage();
          await page.setContent(p.html, { waitUntil: "load" });
          if (theme === "sombre") await page.evaluate("document.documentElement.setAttribute('data-theme','sombre')");
          const m = (await page.evaluate(MESURES)) as Mesures;
          await ctx.close();
          const ou = `${p.nom}, ${l} px, thème ${theme}`;
          if (theme === "clair" && m.debordement > 0) problemes.push(`${ou} : la page déborde de ${m.debordement} px (défilement horizontal)`);
          const mini = l <= RUPTURE ? CIBLE_MIN : 24;
          if (theme === "clair") {
            for (const c of m.cibles) {
              if (c.w < mini - 0.5 || c.h < mini - 0.5) problemes.push(`${ou} : cible tactile trop petite « ${c.nom} » (${Math.round(c.w)}×${Math.round(c.h)} px, minimum ${mini})`);
            }
            if (l <= RUPTURE) for (const c of m.champs) if (c.taille < 16) problemes.push(`${ou} : champ « ${c.nom} » en ${c.taille} px (16 px au moins)`);
          }
          if (l === largeurs[0]) {
            for (const t of m.textes) {
              const a = analyserCouleur(t.couleur);
              const f = analyserCouleur(t.fond);
              if (!a || !f) {
                problemes.push(`${ou} : couleur illisible pour le contrôle (« ${t.t} » : ${t.couleur} sur ${t.fond})`);
                continue;
              }
              const grand = t.taille >= 24 || (t.taille >= 18.66 && t.gras);
              const min = grand ? 3 : 4.5;
              const r = rapport(t.couleur, t.fond);
              if (r < min) problemes.push(`${ou} : contraste ${r.toFixed(2)} sous ${min} pour « ${t.t} »`);
              if (t.taille < 12) problemes.push(`${ou} : texte de ${t.taille} px (12 px au moins) « ${t.t} »`);
            }
            if (theme === "clair") {
              const mots = motsInterdits(m.lisible);
              if (mots.length) problemes.push(`${ou} : mot technique visible : ${mots.join(", ")}`);
            }
          }
        }
      }
    }
  } finally {
    await navigateur.close();
  }
  return [...new Set(problemes)];
}
