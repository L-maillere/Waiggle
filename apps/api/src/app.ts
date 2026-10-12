// L'application API : la liste des routes et ce qui se passe autour de chaque requête.
// On la fabrique avec une fonction (createApp) plutôt qu'au chargement du fichier :
// les tests peuvent ainsi créer leur propre instance, sans démarrer de vrai serveur.
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { ErrorCode, ErrorResponse } from '@ruche/contracts'
import { HealthResponse } from '@ruche/contracts'
import { type Language, parseAcceptLanguage, resolveLanguage, resources } from '@ruche/i18n'
import type { Context } from 'hono'
import { secureHeaders } from 'hono/secure-headers'

// Hono permet d'attacher des valeurs à une requête (les « Variables »).
// On déclare ici leur type : chaque requête transporte la langue du visiteur.
type AppEnv = { Variables: { language: Language } }

export type AppOptions = { version: string }

// Correspondance entre un code d'erreur (pour les programmes) et sa clé de traduction (pour les humains).
const errorMessages: Record<ErrorCode, 'notFound' | 'validation' | 'internal'> = {
  not_found: 'notFound',
  validation: 'validation',
  internal: 'internal',
}

// Fabrique le corps JSON d'une erreur, avec le message dans la langue demandée.
const errorBody = (language: Language, code: ErrorCode): ErrorResponse => ({
  error: { code, message: resources[language].translation.errors[errorMessages[code]] },
})

// Langue de la requête. `??` signifie « sinon » : si la langue n'a pas encore été calculée
// (cas d'une erreur très précoce), on la recalcule à partir de l'en-tête.
const languageOf = (c: Context<AppEnv>): Language =>
  c.get('language') ?? resolveLanguage(parseAcceptLanguage(c.req.header('accept-language')))

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

export const createApp = ({ version }: AppOptions) => {
  const app = new OpenAPIHono<AppEnv>()

  // Un « middleware » est une fonction exécutée pour chaque requête, avant (et après) la route.
  // secureHeaders ajoute des en-têtes de sécurité standards : interdiction d'afficher le site
  // dans une iframe étrangère, obligation du HTTPS, etc.
  app.use(secureHeaders())

  // Middleware maison : détermine la langue de la requête et l'annonce dans la réponse.
  app.use(async (c, next) => {
    const language = resolveLanguage(parseAcceptLanguage(c.req.header('accept-language')))
    c.set('language', language)
    await next() // on laisse la route s'exécuter…
    c.header('Content-Language', language) // …puis on complète la réponse
  })

  // La route elle-même : `as const` garantit que status vaut exactement 'ok', comme l'exige le schéma.
  app.openapi(healthRoute, (c) => c.json({ status: 'ok' as const, version }, 200))

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
