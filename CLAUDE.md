# Ruche — règles du projet

Ruche est un réseau social open source (AGPL-3.0) où des proches publient leurs projets IA, les
suivent, les testent et s'encouragent. On n'héberge rien d'exécutable : chaque projet pointe vers
une démo externe. Le produit est bilingue français / anglais. « Ruche » est un nom de code.

L'équipe : Louis (humain, relit et valide tout) et Claude (écrit l'essentiel du code).

## Architecture

```text
apps/api            API Hono + @hono/zod-openapi (Node 24). Plus tard : serveur MCP, tâches pg-boss.
apps/app            Appli Expo (Expo Router) : iOS, Android et web, une seule base de code.
packages/contracts  Schémas Zod partagés : source de vérité des entrées/sorties de l'API.
packages/i18n       Traductions fr/en (le français est la référence) et choix de la langue.
infra/              Docker Compose (PostgreSQL + pgvector, API, Caddy).
docs/scenarios/     Scénarios d'usage par phase, écrits avant le code.
docs/adr/           Décisions d'architecture.
```

Les paquets internes exportent directement leurs sources TypeScript (pas d'étape de build). L'API
est empaquetée en un seul fichier par esbuild pour la production.

## Commandes

```bash
pnpm install
pnpm check                       # lint + types + tests, à lancer avant chaque commit
pnpm lint:fix                    # formatage et corrections Biome
pnpm --filter @ruche/api dev     # API sur http://localhost:3000 (/health, /openapi.json)
pnpm --filter @ruche/app web     # appli dans le navigateur
pnpm --filter <paquet> test      # tests d'un seul paquet
```

## Comment on développe

Chaque fonctionnalité est une tranche verticale, dans cet ordre :

1. **Le scénario**, en français, dans `docs/scenarios/` (Étant donné / Quand / Alors). Louis le valide.
2. **Le contrat** : schémas Zod dans `packages/contracts`.
3. **Les tests, qui doivent échouer** : unitaires pour les règles, intégration pour l'API
   (`app.request(...)`), test de composant pour l'écran. Lance-les et constate l'échec.
4. **Le backend**, jusqu'au vert.
5. **L'interface**, puis son test.
6. **`pnpm check`** vert, puis l'agent `security-reviewer` sur la branche.
7. Une branche et une pull request par fonctionnalité. **Rien n'est fusionné sans relecture de Louis.**

Commence toute fonctionnalité non triviale en mode plan. Si un scénario est ambigu, pose la question
plutôt que d'inventer une règle métier.

## Conventions

- TypeScript strict, pas de `any`, pas de `@ts-ignore`. Valider avec Zod tout ce qui entre (requêtes,
  variables d'environnement, réponses d'API externes).
- Code, noms, commentaires et messages de commit en anglais ; commits au format Conventional Commits
  (`feat:`, `fix:`, `test:`, `docs:`, `chore:`…). Documentation produit et scénarios en français.
- Tests : décrire le comportement attendu (`it('refuses a private project to other members')`), pas
  l'implémentation. Un bug corrigé = un test qui le reproduit.
- Formatage et lint : Biome (`pnpm lint:fix`). Un hook Claude Code formate chaque fichier modifié.
- Dépendances : versions exactes, ajout justifié. Dans l'appli, passer par `pnpm exec expo install`
  pour rester compatible avec le SDK Expo.

## Langues (fr / en)

- **Aucun texte d'interface écrit en dur.** Tout passe par `t('...')` et `packages/i18n`.
- Ajouter la clé d'abord dans `locales/fr.ts` (référence), puis dans `locales/en.ts`. Le typage et
  les tests échouent si une clé, un texte ou un paramètre `{{...}}` manque dans une langue.
- Les messages d'erreur de l'API sont traduits selon l'en-tête `Accept-Language`.
- Les contenus publiés par les membres ne sont pas traduits automatiquement (traduction à la
  demande prévue en phase 3).

## Sécurité (le code est public)

- Jamais de secret dans le dépôt, les tests ou les logs. Configuration par variables d'environnement
  validées dans `apps/api/src/env.ts`. Modèle : `infra/.env.example`.
- Chaque route qui lit ou écrit une ressource a un test d'autorisation : un autre membre est refusé,
  un contenu privé n'apparaît nulle part.
- Contenus des membres : Markdown assaini, liens externes via une page d'avertissement, images
  ré-encodées sans métadonnées.
- Requêtes sortantes du serveur : refuser les adresses privées et locales (risque SSRF).
- MCP / IA : les contenus d'autres membres sont non fiables (injection de prompt). Pas d'outil
  destructif sans confirmation, droits séparés lecture / écriture, quotas par utilisateur.

## Définition de « terminé »

- Le scénario est couvert par des tests qui passent.
- `pnpm check` est vert, la CI aussi.
- Les textes existent en français et en anglais.
- L'agent `security-reviewer` n'a relevé aucun problème bloquant.
- Louis a relu et approuvé la pull request.
