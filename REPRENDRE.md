# REPRENDRE : point de reprise (lire ce bloc d'abord)

ETAT: TRAVAIL
<!-- valeurs possibles : TRAVAIL | ATTENTE-WILL (attente du responsable) | FINI -->

**Objectif :** (ce que l'outil doit faire, en une phrase)

**Fait :**
- (rien pour l'instant : lire SPEC.md)

**Reste :**
- (lots à venir)

**Question pour le responsable :** (seulement si ETAT: ATTENTE-WILL : la question précise)

**Prochaine action :** (une seule action, précise : lot, fichier, commande)

**Pièges :**
- `drizzle-kit` ne peut pas écrire de .sql dans le dépôt : migrations écrites à la main dans `src/lib/comptes/migrations.ts` (un test les compare au schéma).
- Mots interdits par la CI même en français/commentaires : skip, only, todo, fixme, fail(s).
- Dans les tests : pas de try/catch, pas d'accès calculé, pas de Reflect.
- Chromium local peut ne pas correspondre à la version de Playwright : la CI installe le bon.

<!-- FIN DU BLOC DU HAUT (40 lignes au plus) : le journal détaillé vient dessous -->

---
## Journal
