// Tests de la page d'un projet. L'API (projects/api) est remplacée par de faux appels.
import { fireEvent, screen } from '@testing-library/react-native'
import { ApiError } from '../api/errors'
import { deleteProject, getProject } from '../projects/api'
import { recipesProject } from '../testing/projects'
import { mockSession, renderWithProviders } from '../testing/render'
import { ProjectScreen } from './ProjectScreen'

jest.mock('../accounts/api', () => ({ useSession: jest.fn() }))
// La barre de navigation (ordinateur) lit le profil pour l'avatar : on remplace l'appel.
jest.mock('../profile/api', () => ({ getMe: jest.fn() }))
jest.mock('../projects/api', () => ({ getProject: jest.fn(), deleteProject: jest.fn() }))
const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
}))

const { id } = recipesProject

beforeEach(() => {
  mockSession({ user: { id: 'u1', name: 'Léa' } })
  jest.mocked(getProject).mockReset().mockResolvedValue(recipesProject)
  jest.mocked(deleteProject).mockReset()
  mockPush.mockReset()
  mockReplace.mockReset()
})

describe('ProjectScreen', () => {
  it('shows the project with its recipe', async () => {
    await renderWithProviders(<ProjectScreen id={id} />)

    expect(await screen.findByRole('header', { name: 'Mon agent de recettes' })).toBeTruthy()
    expect(screen.getByText('Un menu avec ce qu’il y a au frigo.')).toBeTruthy()
    expect(screen.getByText('Léa')).toBeTruthy()
    expect(screen.getByText('Testable')).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Comment ça marche' })).toBeTruthy() // la description
    expect(screen.getByText('Claude Code')).toBeTruthy()
    expect(screen.getByText('Un week-end')).toBeTruthy()
    expect(screen.getByText('Propose trois recettes avec : {ingrédients}')).toBeTruthy()
  })

  it('opens the demo through the warning page', async () => {
    await renderWithProviders(<ProjectScreen id={id} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Tester la démo' }))

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/out',
      params: { url: 'https://recettes.vercel.app' },
    })
  })

  it('says when there is no demo yet', async () => {
    jest.mocked(getProject).mockResolvedValue({ ...recipesProject, demoUrl: null })
    await renderWithProviders(<ProjectScreen id={id} />)

    expect(await screen.findByText('Pas encore de démo')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tester la démo' })).toBeNull()
  })

  it('tells the author when the project is private', async () => {
    jest.mocked(getProject).mockResolvedValue({ ...recipesProject, visibility: 'private' })
    await renderWithProviders(<ProjectScreen id={id} />)

    expect(await screen.findByText('Privé : visible par toi seulement')).toBeTruthy()
  })

  it('lets the author edit the project', async () => {
    await renderWithProviders(<ProjectScreen id={id} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Modifier' }))

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/projects/[id]/edit', params: { id } })
  })

  it('offers neither edit nor delete to another member', async () => {
    jest.mocked(getProject).mockResolvedValue({ ...recipesProject, isMine: false })
    await renderWithProviders(<ProjectScreen id={id} />)

    await screen.findByRole('header', { name: 'Mon agent de recettes' })
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).toBeNull()
  })

  it('deletes nothing when the author changes their mind', async () => {
    await renderWithProviders(<ProjectScreen id={recipesProject.id} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Supprimer' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }))

    expect(deleteProject).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Supprimer le projet' })).toBeNull()
  })

  it('deletes the project once the author confirms, then goes home', async () => {
    jest.mocked(deleteProject).mockResolvedValue({ ok: true, data: null })
    await renderWithProviders(<ProjectScreen id={id} />)

    await fireEvent.press(await screen.findByRole('button', { name: 'Supprimer' }))
    expect(deleteProject).not.toHaveBeenCalled() // il faut d'abord confirmer
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer le projet' }))

    expect(deleteProject).toHaveBeenCalledWith(id)
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('says the project cannot be found, without telling whether it is private', async () => {
    jest.mocked(getProject).mockRejectedValue(new ApiError('notFound'))
    await renderWithProviders(<ProjectScreen id={id} />)

    expect(await screen.findByRole('header', { name: 'Ce projet est introuvable' })).toBeTruthy()
  })

  it('asks a visitor to sign in', async () => {
    mockSession(null)
    await renderWithProviders(<ProjectScreen id={id} />)

    expect(screen.getByText('Connecte-toi pour continuer.')).toBeTruthy()
    expect(getProject).not.toHaveBeenCalled()
  })
})
