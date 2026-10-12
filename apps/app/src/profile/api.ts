// Ce que l'appli peut faire avec le profil du membre connecté : le lire, le modifier, changer
// d'avatar. Comme pour accounts/api.ts, les écrans n'appellent que ces fonctions ; les tests les
// remplacent par de faux appels.
import { Me, type ProfileUpdate } from '@ruche/contracts'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { Platform } from 'react-native'
import { request } from '../api/client'
import { ApiError, type ApiResult } from '../api/errors'

/** Lit le profil du membre connecté (GET /v1/me). Lève une ApiError en cas d'échec. */
export const getMe = async (): Promise<Me> => {
  const result = await request('/v1/me', {}, Me)
  if (!result.ok) throw new ApiError(result.error)
  return result.data
}

/** Modifie le profil et/ou la langue (PATCH /v1/me). Renvoie le profil à jour. */
export const updateProfile = (changes: ProfileUpdate): Promise<ApiResult<Me>> =>
  request(
    '/v1/me',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    },
    Me,
  )

/** Une image choisie sur l'appareil, prête à être envoyée. */
export type PickedImage = { uri: string }

// Taille maximale de l'image préparée sur l'appareil avant l'envoi. Le serveur la réduit ensuite à
// 512 px ; envoyer 1 024 px au plus évite de transférer une photo de 8 Mo pour rien.
const PREPARED_MAX_SIDE = 1024

/**
 * Ouvre la galerie de photos et prépare l'image choisie : recadrée en carré au centre, réduite à
 * 1 024 px au plus, enregistrée en JPEG. Renvoie null si le membre annule.
 */
export const pickAvatar = async (): Promise<PickedImage | null> => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true, // iOS et Android proposent de recadrer l'image
    aspect: [1, 1], // … en carré
    quality: 1, // pas de compression ici : on compresse une seule fois, juste après
  })
  const asset = result.canceled ? undefined : result.assets[0]
  if (!asset) return null

  const context = ImageManipulator.manipulate(asset.uri)
  // Recadrage carré au centre. Sur mobile, le membre l'a déjà fait (allowsEditing) ; sur le web,
  // la galerie ne sait pas recadrer : on le fait ici. Le serveur refuse les images trop allongées.
  const side = Math.min(asset.width, asset.height)
  if (asset.width !== asset.height) {
    context.crop({
      originX: Math.floor((asset.width - side) / 2),
      originY: Math.floor((asset.height - side) / 2),
      width: side,
      height: side,
    })
  }
  // Réduction (sans jamais agrandir une petite image).
  if (side > PREPARED_MAX_SIDE) {
    context.resize({ width: PREPARED_MAX_SIDE, height: PREPARED_MAX_SIDE })
  }
  const image = await context.renderAsync()
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 })
  return { uri: saved.uri }
}

/** Envoie l'image comme nouvel avatar (POST /v1/me/avatar, formulaire multipart). */
export const uploadAvatar = async (image: PickedImage): Promise<ApiResult<Me>> => {
  // FormData : l'équivalent d'un formulaire HTML avec un champ fichier.
  const form = new FormData()
  if (Platform.OS === 'web') {
    // Sur le web, l'image est une adresse « blob: » ou « data: » : on récupère son contenu.
    const blob = await (await fetch(image.uri)).blob()
    form.append('avatar', blob, 'avatar.jpg')
  } else {
    // Sur mobile, React Native sait lire le fichier lui-même à partir de son adresse locale.
    // Le « as unknown as Blob » est nécessaire : les types du web ne connaissent pas cette forme.
    form.append('avatar', {
      uri: image.uri,
      name: 'avatar.jpg',
      type: 'image/jpeg',
    } as unknown as Blob)
  }
  // Pas d'en-tête Content-Type ici : fetch le calcule lui-même avec la « frontière » du multipart.
  return request('/v1/me/avatar', { method: 'POST', body: form }, Me)
}
