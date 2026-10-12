// Tests de la page d'avertissement qui précède l'ouverture d'un site extérieur.
import { fireEvent, screen } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { renderWithProviders } from '../testing/render'
import { LeavingScreen } from './LeavingScreen'

jest.mock('../accounts/api', () => ({ useSession: jest.fn() }))
const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
}))

let openURL: jest.SpyInstance
beforeEach(() => {
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  mockBack.mockReset()
})
afterEach(() => openURL.mockRestore())

describe('LeavingScreen', () => {
  it('shows where the link really leads, then opens it', async () => {
    await renderWithProviders(<LeavingScreen url="https://recettes.vercel.app/demo?x=1" />)

    expect(screen.getByText('https://recettes.vercel.app/demo?x=1')).toBeTruthy()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Continuer vers recettes.vercel.app' }),
    )

    expect(openURL).toHaveBeenCalledWith('https://recettes.vercel.app/demo?x=1')
  })

  it('never opens a link that is not https', async () => {
    await renderWithProviders(<LeavingScreen url="javascript:alert(1)" />)

    expect(
      screen.getByText(
        'Ce lien ne peut pas être ouvert : seules les adresses https sont acceptées.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Continuer/ })).toBeNull()
  })

  it('goes back without opening anything', async () => {
    await renderWithProviders(<LeavingScreen url="https://recettes.vercel.app" />)

    await fireEvent.press(screen.getByRole('button', { name: 'Revenir' }))

    expect(mockBack).toHaveBeenCalled()
    expect(openURL).not.toHaveBeenCalled()
  })
})
