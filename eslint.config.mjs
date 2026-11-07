import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: [".next/**", "coverage/**", "node_modules/**", "next-env.d.ts", "playwright-report/**", "test-results/**"] },
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" } },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
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
