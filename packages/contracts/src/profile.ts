// Formes des données du profil : ce qu'un membre peut modifier, et les règles des avatars.
import { z } from 'zod'
import { LanguageSchema } from './accounts'

export const NAME_MAX_LENGTH = 80
export const BIO_MAX_LENGTH = 280
export const FAVORITE_TOOLS_MAX = 10
export const TOOL_MAX_LENGTH = 40

// Avatars : formats acceptés et taille maximale du fichier envoyé (5 Mo).
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

// Retire les doublons sans tenir compte des majuscules : ['Claude', 'claude'] → ['Claude'].
const withoutDuplicates = (tools: string[]) =>
  tools.filter(
    (tool, index) => tools.findIndex((t) => t.toLowerCase() === tool.toLowerCase()) === index,
  )

/**
 * Ce que PATCH /v1/me accepte. Tous les champs sont facultatifs : on n'envoie que ce qui change.
 * strictObject refuse tout champ inconnu : impossible de glisser par exemple "email" ou "emailVerified"
 * dans la requête pour modifier ce qui ne doit pas l'être.
 */
export const ProfileUpdate = z
  .strictObject({
    name: z.string().trim().min(1).max(NAME_MAX_LENGTH).optional(),
    bio: z.string().trim().max(BIO_MAX_LENGTH).optional(),
    favoriteTools: z
      .array(z.string().trim().min(1).max(TOOL_MAX_LENGTH))
      .max(FAVORITE_TOOLS_MAX)
      .transform(withoutDuplicates) // transform : Zod modifie la valeur après l'avoir validée
      .optional(),
    language: LanguageSchema.optional(),
  })
  .meta({ id: 'ProfileUpdate' })
export type ProfileUpdate = z.infer<typeof ProfileUpdate>
