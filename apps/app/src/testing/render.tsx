// Outils partagés par les tests d'écrans : affiche un écran avec tout ce dont il a besoin autour
// (traductions, cache des données de l'API), comme dans la vraie appli.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { useSession } from '../accounts/api'
import { createI18n } from '../i18n'

/**
 * Affiche un écran dans une langue donnée. Renvoie aussi l'instance i18n et le cache de requêtes
 * (neufs à chaque test), pour que le test puisse les inspecter.
 */
export const renderWithProviders = async (ui: ReactElement, language: 'fr' | 'en' = 'fr') => {
  const i18n = createI18n(language)
  // retry: false : en test, une requête qui échoue ne doit pas être retentée trois fois.
  const queryClient = new QueryClient({
    // gcTime: Infinity : pas de minuterie de nettoyage du cache, qui empêcherait Jest de s'arrêter.
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
  const result = await render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
    </QueryClientProvider>,
  )
  return { ...result, i18n, queryClient }
}

/** Ancien nom, gardé pour les tests de la tranche 1. */
export const renderWithI18n = renderWithProviders

/**
 * Fait croire aux écrans qu'un membre est connecté (ou personne, avec null).
 * À utiliser dans un fichier de test qui remplace '../accounts/api' par jest.mock.
 * Le « as unknown as » force le type : on ne fournit que les champs utiles au test.
 * Renvoie la fausse fonction refetch (relire la session), pour vérifier qu'elle a été appelée.
 */
export const mockSession = (data: { user: Record<string, unknown> } | null, isPending = false) => {
  const refetch = jest.fn().mockResolvedValue(undefined)
  jest
    .mocked(useSession)
    .mockReturnValue({ data, isPending, refetch } as unknown as ReturnType<typeof useSession>)
  return { refetch }
}
