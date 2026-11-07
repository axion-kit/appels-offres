import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout, { metadata, viewport } from "./layout";

describe("mise en page commune", () => {
  it("déclare la langue française et enveloppe le contenu", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>contenu</p>
      </RootLayout>,
    );
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain("<body><p>contenu</p></body>");
  });
  it("donne un titre et une vue adaptée au téléphone", () => {
    expect(metadata.title).toBe("Mon outil");
    expect(viewport.width).toBe("device-width");
  });
});
