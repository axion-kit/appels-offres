# kit-modele

Gabarit des outils du kit : une application Next.js (TypeScript strict) prête à l'emploi, pensée d'abord pour le téléphone, en français.

## Démarrer
```
pnpm install
pnpm dev
```

## Vérifier
```
pnpm tsc --noEmit   # types
pnpm lint
pnpm test           # tests + seuil de couverture 80 % sur src/lib
pnpm build
pnpm e2e            # un test de bout en bout (vue mobile)
```

## Suivre l'avancement
Page publique, à jour toutes les heures, lisible sur téléphone : `https://<organisation>.github.io/<outil>/` (voir `docs/avancement.md`).

## Documents
- `CLAUDE.md` : règles de travail d'une session autopilot
- `METHODE.md` : du cadrage à la recette
- `SPEC.md` : cahier des charges à remplir
- `REPRENDRE.md` : point de reprise (lire le bloc du haut)

Le dépôt est public : jamais de secret, jamais de nom de client ou de personne.
