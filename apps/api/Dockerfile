# syntax=docker/dockerfile:1
# Build context: the repository root (docker build -f apps/api/Dockerfile .)

FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable

# Dependencies first, for layer caching.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --offline --frozen-lockfile --filter @ruche/api...
RUN pnpm --filter @ruche/api build

# Runtime: only the bundled server, run as an unprivileged user.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/index.js"]
