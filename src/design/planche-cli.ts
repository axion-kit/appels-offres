import { mkdirSync, writeFileSync } from "node:fs";
import { construirePlanche } from "../lib/planche/planche";

mkdirSync("planche", { recursive: true });
const html = construirePlanche();
writeFileSync("planche/planche.html", html);
console.log(`planche/planche.html écrit (${Math.round(html.length / 1024)} ko)`);
