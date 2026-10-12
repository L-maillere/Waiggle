// Mise en place des traductions dans l'appli, avec la bibliothèque i18next.
// Les textes eux-mêmes viennent du paquet partagé @ruche/i18n.
import {
  defaultLanguage,
  type Language,
  resolveLanguage,
  resources,
  supportedLanguages,
} from '@ruche/i18n'
import { getLocales } from 'expo-localization'
import i18next, { type i18n } from 'i18next'
import { initReactI18next } from 'react-i18next'

/** Langue de l'appareil si on la gère, le français sinon. */
export const detectLanguage = (): Language =>
  // getLocales() renvoie les langues réglées sur le téléphone ou le navigateur, préférée en premier.
  resolveLanguage(getLocales().map((locale) => locale.languageTag))

/**
 * Crée une instance i18next prête à l'emploi (une pour l'appli, une par test).
 * Une instance neuve à chaque fois évite qu'un test change la langue d'un autre test.
 */
export const createI18n = (language: Language = detectLanguage()): i18n => {
  const instance = i18next.createInstance()
  // `void` indique qu'on ignore volontairement la promesse renvoyée par init :
  // avec initAsync: false et des textes déjà chargés, l'initialisation est immédiate.
  void instance.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: defaultLanguage, // texte manquant dans une langue → on affiche le français
    supportedLngs: [...supportedLanguages],
    interpolation: { escapeValue: false }, // React protège déjà l'affichage, pas besoin d'échapper deux fois
    initAsync: false,
  })
  return instance
}
