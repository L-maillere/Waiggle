# syntax=docker/dockerfile:1
# Image Docker de l'API. À construire depuis la racine du dépôt :
#   docker build -f apps/api/Dockerfile .
# Deux étapes : une pour construire (avec tous les outils), une pour exécuter (le strict minimum).

# --- Étape 1 : construction ---
FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable

# On télécharge d'abord les dépendances, d'après le fichier de verrouillage.
# Docker garde cette étape en cache tant que ces fichiers ne changent pas : constructions plus rapides.
# package.json est indispensable ici : son champ "packageManager" fixe la version exacte de pnpm.
# Sans lui, corepack télécharge la toute dernière version, qui peut se comporter autrement.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
# Installe uniquement l'API et ses dépendances internes (le « ... » après le nom).
RUN pnpm install --offline --frozen-lockfile --filter @ruche/api...
# Assemble tout le serveur en un seul fichier dist/index.js (voir le script "build").
RUN pnpm --filter @ruche/api build

# --- Étape 2 : exécution ---
# On repart d'une image vide : ni code source, ni outils de build, ni dépendances de dev.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
# Les migrations SQL (création et évolution des tables) sont appliquées au démarrage.
ENV MIGRATIONS_DIR=/app/migrations
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /repo/packages/db/migrations ./migrations
# Le serveur tourne avec un utilisateur sans privilèges, jamais en root.
USER node
EXPOSE 3000
# Docker interroge /health toutes les 30 s pour savoir si le conteneur va bien.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/index.js"]
