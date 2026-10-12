import type { fr } from './locales/fr'

type DeepString<T> = { readonly [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> }

/**
 * Shape every language must follow: French is the reference, so a key missing from (or added to)
 * another language is a compile-time error, on top of the runtime test.
 */
export type Translation = DeepString<typeof fr>
