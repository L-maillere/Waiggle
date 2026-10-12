// Tests du rendu Markdown : la mise en forme s'affiche, et rien de dangereux ne passe.
// Les descriptions sont écrites par les membres : on les traite comme du texte non fiable.
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Markdown } from './Markdown'

const onLinkPress = jest.fn()
beforeEach(() => onLinkPress.mockReset())

const show = (text: string) => render(<Markdown text={text} onLinkPress={onLinkPress} />)

describe('Markdown', () => {
  it('shows headings, emphasis, lists and code', async () => {
    await show(
      '## Comment ça marche\n\nOn **photographie** le frigo.\n\n1. un\n2. deux\n\n`npm start`',
    )

    expect(screen.getByRole('header', { name: 'Comment ça marche' })).toBeTruthy()
    expect(screen.getByText('photographie')).toBeTruthy()
    expect(screen.getByText('1.')).toBeTruthy()
    expect(screen.getByText('deux')).toBeTruthy()
    expect(screen.getByText('npm start')).toBeTruthy()
  })

  it('opens https links through the warning page handler', async () => {
    await show('Voir [le site](https://recettes.vercel.app) ou https://autre.example')

    await fireEvent.press(screen.getByRole('link', { name: 'le site' }))
    await fireEvent.press(screen.getByRole('link', { name: 'https://autre.example' }))

    expect(onLinkPress).toHaveBeenNthCalledWith(1, 'https://recettes.vercel.app')
    expect(onLinkPress).toHaveBeenNthCalledWith(2, 'https://autre.example')
  })

  it('never makes a link clickable unless it is https', async () => {
    await show('[clique](javascript:alert(1)) [pas sûr](http://site.example)')

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('clique pas sûr')).toBeTruthy() // du texte simple
  })

  it('shows HTML as plain text instead of running it', async () => {
    await show('<script>alert(1)</script>')

    expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy()
  })

  it('never loads an image, which could track whoever reads the page', async () => {
    await show('![photo](https://tracker.example/pixel.png)')

    expect(screen.getByText('photo')).toBeTruthy()
    expect(JSON.stringify(screen.toJSON())).not.toContain('tracker.example')
  })

  it('turns entities back into characters', async () => {
    await show('Pain &amp; fromage')

    expect(screen.getByText('Pain & fromage')).toBeTruthy()
  })
})
