// Test de l'écran d'accueil avec Testing Library : on affiche l'écran en mémoire,
// puis on le manipule comme le ferait un utilisateur (lire un texte, appuyer sur un bouton).
// On cherche les éléments par ce que l'utilisateur voit (texte, rôle), pas par leur code interne.
import { fireEvent, screen } from '@testing-library/react-native'
import { mockSession, renderWithI18n } from '../testing/render'
import { HomeScreen } from './HomeScreen'

// Le choix de la langue enregistre la langue sur le compte : on remplace aussi ces appels.
jest.mock('../profile/api', () => ({ getMe: jest.fn(), updateProfile: jest.fn() }))
jest.mock('../accounts/api', () => ({ useSession: jest.fn() }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }))

beforeEach(() => {
  mockSession(null)
  mockPush.mockReset()
})

describe('HomeScreen', () => {
  it('welcomes the visitor in French by default', async () => {
    await renderWithI18n(<HomeScreen />)

    expect(screen.getByText('Bienvenue sur Ruche')).toBeTruthy()
    expect(screen.getByText('Le fil arrive bientôt.')).toBeTruthy()
  })

  it('welcomes the visitor in English when that is their language', async () => {
    await renderWithI18n(<HomeScreen />, 'en')

    expect(screen.getByText('Welcome to Ruche')).toBeTruthy()
  })

  it('lets the visitor switch language', async () => {
    await renderWithI18n(<HomeScreen />)

    await fireEvent.press(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByText('Welcome to Ruche')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'English', selected: true })).toBeTruthy()
  })

  it('invites a visitor to create an account or sign in', async () => {
    await renderWithI18n(<HomeScreen />)

    await fireEvent.press(screen.getByRole('button', { name: 'Créer un compte' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }))

    expect(mockPush).toHaveBeenNthCalledWith(1, '/sign-up')
    expect(mockPush).toHaveBeenNthCalledWith(2, '/sign-in')
  })

  it('greets a signed-in member by name and leads to the account page', async () => {
    mockSession({ user: { name: 'Léa' } })
    await renderWithI18n(<HomeScreen />)

    expect(screen.getByText('Bonjour Léa !')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Créer un compte' })).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Mon compte' }))
    expect(mockPush).toHaveBeenCalledWith('/account')
  })

  it('invites a signed-in member to publish a project', async () => {
    mockSession({ user: { name: 'Léa' } })
    await renderWithI18n(<HomeScreen />)

    await fireEvent.press(screen.getByRole('button', { name: 'Publier un projet' }))

    expect(mockPush).toHaveBeenCalledWith('/projects/new')
  })
})
