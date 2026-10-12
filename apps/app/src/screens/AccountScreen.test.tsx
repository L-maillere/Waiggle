import { fireEvent, screen } from '@testing-library/react-native'
import { deleteAccount, signOut } from '../accounts/api'
import { mockSession, renderWithI18n } from '../testing/render'
import { AccountScreen } from './AccountScreen'

// Le choix de la langue enregistre la langue sur le compte : on remplace aussi ces appels.
jest.mock('../profile/api', () => ({ getMe: jest.fn(), updateProfile: jest.fn() }))
jest.mock('../accounts/api', () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
  deleteAccount: jest.fn(),
  downloadMyData: jest.fn(),
}))
const mockReplace = jest.fn()
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }))

const lea = { user: { name: 'Léa', email: 'lea@example.com' } }

beforeEach(() => {
  mockSession(lea)
  jest.mocked(deleteAccount).mockReset()
  jest.mocked(signOut).mockReset()
  mockReplace.mockReset()
})

describe('AccountScreen', () => {
  it('shows who is signed in', async () => {
    await renderWithI18n(<AccountScreen />)

    expect(screen.getByText('Léa')).toBeTruthy()
    expect(screen.getByText('lea@example.com')).toBeTruthy()
  })

  it('leads to the profile page', async () => {
    await renderWithI18n(<AccountScreen />)

    await fireEvent.press(screen.getByRole('button', { name: 'Modifier mon profil' }))

    expect(mockPush).toHaveBeenCalledWith('/profile')
  })

  it('offers to choose the language', async () => {
    await renderWithI18n(<AccountScreen />)

    expect(screen.getByRole('button', { name: 'English' })).toBeTruthy()
    expect(screen.getByText('Tes e-mails te sont aussi envoyés dans cette langue.')).toBeTruthy()
  })

  it('signs out and goes back home', async () => {
    jest.mocked(signOut).mockResolvedValue(undefined)
    await renderWithI18n(<AccountScreen />)

    await fireEvent.press(screen.getByRole('button', { name: 'Me déconnecter' }))

    expect(signOut).toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('keeps the account and says so when the password is wrong', async () => {
    jest.mocked(deleteAccount).mockResolvedValue({ ok: false, error: 'wrongPassword' })
    await renderWithI18n(<AccountScreen />)

    await fireEvent.changeText(screen.getByLabelText('Confirme avec ton mot de passe'), 'nope')
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    expect(deleteAccount).toHaveBeenCalledWith('nope')
    expect(screen.getByText('Mot de passe incorrect.')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('deletes the account once the password is confirmed, then goes home', async () => {
    jest.mocked(deleteAccount).mockResolvedValue({ ok: true })
    await renderWithI18n(<AccountScreen />)

    await fireEvent.changeText(
      screen.getByLabelText('Confirme avec ton mot de passe'),
      'correct-horse-battery',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('cannot delete without typing the password first', async () => {
    await renderWithI18n(<AccountScreen />)

    expect(screen.getByRole('button', { name: 'Supprimer définitivement' })).toBeDisabled()
  })
})
