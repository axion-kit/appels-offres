import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // La base en mémoire (essais et parcours automatiques) doit rester un module Node normal.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default config;
