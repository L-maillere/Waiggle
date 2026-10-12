// Mise en page racine de l'appli. Avec Expo Router, chaque fichier du dossier app/ est une page
// (app/index.tsx = la page d'accueil). _layout.tsx enveloppe toutes les pages : c'est l'endroit
// où l'on installe ce qui sert partout : les traductions et le cache des données de l'API.
import { defaultLanguage } from '@ruche/i18n'
import { QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import { Platform } from 'react-native'
import { queryClient } from '../src/api/query-client'
import { createI18n, detectLanguage } from '../src/i18n'
import { LanguageSync } from '../src/profile/LanguageSync'

const isWeb = Platform.OS === 'web'

export default function RootLayout() {
  // Sur le web, les pages sont préparées à l'avance (« pré-rendues ») en français, puis passent à la
  // langue du visiteur une fois chargées. Ainsi le HTML préparé et le premier affichage concordent.
  // useState(() => …) ne crée l'instance qu'une seule fois, au premier affichage.
  const [i18n] = useState(() => createI18n(isWeb ? defaultLanguage : detectLanguage()))

  // useEffect s'exécute après l'affichage : c'est là qu'on peut toucher au navigateur.
  useEffect(() => {
    if (!isWeb) return
    // L'attribut lang de la page aide les lecteurs d'écran et les outils de traduction.
    const apply = (language: string) => {
      document.documentElement.lang = language
    }
    i18n.on('languageChanged', apply)
    void i18n.changeLanguage(detectLanguage())
    apply(i18n.language)
    // La fonction renvoyée « nettoie » : elle se désabonne si la mise en page disparaît.
    return () => i18n.off('languageChanged', apply)
  }, [i18n])

  return (
    // Les « Provider » rendent une ressource disponible à tous les écrans placés à l'intérieur,
    // sans avoir à la passer de main en main : ici le cache de l'API, puis les traductions.
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        {/* Applique la langue enregistrée sur le compte du membre connecté */}
        <LanguageSync />
        <StatusBar style="auto" />
        {/* Stack : navigation en pile, chaque nouvelle page s'empile sur la précédente */}
        <Stack screenOptions={{ headerShown: false }} />
      </I18nextProvider>
    </QueryClientProvider>
  )
}
