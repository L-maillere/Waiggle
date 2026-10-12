import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { ErrorCode, ErrorResponse } from '@ruche/contracts'
import { HealthResponse } from '@ruche/contracts'
import { type Language, parseAcceptLanguage, resolveLanguage, resources } from '@ruche/i18n'
import type { Context } from 'hono'
import { secureHeaders } from 'hono/secure-headers'

type AppEnv = { Variables: { language: Language } }

export type AppOptions = { version: string }

const errorMessages: Record<ErrorCode, 'notFound' | 'validation' | 'internal'> = {
  not_found: 'notFound',
  validation: 'validation',
  internal: 'internal',
}

const errorBody = (language: Language, code: ErrorCode): ErrorResponse => ({
  error: { code, message: resources[language].translation.errors[errorMessages[code]] },
})

const languageOf = (c: Context<AppEnv>): Language =>
  c.get('language') ?? resolveLanguage(parseAcceptLanguage(c.req.header('accept-language')))

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

  app.use(secureHeaders())

  // Language for this request: drives error messages and the Content-Language header.
  app.use(async (c, next) => {
    const language = resolveLanguage(parseAcceptLanguage(c.req.header('accept-language')))
    c.set('language', language)
    await next()
    c.header('Content-Language', language)
  })

  app.openapi(healthRoute, (c) => c.json({ status: 'ok' as const, version }, 200))

  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Ruche API', version },
  })

  app.notFound((c) => {
    const language = languageOf(c)
    c.header('Content-Language', language)
    return c.json(errorBody(language, 'not_found'), 404)
  })

  app.onError((err, c) => {
    console.error(err)
    const language = languageOf(c)
    c.header('Content-Language', language)
    return c.json(errorBody(language, 'internal'), 500)
  })

  return app
}
