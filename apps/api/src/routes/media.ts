// Service des fichiers stockés (pour l'instant, les avatars) : GET /media/avatars/<nom>.webp
// Les avatars sont publics : n'importe qui peut afficher la photo d'un membre, comme sur tout
// réseau social. Leur nom aléatoire ne se devine pas, et un nouveau nom est tiré à chaque envoi.
import { Hono } from 'hono'
import { errorBody, languageOf } from '../errors'
import { type FileStorage, isValidKey } from '../media/storage'
import type { AppEnv } from '../types'

export const mediaRoutes = (storage: FileStorage) => {
  const app = new Hono<AppEnv>()

  app.get('/media/avatars/:file', async (c) => {
    const key = `avatars/${c.req.param('file')}`
    // Nom invalide (« ../ », mauvaise extension…) ou fichier absent : 404, sans autre détail.
    const data = isValidKey(key) ? await storage.get(key) : null
    if (!data) return c.json(errorBody(languageOf(c), 'not_found'), 404)

    // new Uint8Array(…) : copie dans un tableau d'octets du type exact attendu par Hono.
    return c.body(new Uint8Array(data), 200, {
      'Content-Type': 'image/webp',
      // Le fichier ne changera jamais (un nouvel avatar = un nouveau nom) : le navigateur peut
      // le garder un an en cache sans redemander.
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
  })

  return app
}
