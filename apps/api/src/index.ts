import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadEnv } from './env'

const env = loadEnv(process.env)
const version = process.env.npm_package_version ?? process.env.APP_VERSION ?? 'dev'
const app = createApp({ version })

const server = serve({ fetch: app.fetch, port: env.port }, ({ port }) => {
  console.log(`Ruche API listening on http://localhost:${port} (${env.nodeEnv})`)
})

const shutdown = () => {
  server.close(() => process.exit(0))
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
