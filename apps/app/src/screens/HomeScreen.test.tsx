import { fireEvent, render, screen } from '@testing-library/react-native'
import { I18nextProvider } from 'react-i18next'
import { createI18n } from '../i18n'
import { HomeScreen } from './HomeScreen'

const renderHome = (language: 'fr' | 'en') =>
  render(
    <I18nextProvider i18n={createI18n(language)}>
      <HomeScreen />
    </I18nextProvider>,
  )

describe('HomeScreen', () => {
  it('welcomes the visitor in French by default', async () => {
    await renderHome('fr')

    expect(screen.getByText('Bienvenue sur Ruche')).toBeTruthy()
    expect(screen.getByText('Le fil arrive bientôt.')).toBeTruthy()
  })

  it('welcomes the visitor in English when that is their language', async () => {
    await renderHome('en')

    expect(screen.getByText('Welcome to Ruche')).toBeTruthy()
  })

  it('lets the visitor switch language', async () => {
    await renderHome('fr')

    await fireEvent.press(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByText('Welcome to Ruche')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'English', selected: true })).toBeTruthy()
  })
})
