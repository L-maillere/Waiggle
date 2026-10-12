// Tests du formulaire de projet : publier, puis modifier. L'API est remplacée par de faux appels.
import { fireEvent, screen } from '@testing-library/react-native'
import { createProject, getProject, updateProject } from '../projects/api'
import { recipesProject } from '../testing/projects'
import { mockSession, renderWithProviders } from '../testing/render'
import { ProjectFormScreen } from './ProjectFormScreen'

jest.mock('../accounts/api', () => ({ useSession: jest.fn() }))
jest.mock('../projects/api', () => ({
  getProject: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
}))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}))

beforeEach(() => {
  mockSession({ user: { id: 'u1', name: 'Léa' } })
  jest.mocked(getProject).mockReset().mockResolvedValue(recipesProject)
  jest.mocked(createProject).mockReset()
  jest.mocked(updateProject).mockReset()
  mockReplace.mockReset()
})

describe('ProjectFormScreen, publishing', () => {
  it('publishes a project and opens its page', async () => {
    jest.mocked(createProject).mockResolvedValue({ ok: true, data: recipesProject })
    await renderWithProviders(<ProjectFormScreen />)

    await fireEvent.changeText(screen.getByLabelText('Titre'), 'Mon agent de recettes')
    await fireEvent.changeText(screen.getByLabelText('Le pitch, en une phrase'), 'Un menu malin.')
    await fireEvent.press(screen.getByRole('radio', { name: 'Testable' }))
    await fireEvent.press(screen.getByRole('radio', { name: 'Moi seulement' }))
    await fireEvent.changeText(
      screen.getByLabelText('Lien de démo (facultatif)'),
      'https://recettes.vercel.app',
    )
    await fireEvent.changeText(
      screen.getByLabelText('Outils et modèles utilisés'),
      'Claude, Cursor',
    )
    await fireEvent.press(screen.getByRole('radio', { name: 'Un week-end' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter un prompt' }))
    await fireEvent.changeText(screen.getByLabelText('Prompt 1'), 'Propose trois recettes')
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }))

    expect(createProject).toHaveBeenCalledWith({
      title: 'Mon agent de recettes',
      pitch: 'Un menu malin.',
      description: '',
      status: 'testable',
      visibility: 'private',
      demoUrl: 'https://recettes.vercel.app/', // forme standard de l'adresse
      tools: ['Claude', 'Cursor'],
      timeSpent: 'weekend',
      prompts: ['Propose trois recettes'],
    })
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/projects/[id]',
      params: { id: recipesProject.id },
    })
  })

  it('explains what is wrong and sends nothing', async () => {
    await renderWithProviders(<ProjectFormScreen />)

    await fireEvent.changeText(screen.getByLabelText('Lien de démo (facultatif)'), 'http://site.fr')
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }))

    expect(screen.getByText('Donne un titre à ton projet.')).toBeTruthy()
    expect(screen.getByText('Résume ton projet en une phrase.')).toBeTruthy()
    expect(screen.getByText(/Le lien doit commencer par https:\/\//)).toBeTruthy()
    expect(createProject).not.toHaveBeenCalled()
  })

  it('removes a prompt that was added by mistake', async () => {
    await renderWithProviders(<ProjectFormScreen />)

    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter un prompt' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Retirer le prompt 1' }))

    expect(screen.queryByLabelText('Prompt 1')).toBeNull()
  })

  it('shows the message of the API when it refuses', async () => {
    jest.mocked(createProject).mockResolvedValue({ ok: false, error: 'rateLimited' })
    await renderWithProviders(<ProjectFormScreen />)

    await fireEvent.changeText(screen.getByLabelText('Titre'), 'Mon agent')
    await fireEvent.changeText(screen.getByLabelText('Le pitch, en une phrase'), 'Un menu malin.')
    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }))

    expect(
      await screen.findByText('Trop de demandes. Réessaie dans quelques minutes.'),
    ).toBeTruthy()
  })
})

describe('ProjectFormScreen, editing', () => {
  it('starts from the project and saves the changes', async () => {
    jest
      .mocked(updateProject)
      .mockResolvedValue({ ok: true, data: { ...recipesProject, title: 'Nouveau titre' } })
    await renderWithProviders(<ProjectFormScreen id={recipesProject.id} />)

    await fireEvent.changeText(
      await screen.findByDisplayValue('Mon agent de recettes'),
      'Nouveau titre',
    )
    expect(screen.getByDisplayValue('Claude Code, Cursor')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(updateProject).toHaveBeenCalledWith(
      recipesProject.id,
      expect.objectContaining({ title: 'Nouveau titre', status: 'testable' }),
    )
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/projects/[id]',
      params: { id: recipesProject.id },
    })
  })

  it('is refused to anyone but the author', async () => {
    jest.mocked(getProject).mockResolvedValue({ ...recipesProject, isMine: false })
    await renderWithProviders(<ProjectFormScreen id={recipesProject.id} />)

    expect(await screen.findByText('Seul l’auteur peut modifier ce projet.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull()
  })
})
