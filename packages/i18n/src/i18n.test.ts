// Tests du paquet de traductions.
// Vitest fournit trois briques : `describe` regroupe des tests, `it` décrit un comportement
// attendu, `expect(valeur)` vérifie ce comportement (toBe, toEqual…).
import { describe, expect, it } from 'vitest'
import { defaultLanguage, parseAcceptLanguage, resolveLanguage, resources } from './index'

// Un arbre de traductions : chaque valeur est soit un texte, soit un sous-arbre.
type Tree = { [key: string]: string | Tree }

// Aplatit l'arbre en une liste « chemin → texte », par exemple :
// { home: { title: 'Bienvenue' } }  →  { 'home.title': 'Bienvenue' }
// C'est plus simple à comparer d'une langue à l'autre.
const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') acc[path] = value
    else Object.assign(acc, flatten(value, path)) // sous-arbre : on descend d'un niveau
    return acc
  }, {})

// Extrait les paramètres d'un texte : 'Bienvenue sur {{appName}}' → ['appName'].
// Si l'anglais oubliait {{appName}}, le nom de l'appli disparaîtrait de l'écran.
const placeholders = (text: string) =>
  [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort()

describe('translations', () => {
  const fr = flatten(resources.fr.translation)
  const en = flatten(resources.en.translation)

  it('has exactly the same keys in French and English', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort())
  })

  it('has no empty text', () => {
    for (const [key, text] of [...Object.entries(fr), ...Object.entries(en)]) {
      // Le second argument d'expect est le message affiché si le test échoue.
      expect(text.trim(), `empty text for ${key}`).not.toBe('')
    }
  })

  it('uses the same placeholders in both languages', () => {
    for (const key of Object.keys(fr)) {
      expect(placeholders(en[key] ?? ''), `placeholders differ for ${key}`).toEqual(
        placeholders(fr[key] ?? ''),
      )
    }
  })
})

describe('resolveLanguage', () => {
  it('falls back to French when nothing is preferred', () => {
    expect(resolveLanguage([])).toBe(defaultLanguage)
    expect(defaultLanguage).toBe('fr')
  })

  it('matches a regional variant to its base language', () => {
    expect(resolveLanguage(['en-US'])).toBe('en')
    expect(resolveLanguage(['fr-CA'])).toBe('fr')
  })

  it('keeps the first supported language in order of preference', () => {
    expect(resolveLanguage(['de-DE', 'en-GB', 'fr'])).toBe('en')
  })

  it('ignores case', () => {
    expect(resolveLanguage(['EN'])).toBe('en')
  })

  it('falls back to French when no preference is supported', () => {
    expect(resolveLanguage(['de', 'es-ES'])).toBe('fr')
  })
})

describe('parseAcceptLanguage', () => {
  // L'en-tête Accept-Language est envoyé par chaque navigateur, par exemple :
  // "en-US,en;q=0.9,fr;q=0.8" = « anglais américain, sinon anglais (90 %), sinon français (80 %) ».
  it('returns nothing for a missing or empty header', () => {
    expect(parseAcceptLanguage(undefined)).toEqual([])
    expect(parseAcceptLanguage('')).toEqual([])
  })

  it('orders languages by quality, keeping header order on ties', () => {
    expect(parseAcceptLanguage('en-US,en;q=0.9,fr;q=0.8')).toEqual(['en-US', 'en', 'fr'])
    expect(parseAcceptLanguage('fr;q=0.5, en;q=0.9')).toEqual(['en', 'fr'])
  })

  it('drops languages explicitly refused with q=0 and the wildcard', () => {
    expect(parseAcceptLanguage('en;q=0, fr, *;q=0.1')).toEqual(['fr'])
  })
})
