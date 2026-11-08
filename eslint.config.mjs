import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "coverage/**", "node_modules/**", "next-env.d.ts", "playwright-report/**", "test-results/**"] },
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" } },
  ...coreWebVitals,
  ...nextTypescript,
  {
    // R249 (fer 19) : un texte reçu s'affiche comme du texte, jamais comme du HTML brut.
    // Seule exception : la feuille des jetons de src/app/layout.tsx. Les tests sont exclus ici (leur bloc a ses propres règles) :
    // la garde L01-T71 (src/lib/securite/html-brut.test.ts) couvre aussi le texte brut.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/layout.tsx", "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "R249 : HTML brut interdit ; afficher le texte reçu par le composant TexteRecu (src/composants/texte-recu.tsx)." },
        { selector: "Property[key.name='dangerouslySetInnerHTML']", message: "R249 : HTML brut interdit (dangerouslySetInnerHTML passé en objet)." },
        { selector: "AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]", message: "R249 : affectation à innerHTML ou outerHTML interdite." },
        { selector: "CallExpression[callee.property.name=/^(insertAdjacentHTML|createContextualFragment)$/]", message: "R249 : insertion de HTML brut interdite (insertAdjacentHTML, createContextualFragment)." },
        { selector: "CallExpression[callee.object.name='document'][callee.property.name=/^(write|writeln)$/]", message: "R249 : document.write interdit." },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "e2e/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[computed=true]:not([property.type='Literal'][property.raw=/^[0-9]+$/])",
          message: "Accès calculé interdit dans les tests (il pourrait cacher un test coupé).",
        },
        { selector: "Identifier[name='Reflect']", message: "Reflect est interdit dans les tests." },
        { selector: "Identifier[name='expectedStatus']", message: "expectedStatus est interdit dans les tests." },
        { selector: "Literal[value='expectedStatus']", message: "expectedStatus est interdit dans les tests." },
        { selector: "Identifier[name=/^(getOwnPropertyDescriptors?|getOwnPropertyNames|defineProperty|setContext|mergeContext|withContext)$/]", message: "Introspection ou contexte de test interdit dans les tests." },
        { selector: "NewExpression[callee.name='Function']", message: "Function est interdit dans les tests." },
        { selector: "CallExpression[callee.name='eval']", message: "eval est interdit dans les tests." },
        { selector: "TryStatement", message: "try/catch interdit dans les tests (utiliser expect(...).toThrow ou rejects)." },
        { selector: "MemberExpression[object.name='expect'][property.name='extend']", message: "expect.extend est interdit dans les tests." },
      ],
    },
  },
];

export default config;
