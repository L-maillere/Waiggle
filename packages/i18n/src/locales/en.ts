import type { Translation } from '../types'

// Textes anglais. Le type `Translation` (calqué sur le français) oblige à fournir exactement
// les mêmes clés : en oublier une ou en ajouter une de trop empêche la compilation.
export const en: Translation = {
  common: {
    appName: 'Ruche',
    language: 'Language',
    languages: {
      fr: 'Français',
      en: 'English',
    },
  },
  home: {
    title: 'Welcome to {{appName}}',
    tagline:
      'Share your AI projects, try the ones your friends and family build, and keep each other going.',
    comingSoon: 'The feed is coming soon.',
  },
  errors: {
    notFound: 'This page does not exist.',
    validation: 'Some information is invalid.',
    internal: 'Something went wrong.',
  },
}
