// Routes du membre connecté : son profil (GET /v1/me) et l'export de ses données
// (GET /v1/me/export). Les deux exigent d'être connecté.
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { AccountExport, ErrorResponse, Me } from '@ruche/contracts'
import { type Database, schema } from '@ruche/db'
import { defaultLanguage, type Language, supportedLanguages } from '@ruche/i18n'
import { eq } from 'drizzle-orm'
import { errorBody, languageOf } from '../errors'
import type { AppEnv, AuthUser } from '../types'

// Réponse commune aux routes qui exigent une connexion.
const unauthorizedResponse = {
  description: 'Not signed in.',
  content: { 'application/json': { schema: ErrorResponse } },
}

const meRoute = createRoute({
  method: 'get',
  path: '/v1/me',
  summary: 'The signed-in member',
  responses: {
    200: { description: 'The profile.', content: { 'application/json': { schema: Me } } },
    401: unauthorizedResponse,
  },
})

const exportRoute = createRoute({
  method: 'get',
  path: '/v1/me/export',
  summary: 'Download all my data (GDPR right of access)',
  responses: {
    200: {
      description: 'Everything Ruche stores about the member, without secrets.',
      content: { 'application/json': { schema: AccountExport } },
    },
    401: unauthorizedResponse,
  },
})

const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (supportedLanguages as readonly string[]).includes(value)

// Ne garde du membre que ce que l'appli a le droit de voir, au format du contrat `Me`.
// Les dates sont converties en texte ISO (le JSON ne connaît pas les dates).
const toMe = (user: AuthUser): Me => ({
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  language: isLanguage(user.language) ? user.language : defaultLanguage,
  createdAt: user.createdAt.toISOString(),
})

export const meRoutes = (db: Database) => {
  const app = new OpenAPIHono<AppEnv>()

  app.openapi(meRoute, (c) => {
    const user = c.get('user')
    if (!user) return c.json(errorBody(languageOf(c), 'unauthorized'), 401)
    return c.json(toMe(user), 200)
  })

  app.openapi(exportRoute, async (c) => {
    const user = c.get('user')
    if (!user) return c.json(errorBody(languageOf(c), 'unauthorized'), 401)

    // On choisit les colonnes une par une (select({...})) : impossible d'exporter par erreur
    // l'empreinte du mot de passe ou un jeton, qui ne sont jamais demandés.
    const loginMethods = await db
      .select({ provider: schema.account.providerId, createdAt: schema.account.createdAt })
      .from(schema.account)
      .where(eq(schema.account.userId, user.id))
    const sessions = await db
      .select({
        createdAt: schema.session.createdAt,
        expiresAt: schema.session.expiresAt,
        ipAddress: schema.session.ipAddress,
        userAgent: schema.session.userAgent,
      })
      .from(schema.session)
      .where(eq(schema.session.userId, user.id))

    // Content-Disposition: attachment → le navigateur propose d'enregistrer le fichier.
    c.header('Content-Disposition', 'attachment; filename="ruche-export.json"')
    return c.json(
      {
        exportedAt: new Date().toISOString(),
        user: toMe(user),
        loginMethods: loginMethods.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
        sessions: sessions.map((s) => ({
          ...s,
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
        })),
      },
      200,
    )
  })

  return app
}
