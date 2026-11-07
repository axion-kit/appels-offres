import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../design/coque.css";
import { cssJetons } from "../design/jetons";

export const metadata: Metadata = {
  title: "Mon outil",
  description: "Un outil simple, pensé d'abord pour le téléphone.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <style dangerouslySetInnerHTML={{ __html: cssJetons() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
