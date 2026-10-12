// Fabrication des réponses d'erreur, toujours de la même forme et dans la langue du visiteur.
import type { ErrorCode, ErrorResponse } from '@ruche/contracts'
import { type Language, parseAcceptLanguage, resolveLanguage, resources } from '@ruche/i18n'
import type { Context } from 'hono'
import type { AppEnv } from './types'

// Correspondance entre un code d'erreur (pour les programmes) et sa clé de traduction (pour les humains).
const errorMessages = {
  not_found: 'notFound',
  validation: 'validation',
  unauthorized: 'unauthorized',
  internal: 'internal',
} as const satisfies Record<ErrorCode, string>

/** Le corps JSON d'une erreur, avec le message dans la langue demandée. */
export const errorBody = (language: Language, code: ErrorCode): ErrorResponse => ({
  error: { code, message: resources[language].translation.errors[errorMessages[code]] },
})

// Langue de la requête. `??` signifie « sinon » : si la langue n'a pas encore été calculée
// (cas d'une erreur très précoce), on la recalcule à partir de l'en-tête.
export const languageOf = (c: Context<AppEnv>): Language =>
  c.get('language') ?? resolveLanguage(parseAcceptLanguage(c.req.header('accept-language')))
