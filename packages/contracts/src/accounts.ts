// Formes des données liées aux comptes : inscription, profil, export.
// L'appli s'en sert pour valider les formulaires avant envoi ; l'API, pour valider ses réponses.
import { supportedLanguages } from '@ruche/i18n'
import { z } from 'zod'

export const LanguageSchema = z.enum(supportedLanguages)

// Règles des mots de passe : 12 caractères minimum (recommandation de l'ANSSI pour un mot de passe
// seul), 128 maximum pour éviter qu'un texte géant ralentisse volontairement le serveur.
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export const Password = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)

export const SignUpRequest = z.object({
  name: z.string().trim().min(1).max(80), // .trim() retire les espaces autour avant de compter
  email: z.email(),
  password: Password,
  language: LanguageSchema.optional(),
})
export type SignUpRequest = z.infer<typeof SignUpRequest>

export const SignInRequest = z.object({
  email: z.email(),
  password: z.string().min(1),
})
export type SignInRequest = z.infer<typeof SignInRequest>

/** Le profil du membre connecté, tel que renvoyé par GET /v1/me. */
export const Me = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    emailVerified: z.boolean(),
    language: LanguageSchema,
    createdAt: z.iso.datetime(), // date au format ISO, par exemple "2026-10-12T08:30:00.000Z"
  })
  .meta({ id: 'Me' })
export type Me = z.infer<typeof Me>

/**
 * L'export des données d'un membre (droit d'accès du RGPD), renvoyé par GET /v1/me/export.
 * Il ne contient jamais de secret : ni mot de passe, ni jeton de session.
 */
export const AccountExport = z
  .object({
    exportedAt: z.iso.datetime(),
    user: Me,
    loginMethods: z.array(z.object({ provider: z.string(), createdAt: z.iso.datetime() })),
    sessions: z.array(
      z.object({
        createdAt: z.iso.datetime(),
        expiresAt: z.iso.datetime(),
        ipAddress: z.string().nullable(),
        userAgent: z.string().nullable(),
      }),
    ),
  })
  .meta({ id: 'AccountExport' })
export type AccountExport = z.infer<typeof AccountExport>
