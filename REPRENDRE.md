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
- Après `pnpm build`, `git status` doit être propre ; sinon `git checkout -- tsconfig.json next-env.d.ts` avant le commit (fichiers interdits aux fiches).
- Les routines n'ont pas `gh` : pousser la branche et le journal, le directeur ouvre la PR et suit la CI.
- Dans les tests : pas d'accès calculé (`objet["cle"]`), même pour lire une constante.
- Toute PR est ouverte en brouillon ; elle ne passe en « prête » qu'avec `VERDICT: OK` à l'empreinte du diff (le portier ne lit aucun avis).
- Une fiche n'est jamais touchée par son auteur, pas même `statut` : la clôture de vague s'en charge.

<!-- FIN DU BLOC DU HAUT (40 lignes au plus) : le journal détaillé vient dessous -->

---
## Journal
