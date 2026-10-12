// Le « facteur » de l'appli : toutes les requêtes vers l'API de Ruche (/v1/…) passent par ici.
// Il ajoute la session du membre, puis traduit la réponse en résultat simple pour les écrans :
// { ok: true, data } quand tout va bien, { ok: false, error } avec la clé du message sinon.
import { Platform } from 'react-native'
import { authClient } from '../accounts/auth-client'
import { apiUrl } from '../config'
import { type ApiResult, errorKeyForStatus } from './errors'

/**
 * Envoie une requête à l'API avec la session du membre.
 * - Sur le web, le navigateur joint lui-même le cookie de session (credentials: 'include').
 * - Sur mobile, pas de cookies de navigateur : on ajoute celui gardé par le plugin Expo.
 */
export const apiFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers)
  if (Platform.OS !== 'web') {
    const cookie = await authClient.getCookie()
    if (cookie) headers.set('Cookie', cookie)
  }
  return fetch(`${apiUrl}${path}`, { ...init, headers, credentials: 'include' })
}

// La partie d'un schéma Zod dont on a besoin : safeParse. Décrire seulement cette forme évite que
// l'appli dépende directement de la bibliothèque Zod (elle utilise les schémas de @ruche/contracts).
type Schema<T> = { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }

/**
 * Envoie une requête et vérifie la réponse avec un schéma de @ruche/contracts.
 * Si la réponse n'a pas la forme attendue (API d'une autre version, par exemple), on le signale
 * comme une erreur plutôt que d'afficher des données incomplètes.
 */
export const request = async <T>(
  path: string,
  init: RequestInit,
  schema: Schema<T>,
): Promise<ApiResult<T>> => {
  let res: Response
  try {
    res = await apiFetch(path, init)
  } catch {
    // fetch ne lève une erreur que si le serveur est injoignable (pas de réseau, API arrêtée).
    return { ok: false, error: 'network' }
  }
  if (!res.ok) return { ok: false, error: errorKeyForStatus(res.status) }
  const parsed = schema.safeParse(await res.json().catch(() => null))
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: 'internal' }
}
