// Tests de l'écran d'inscription. On remplace (« mock ») le module qui parle à l'API par de faux
// appels : on teste l'écran seul, sans réseau, et on décide nous-mêmes de la réponse de l'API.
import { fireEvent, screen } from '@testing-library/react-native'
import { signUp } from '../accounts/api'
import { renderWithI18n } from '../testing/render'
import { SignUpScreen } from './SignUpScreen'

jest.mock('../accounts/api', () => ({ signUp: jest.fn() }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }))

// jest.mocked donne le bon type au faux appel pour lui dicter sa réponse.
const signUpMock = jest.mocked(signUp)

const fillForm = async (password = 'correct-horse-battery') => {
  await fireEvent.changeText(screen.getByLabelText('Prénom ou pseudo'), 'Léa')
  await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'lea@example.com')
  await fireEvent.changeText(screen.getByLabelText('Mot de passe'), password)
  await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }))
}

beforeEach(() => {
  signUpMock.mockReset()
  mockPush.mockReset()
})

describe('SignUpScreen', () => {
  it('counts down the characters the password still needs', async () => {
    await renderWithI18n(<SignUpScreen />)
    expect(screen.getByLabelText('Encore 12 caractères')).toBeTruthy()

    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'abeilles-d')
    expect(screen.getByLabelText('Encore 2 caractères')).toBeTruthy()

    await fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'abeilles-dor')
    expect(screen.getByLabelText('C’est bon, ton mot de passe est assez long.')).toBeTruthy()
  })

  it('shows the password on request, then hides it again', async () => {
    await renderWithI18n(<SignUpScreen />)
    const field = screen.getByLabelText('Mot de passe')
    expect(field.props.secureTextEntry).toBe(true)

    await fireEvent.press(screen.getByRole('button', { name: 'Afficher le mot de passe' }))
    const shown = screen.getByLabelText('Mot de passe')
    expect(shown.props.secureTextEntry).toBe(false)
    // Même affiché, il ne part ni au correcteur orthographique ni au dictionnaire du clavier.
    expect(shown.props.autoCorrect).toBe(false)
    expect(shown.props.spellCheck).toBe(false)

    await fireEvent.press(screen.getByRole('button', { name: 'Masquer le mot de passe' }))
    expect(screen.getByLabelText('Mot de passe').props.secureTextEntry).toBe(true)
  })

  it('explains the problem and sends nothing when the password is too short', async () => {
    await renderWithI18n(<SignUpScreen />)

    await fillForm('short')

    expect(screen.getByText('Le mot de passe doit faire au moins 12 caractères.')).toBeTruthy()
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('creates the account in the member language, then asks to check the inbox', async () => {
    signUpMock.mockResolvedValue({ ok: true })
    await renderWithI18n(<SignUpScreen />)

    await fillForm()

    expect(signUpMock).toHaveBeenCalledWith({
      name: 'Léa',
      email: 'lea@example.com',
      password: 'correct-horse-battery',
      language: 'fr',
    })
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/check-email',
      params: { email: 'lea@example.com' },
    })
  })

  it('tells the visitor to wait after too many attempts', async () => {
    signUpMock.mockResolvedValue({ ok: false, error: 'tooManyAttempts' })
    await renderWithI18n(<SignUpScreen />)

    await fillForm()

    expect(screen.getByText('Trop de tentatives. Réessaie dans quelques minutes.')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
