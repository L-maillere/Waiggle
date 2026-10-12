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

# Exception : sharp (traitement des images) contient du code compilé pour chaque système, qu'on ne
# peut pas glisser dans dist/index.js. On l'installe à part, à la version exacte fixée dans
# apps/api/package.json, avec le binaire précompilé pour ce système (Alpine).
# --ignore-scripts : aucun script d'installation n'est exécuté (protection de la chaîne d'approvisionnement).
WORKDIR /runtime
# Le package.json indique aussi à Node que dist/index.js utilise la syntaxe moderne des modules (ESM).
RUN echo '{"private":true,"type":"module"}' > package.json \
  && npm install --omit=dev --ignore-scripts --no-audit --no-fund \
    "sharp@$(node -p "require('/repo/apps/api/package.json').dependencies.sharp")"

# --- Étape 2 : exécution ---
# On repart d'une image vide : ni code source, ni outils de build, ni dépendances de dev.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
# Les migrations SQL (création et évolution des tables) sont appliquées au démarrage.
ENV MIGRATIONS_DIR=/app/migrations
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /repo/packages/db/migrations ./migrations
COPY --from=build --chown=node:node /runtime/package.json ./package.json
COPY --from=build --chown=node:node /runtime/node_modules ./node_modules
# Dossier des fichiers envoyés par les membres (avatars). Un volume Docker y est monté
# (voir infra/docker-compose.yml) pour qu'ils survivent aux mises à jour du conteneur.
ENV MEDIA_DIR=/app/media
RUN mkdir -p /app/media && chown node:node /app/media
# Le serveur tourne avec un utilisateur sans privilèges, jamais en root.
USER node
EXPOSE 3000
# Docker interroge /health toutes les 30 s pour savoir si le conteneur va bien.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/index.js"]
