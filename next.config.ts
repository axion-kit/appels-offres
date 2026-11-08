import type { NextConfig } from "next";

// En-têtes de toute réponse. La politique de sécurité du contenu (avec nonce) n'est PAS ici : seul src/middleware.ts la pose (L01-T22).
// Referrer-Policy « same-origin » (la console met « no-referrer ») : avec « no-referrer », le navigateur envoie « Origin: null »
// sur les envois de formulaire, et le contrôle d'origine de la brique comptes les refuserait.
const entetes = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // La base en mémoire (essais et parcours automatiques) et le lecteur de PDF doivent rester des modules Node normaux.
  serverExternalPackages: ["@electric-sql/pglite", "pdfjs-dist"],
  async headers() {
    return [{ source: "/:path*", headers: entetes }];
  },
};

export default config;
