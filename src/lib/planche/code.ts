/**
 * Code de résultat de la planche : trois réponses (0, 1 ou 2) et une durée en secondes,
 * écrits en lettres et chiffres, avec un caractère de contrôle pour repérer une faute de recopie.
 */
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
export const SECONDES_MAX = 3599;

function controle(corps: string): string {
  let somme = 0;
  for (let i = 0; i < corps.length; i++) somme += (i + 1) * ALPHABET.indexOf(corps.charAt(i));
  return ALPHABET.charAt(somme % 36);
}

export type Resultat = { reponses: [number, number, number]; secondes: number };

export function encoderResultat(r: Resultat): string {
  const [a, b, c] = r.reponses;
  const secondes = Math.min(Math.max(Math.round(r.secondes), 0), SECONDES_MAX);
  const n = ((a * 3 + b) * 3 + c) * 3600 + secondes;
  const corps = n.toString(36).padStart(4, "0");
  return corps + controle(corps);
}

/** Renvoie le résultat, ou `null` si le code est mal recopié. */
export function decoderResultat(code: string): Resultat | null {
  const texte = code.trim().toLowerCase();
  if (!/^[0-9a-z]{5}$/.test(texte)) return null;
  const corps = texte.slice(0, 4);
  if (controle(corps) !== texte.charAt(4)) return null;
  const n = parseInt(corps, 36);
  const secondes = n % 3600;
  const reste = Math.floor(n / 3600);
  if (reste > 26) return null;
  return { reponses: [Math.floor(reste / 9), Math.floor(reste / 3) % 3, reste % 3], secondes };
}

/** Même calcul, écrit pour le navigateur (la planche est une page seule, sans module). */
export const SCRIPT_CODE = `
var ALPHABET="${ALPHABET}";
function controle(corps){var s=0;for(var i=0;i<corps.length;i++){s+=(i+1)*ALPHABET.indexOf(corps.charAt(i));}return ALPHABET.charAt(s%36);}
function encoder(a,b,c,secondes){var s=Math.min(Math.max(Math.round(secondes),0),${SECONDES_MAX});var n=((a*3+b)*3+c)*3600+s;var corps=n.toString(36);while(corps.length<4){corps="0"+corps;}return corps+controle(corps);}
`;
