// Middleware de session : pour chaque requête, retrouve le membre connecté grâce au cookie
// (ou au jeton envoyé par l'appli mobile) et le range dans c.var.user.
// Les routes n'ont plus qu'à regarder c.get('user') : null veut dire « personne de connecté ».
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types'
import type { Auth } from './auth'

export const sessionMiddleware =
  (auth: Auth): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    // Better Auth vérifie la signature du cookie et l'expiration de la session dans la base.
    const result = await auth.api.getSession({ headers: c.req.raw.headers })
    c.set('user', result?.user ?? null)
    c.set('session', result?.session ?? null)
    await next()
  }
