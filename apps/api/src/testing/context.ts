// Outils partagés par les tests de l'API : une API complète, branchée sur une base PGlite neuve
// et une fausse boîte d'envoi d'e-mails. Rien ici n'est utilisé en production.
import { createPgliteDb } from '@ruche/db/pglite'
import { createApp } from '../app'
import { createAuth } from '../auth/auth'
import { createMemoryMailer } from '../email/mailer'

export const TEST_APP_URL = 'http://localhost:8081'
export const TEST_API_URL = 'http://localhost:3000'

type Credentials = { email: string; password: string }
type SignUpBody = Credentials & { name: string; language?: string }

export const createTestContext = async ({ version = 'test' }: { version?: string } = {}) => {
  const { db, close } = await createPgliteDb()
  const mailer = createMemoryMailer()
  const auth = createAuth({
    db,
    mailer,
    secret: 'test-secret-that-is-long-enough-for-tests',
    publicApiUrl: TEST_API_URL,
    appUrl: TEST_APP_URL,
    rateLimit: true,
  })
  const app = createApp({ version, auth, db, appUrl: TEST_APP_URL })

  /**
   * Envoie une requête à l'API, comme si elle venait de l'appli web (en-tête Origin)
   * et d'un visiteur précis (adresse IP fixe, transmise par Caddy en production).
   */
  const request = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (!headers.has('origin')) headers.set('origin', TEST_APP_URL)
    if (!headers.has('x-real-ip')) headers.set('x-real-ip', '203.0.113.7')
    return app.request(path, { ...init, headers })
  }

  const postJson = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })

  return {
    app,
    db,
    mailer,
    auth,
    request,
    close,
    /** Inscription par e-mail ; le lien de vérification ramènera vers la page /verified de l'appli. */
    signUp: (body: SignUpBody, headers?: Record<string, string>) =>
      postJson(
        '/api/auth/sign-up/email',
        { ...body, callbackURL: `${TEST_APP_URL}/verified` },
        headers,
      ),
    signIn: ({ email, password }: Credentials) =>
      postJson('/api/auth/sign-in/email', { email, password }),
    /** Transforme les cookies posés par une réponse en en-tête `cookie` pour les requêtes suivantes. */
    cookiesFrom: (res: Response) =>
      res.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; '),
  }
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>
