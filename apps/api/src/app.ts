// L'application API : la liste des routes et ce qui se passe autour de chaque requête.
// On la fabrique avec une fonction (createApp) plutôt qu'au chargement du fichier :
// les tests peuvent ainsi créer leur propre instance, sans démarrer de vrai serveur.
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { HealthResponse } from '@ruche/contracts'
import type { Database } from '@ruche/db'
import { parseAcceptLanguage, resolveLanguage } from '@ruche/i18n'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { Auth } from './auth/auth'
import { sessionMiddleware } from './auth/session'
import { errorBody, languageOf } from './errors'
import { meRoutes } from './routes/me'
import type { AppEnv } from './types'

export type AppOptions = {
  version: string
  auth: Auth
  db: Database
  /** Adresse de l'appli web, seule autorisée à appeler l'API depuis un navigateur. */
  appUrl: string
}

// Déclaration de la route GET /health. createRoute décrit la route ET sa réponse attendue :
// c'est ce qui permet de générer automatiquement la documentation OpenAPI.
const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  summary: 'Check that the API is running',
  responses: {
    200: {
      description: 'The API is up.',
      content: { 'application/json': { schema: HealthResponse } },
    },
  },
})

export const createApp = ({ version, auth, db, appUrl }: AppOptions) => {
  const app = new OpenAPIHono<AppEnv>()

  // Un « middleware » est une fonction exécutée pour chaque requête, avant (et après) la route.
  // secureHeaders ajoute des en-têtes de sécurité standards : interdiction d'afficher le site
  // dans une iframe étrangère, obligation du HTTPS, etc. « same-site » laisse l'appli web
  // (ruche.app) lire les réponses de l'API (api.ruche.app), qui est sur le même site.
  app.use(secureHeaders({ crossOriginResourcePolicy: 'same-site' }))

  // Middleware maison : détermine la langue de la requête et l'annonce dans la réponse.
  app.use(async (c, next) => {
    const language = resolveLanguage(parseAcceptLanguage(c.req.header('accept-language')))
    c.set('language', language)
    await next() // on laisse la route s'exécuter…
    c.header('Content-Language', language) // …puis on complète la réponse
  })

  // CORS : par défaut, un navigateur interdit à une page d'appeler une API d'un autre domaine.
  // On autorise explicitement l'appli web, et elle seule, avec ses cookies (credentials).
  app.use(
    cors({
      origin: (origin) => (origin === appUrl ? origin : null),
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      exposeHeaders: ['Content-Disposition', 'Content-Language'],
    }),
  )

  // Toutes les routes de Better Auth (inscription, connexion, vérification…) sous /api/auth/.
  // c.req.raw est la requête HTTP standard, que Better Auth sait traiter seul.
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

  // Sur nos propres routes /v1/…, on retrouve le membre connecté avant d'exécuter la route.
  app.use('/v1/*', sessionMiddleware(auth))

  // La route de santé : `as const` garantit que status vaut exactement 'ok', comme l'exige le schéma.
  app.openapi(healthRoute, (c) => c.json({ status: 'ok' as const, version }, 200))

  // Les routes du membre connecté, rangées dans leur propre fichier.
  app.route('/', meRoutes(db))

  // La documentation de l'API, générée à partir des routes déclarées, servie en JSON.
  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Ruche API', version },
  })

  // Toute adresse inconnue : réponse 404 avec un message traduit.
  app.notFound((c) => {
    const language = languageOf(c)
    c.header('Content-Language', language)
    return c.json(errorBody(language, 'not_found'), 404)
  })

  // Toute erreur imprévue : on la note dans les logs du serveur, mais on ne renvoie au client
  // qu'un message générique. Les détails techniques pourraient aider un attaquant.
  app.onError((err, c) => {
    console.error(err)
    const language = languageOf(c)
    c.header('Content-Language', language)
    return c.json(errorBody(language, 'internal'), 500)
  })

  return app
}
