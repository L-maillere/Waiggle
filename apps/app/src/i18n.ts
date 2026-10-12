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

/** Language of the device, if we support it; French otherwise. */
export const detectLanguage = (): Language =>
  resolveLanguage(getLocales().map((locale) => locale.languageTag))

/** A fresh, synchronously initialised i18next instance (one per app, one per test). */
export const createI18n = (language: Language = detectLanguage()): i18n => {
  const instance = i18next.createInstance()
  void instance.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: defaultLanguage,
    supportedLngs: [...supportedLanguages],
    interpolation: { escapeValue: false },
    initAsync: false,
  })
  return instance
}
