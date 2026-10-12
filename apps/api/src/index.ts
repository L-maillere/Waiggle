// Point de démarrage du serveur : c'est le seul fichier qui touche au « vrai monde »
// (variables d'environnement, port réseau, signaux du système). Le reste est testable sans lui.
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadEnv } from './env'

const env = loadEnv(process.env)
// Version affichée par /health : celle du package.json en développement, APP_VERSION en production.
const version = process.env.npm_package_version ?? process.env.APP_VERSION ?? 'dev'
const app = createApp({ version })

const server = serve({ fetch: app.fetch, port: env.port }, ({ port }) => {
  console.log(`Ruche API listening on http://localhost:${port} (${env.nodeEnv})`)
})

// Arrêt propre : quand Docker ou Ctrl+C demandent l'arrêt (SIGTERM / SIGINT),
// on laisse les requêtes en cours se terminer avant de quitter.
const shutdown = () => {
  server.close(() => process.exit(0))
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
