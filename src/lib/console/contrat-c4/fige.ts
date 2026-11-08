// Copie figée du contrat C4 de la console. Régénérer avec p7-figer-c4.sh, jamais à la main.
export const C4_FIGE = {
  version: "0.5.0",
  commitConsole: "b6c66c56cb727c24269b45ff1b93f38fa7c8b205",
  empreintes: {
    cellules: "aeddef77d48743d68643da5319275840b227730fa27514764c8a297c88763929", // cellules.json
    jsonSchema: "24e7d9c8b77f91023a9a951ee7eef4a1cf3fc17f69d1909486ca66d1e4f8a57a", // json-schema.json
    paquets: "80bedb816fd37aff8f38684e038cfa8aaa44c0b5374ea8327b6cca7b19f18ba2", // paquets.json
  },
} as const;

// Copie figée du kit d'écriture des modules (sdk-module) : empreintes SHA-256 APRÈS réécriture des imports.
export const SDK_FIGE = {
  commitConsole: "b6c66c56cb727c24269b45ff1b93f38fa7c8b205",
  empreintes: {
    "manifeste.ts": "28049cc10d73b67ae9913fc8964663c99d8728c74c4ecf36e641cd050c927a2b",
    "connecteurs.ts": "36dce4ae210f93217251611e6a2c158e76b220b8444240a68ae789d338494844",
    "effets.ts": "461178fa940aa41932d674ff77d4bd98c12dad07e062a54225ded35fc03273ac",
    "declencheurs.ts": "40235feb1e5bfa9653bf577ed9735ac239ea358d87344a06b31fa7cec623c3c2",
    "contexte.ts": "144dfe1707addcd7ffcf1104bcad1a8f8ff3826f7cb79e26c2cbc472734e274e",
    "ia.ts": "c6778d8b9e512eab231533e1319a686c7d857df9d6b589bbeded11ec591aa6f6",
    "etapes.ts": "726d38890fef5427dccf73b6db0e4f9660aac451a2b34ce5a99d8107661089e0",
    "ecrans/composants.ts": "54affc2cbe0841cc25f31b0bb2b76001cc00240c83e4201d99af5f73dc680afa",
    "notifications.ts": "123d225f9400b534425def19ed9ff3fcb06dff550a14be43bb9dade8e098eb0d",
  },
} as const;
