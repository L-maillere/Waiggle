// Tout ce que l'appli peut faire avec un compte, en un seul endroit.
// Les écrans n'appellent que ces fonctions : ils ne connaissent ni Better Auth, ni l'adresse de
// l'API. Avantage : dans les tests, on remplace ce fichier par de faux appels (jest.mock).
import type { SignInRequest, SignUpRequest } from '@ruche/contracts'
import { Platform, Share } from 'react-native'
import { apiUrl, webAppUrl } from '../config'
import { authClient } from './auth-client'
import { type AuthErrorKey, authErrorKey } from './errors'

/** Résultat d'une action : réussie, ou ratée avec la clé du message à afficher. */
export type Result<E extends string = AuthErrorKey> = { ok: true } | { ok: false; error: E }

// Better Auth renvoie { data, error } au lieu de lever une erreur : on transforme l'erreur
// éventuelle en clé de message.
const toResult = (error: { status: number; code?: string | undefined } | null): Result => {
  if (!error) return { ok: true }
  return { ok: false, error: authErrorKey(error) }
}

/** Le membre connecté (ou null), mis à jour automatiquement : un hook React. */
export const useSession = authClient.useSession

export const signUp = async (input: SignUpRequest): Promise<Result> => {
  const { error } = await authClient.signUp.email({
    ...input,
    // Le lien de l'e-mail ramènera sur cette page de l'appli web une fois l'adresse vérifiée.
    callbackURL: `${webAppUrl}/verified`,
  })
  return toResult(error)
}

export const signIn = async (input: SignInRequest): Promise<Result> => {
  const { error } = await authClient.signIn.email(input)
  return toResult(error)
}

export const signOut = async (): Promise<void> => {
  await authClient.signOut()
}

/** Supprime le compte après vérification du mot de passe par le serveur. */
export const deleteAccount = async (
  password: string,
): Promise<Result<'wrongPassword' | AuthErrorKey>> => {
  const { error } = await authClient.deleteUser({ password })
  if (!error) return { ok: true }
  if (error.code === 'INVALID_PASSWORD') return { ok: false, error: 'wrongPassword' }
  return toResult(error)
}

/**
 * Télécharge l'export des données du membre (GET /v1/me/export).
 * Sur le web : le navigateur enregistre un fichier. Sur mobile : la feuille de partage s'ouvre.
 */
export const downloadMyData = async (): Promise<Result> => {
  const headers = new Headers()
  // Sur mobile, pas de cookie automatique : on ajoute nous-mêmes celui gardé par le plugin Expo.
  if (Platform.OS !== 'web') headers.set('Cookie', await authClient.getCookie())
  const res = await fetch(`${apiUrl}/v1/me/export`, { headers, credentials: 'include' })
  if (!res.ok) return { ok: false, error: authErrorKey({ status: res.status }) }
  const json = await res.text()

  if (Platform.OS === 'web') {
    // Astuce web classique : un lien invisible vers le fichier, sur lequel on « clique ».
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'ruche-export.json'
    link.click()
    URL.revokeObjectURL(url)
  } else {
    await Share.share({ message: json, title: 'ruche-export.json' })
  }
  return { ok: true }
}
