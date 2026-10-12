import { en } from './locales/en'
import { fr } from './locales/fr'

export type { Translation } from './types'

export const supportedLanguages = ['fr', 'en'] as const
export type Language = (typeof supportedLanguages)[number]
export const defaultLanguage: Language = 'fr'

/** Resources in the shape i18next expects. */
export const resources = {
  fr: { translation: fr },
  en: { translation: en },
} as const

const isLanguage = (value: string): value is Language =>
  (supportedLanguages as readonly string[]).includes(value)

/**
 * Picks the first supported language from a list of preferences (most preferred first),
 * e.g. the device locales or a parsed Accept-Language header. "en-US" matches "en".
 */
export const resolveLanguage = (preferences: readonly string[]): Language => {
  for (const preference of preferences) {
    const base = preference.trim().toLowerCase().split('-')[0] ?? ''
    if (isLanguage(base)) return base
  }
  return defaultLanguage
}

/**
 * Turns an Accept-Language header into language tags, most preferred first.
 * Tags refused with q=0 and the "*" wildcard are dropped.
 */
export const parseAcceptLanguage = (header: string | undefined | null): string[] => {
  if (!header) return []
  return header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';')
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const quality = qParam ? Number.parseFloat(qParam.slice(2)) : 1
      return { tag: tag.trim(), quality: Number.isNaN(quality) ? 0 : quality, index }
    })
    .filter(({ tag, quality }) => tag !== '' && tag !== '*' && quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map(({ tag }) => tag)
}
