// Outils partagés par les tests d'écrans : affiche un écran avec les traductions branchées.
import { render } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { useSession } from '../accounts/api'
import { createI18n } from '../i18n'

export const renderWithI18n = (ui: ReactElement, language: 'fr' | 'en' = 'fr') =>
  render(<I18nextProvider i18n={createI18n(language)}>{ui}</I18nextProvider>)

/**
 * Fait croire aux écrans qu'un membre est connecté (ou personne, avec null).
 * À utiliser dans un fichier de test qui remplace '../accounts/api' par jest.mock.
 * Le « as unknown as » force le type : on ne fournit que les champs utiles au test.
 */
export const mockSession = (data: { user: Record<string, unknown> } | null, isPending = false) =>
  jest
    .mocked(useSession)
    .mockReturnValue({ data, isPending } as unknown as ReturnType<typeof useSession>)
