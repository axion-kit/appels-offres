import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { Coque } from "../../components/Coque";
import { EcranVue } from "../../components/EcranVue";
import { ecrans, menu, nomOutil, synthese } from "../../design/ecrans";
import { cssJetons } from "../../design/jetons";
import { SCRIPT_CODE } from "./code";

/** Feuille de style de la coque (lue dans `src/design/coque.css`). */
export function feuilleCoque(): string {
  return readFileSync(fileURLToPath(new URL("../../design/coque.css", import.meta.url)), "utf8");
}

export const QUESTIONS = [
  "Les écrans montrent-ils ce que vous attendiez ?",
  "Comprenez-vous chaque mot sans aide ?",
  "Retrouveriez-vous facilement ce qui compte le plus ?",
];
export const CHOIX = ["Oui", "Un peu", "Non"];

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const STYLE_PLANCHE = `
.cadre-tel .hote,.cadre-pc .hote{min-height:0}
body{margin:0;background:var(--c-fond);color:var(--c-texte);font-family:var(--police);font-size:var(--t-corps);line-height:1.5}
.page{padding:var(--e-s4);display:flex;flex-direction:column;gap:var(--e-s5);max-width:72rem;margin:0 auto}
.page h1,.page h2,.page h3{margin:0}
.page ul{margin:0;padding-left:var(--e-s5)}
.vue{display:flex;flex-direction:column;gap:var(--e-s3)}
.defile{overflow-x:auto;border:1px solid var(--c-bordure);border-radius:var(--r-moyen)}
.defile:focus-visible{outline:3px solid var(--c-accent-fort);outline-offset:2px}
.cadre-tel{max-width:360px;border:1px solid var(--c-bordure);border-radius:var(--r-moyen);overflow:hidden}
.cadre-pc{width:1000px}
.question{border:1px solid var(--c-bordure);border-radius:var(--r-moyen);padding:var(--e-s4);margin:0;display:flex;flex-direction:column;gap:var(--e-s2)}
.choix{display:flex;align-items:center;gap:var(--e-s3);min-height:var(--cible)}
.choix input{width:24px;height:24px}
.minuteur{font-size:var(--t-titre1);font-variant-numeric:tabular-nums}
.code{font-size:var(--t-titre1);font-family:monospace;letter-spacing:.2em}
.planche-bouton{min-height:var(--cible);padding:0 var(--e-s5);background:var(--c-accent);color:var(--c-accent-texte);font:inherit;font-weight:700;border:0;border-radius:var(--r-moyen);cursor:pointer}
`;

function vue(titre: string, classe: string, html: string): string {
  const cadre = `<div class="${classe}">${html}</div>`;
  return classe === "cadre-pc"
    ? `<div class="vue"><h3>${esc(titre)}</h3><div class="defile" tabindex="0" role="group" aria-label="${esc(titre)} (à faire défiler)">${cadre}</div></div>`
    : `<div class="vue"><h3>${esc(titre)}</h3>${cadre}</div>`;
}

function script(): string {
  return `${SCRIPT_CODE}
document.addEventListener("submit",function(e){e.preventDefault();});
var debut=null,ecoule=0,minuteur=null;
var affiche=document.getElementById("minuteur"),code=document.getElementById("code");
function texte(s){var m=Math.floor(s/60),r=s%60;return (m<10?"0":"")+m+":"+(r<10?"0":"")+r;}
function maj(){affiche.textContent=texte(ecoule);}
document.getElementById("depart").addEventListener("click",function(){if(minuteur){return;}debut=Date.now()-ecoule*1000;minuteur=setInterval(function(){ecoule=Math.floor((Date.now()-debut)/1000);maj();},500);});
document.getElementById("arret").addEventListener("click",function(){clearInterval(minuteur);minuteur=null;});
document.getElementById("calcul").addEventListener("click",function(){
  var v=[];for(var i=0;i<${QUESTIONS.length};i++){var c=document.querySelector('input[name="q'+i+'"]:checked');if(!c){code.textContent="Répondez aux trois questions.";return;}v.push(Number(c.value));}
  code.textContent=encoder(v[0],v[1],v[2],ecoule);
});`;
}

/** La planche de maquettes : une seule page HTML, sans dépendance, à ouvrir sur le téléphone. */
export function construirePlanche(): string {
  const sy = synthese;
  const liste = (l: string[]) => `<ul>${l.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const parEcran = ecrans
    .map((e) => {
      const corps = renderToStaticMarkup(
        Coque({ nomOutil, menu, actif: e.rubrique ?? e.titre, children: EcranVue({ ecran: e }) }),
      );
      return `<section class="vue"><h2>${esc(e.titre)}</h2><p>${esc(e.but)}</p>${vue("Sur téléphone", "cadre-tel", corps)}${vue("Sur ordinateur", "cadre-pc", corps)}</section>`;
    })
    .join("");
  const questions = QUESTIONS.map(
    (q, i) =>
      `<fieldset class="question"><legend>${esc(q)}</legend>${CHOIX.map(
        (c, j) => `<label class="choix"><input type="radio" name="q${i}" value="${j}"> ${esc(c)}</label>`,
      ).join("")}</fieldset>`,
  ).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Planche de maquettes</title><style>${cssJetons()}${feuilleCoque()}${STYLE_PLANCHE}</style></head><body><main class="page"><h1>Planche de maquettes</h1>
<section class="vue"><h2>Voici ce que j'ai compris</h2><p><strong>Objectif :</strong> ${esc(sy.objectif)}</p><p><strong>Pour qui :</strong> ${esc(sy.pour)}</p><h3>Hors sujet</h3>${liste(sy.horsSujet)}<h3>Ce que je suppose</h3>${liste(sy.hypotheses)}</section>
${parEcran}
<section class="vue"><h2>Votre avis</h2>${questions}
<p class="minuteur" id="minuteur" aria-live="off">00:00</p>
<p><button class="planche-bouton" type="button" id="depart">Démarrer le minuteur</button> <button class="planche-bouton" type="button" id="arret">Arrêter</button></p>
<p><button class="planche-bouton" type="button" id="calcul">Obtenir mon code</button></p>
<p class="code" id="code" aria-live="polite"></p></section>
</main><script>${script()}</script></body></html>`;
}
