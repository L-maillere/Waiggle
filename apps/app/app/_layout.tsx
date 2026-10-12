import { defaultLanguage } from '@ruche/i18n'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import { Platform } from 'react-native'
import { createI18n, detectLanguage } from '../src/i18n'

const isWeb = Platform.OS === 'web'

export default function RootLayout() {
  // On the web, pages are pre-rendered in French and switch to the visitor's language once loaded,
  // so the server-rendered HTML and the first client render match.
  const [i18n] = useState(() => createI18n(isWeb ? defaultLanguage : detectLanguage()))

  useEffect(() => {
    if (!isWeb) return
    const apply = (language: string) => {
      document.documentElement.lang = language
    }
    i18n.on('languageChanged', apply)
    void i18n.changeLanguage(detectLanguage())
    apply(i18n.language)
    return () => i18n.off('languageChanged', apply)
  }, [i18n])

  return (
    <I18nextProvider i18n={i18n}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </I18nextProvider>
  )
}
