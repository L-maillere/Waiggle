// Tests des composants d'interface : ce qu'un membre (ou un lecteur d'écran) peut faire avec eux.
// Ils ne vérifient pas l'apparence (couleurs, tailles), qui peut changer librement : seulement le
// comportement, qui ne doit pas changer.
import { appName, fontWeights, maxTextScale } from '@ruche/brand'
import { fireEvent, screen } from '@testing-library/react-native'
import { useState } from 'react'
import { renderWithProviders } from '../testing/render'
import { Button } from './Button'
import { IconButton } from './IconButton'
import { Notice } from './Notice'
import { Segmented } from './Segmented'
import { Switch } from './Switch'
import { Text } from './Text'
import { FieldGroup, TextField } from './TextField'
import { fontFiles, fontName } from './theme/fonts'
import { Wordmark } from './Wordmark'

// Les outils de test passent par le module des comptes ; on le remplace, comme dans les écrans.
jest.mock('../accounts/api', () => ({ useSession: jest.fn() }))

describe('Button', () => {
  it('is announced as a button with its label, and runs its action', async () => {
    const onPress = jest.fn()
    await renderWithProviders(<Button label="Publier" onPress={onPress} />)

    await fireEvent.press(screen.getByRole('button', { name: 'Publier' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('cannot be pressed twice while its action is running', async () => {
    const onPress = jest.fn()
    await renderWithProviders(<Button label="Publier" onPress={onPress} loading />)

    const button = screen.getByRole('button', { name: 'Publier' })
    await fireEvent.press(button)

    expect(onPress).not.toHaveBeenCalled()
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true })
  })
})

describe('IconButton', () => {
  it('is named for screen readers even though it only shows an icon', async () => {
    const onPress = jest.fn()
    await renderWithProviders(<IconButton icon="arrow-left" label="Retour" onPress={onPress} />)

    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }))

    expect(onPress).toHaveBeenCalled()
  })
})

describe('Segmented', () => {
  function Appearance() {
    const [value, setValue] = useState<'auto' | 'day' | 'night'>('auto')
    return (
      <Segmented
        label="Apparence"
        options={[
          { value: 'auto', label: 'Automatique' },
          { value: 'day', label: 'Jour' },
          { value: 'night', label: 'Nuit' },
        ]}
        value={value}
        onChange={setValue}
      />
    )
  }

  it('is a group of radio buttons with exactly one checked', async () => {
    await renderWithProviders(<Appearance />)

    // Le groupe porte le nom de la question ; chaque choix est un bouton radio.
    expect(screen.getByLabelText('Apparence').props.accessibilityRole).toBe('radiogroup')
    expect(screen.getByRole('radio', { name: 'Automatique', checked: true })).toBeTruthy()

    await fireEvent.press(screen.getByRole('radio', { name: 'Nuit' }))

    expect(screen.getByRole('radio', { name: 'Nuit', checked: true })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Automatique', checked: false })).toBeTruthy()
  })
})

describe('Switch', () => {
  it('is announced as a switch and flips on press', async () => {
    const onValueChange = jest.fn()
    await renderWithProviders(
      <Switch label="Notifications" value={false} onValueChange={onValueChange} />,
    )

    await fireEvent.press(screen.getByRole('switch', { name: 'Notifications' }))

    expect(onValueChange).toHaveBeenCalledWith(true)
  })
})

describe('TextField', () => {
  it('is found by its label, counts the characters and shows its error', async () => {
    await renderWithProviders(
      <TextField
        label="Titre"
        value="Café"
        onChangeText={() => {}}
        maxLength={80}
        showCount
        error="Le titre est trop long."
      />,
    )

    expect(screen.getByLabelText('Titre')).toBeTruthy()
    expect(screen.getByText('4 / 80')).toBeTruthy()
    expect(screen.getByText('Le titre est trop long.')).toBeTruthy()
  })

  it('passes what is typed to the screen', async () => {
    const onChangeText = jest.fn()
    await renderWithProviders(
      <FieldGroup>
        <TextField label="Nom" value="" onChangeText={onChangeText} />
        <TextField label="Bio" value="" onChangeText={() => {}} hint="280 caractères au plus" />
      </FieldGroup>,
    )

    await fireEvent.changeText(screen.getByLabelText('Nom'), 'Léa')

    expect(onChangeText).toHaveBeenCalledWith('Léa')
    expect(screen.getByText('280 caractères au plus')).toBeTruthy()
  })
})

describe('Notice', () => {
  it('is read out as soon as it appears', async () => {
    await renderWithProviders(<Notice message="Mot de passe incorrect." />)

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Mot de passe incorrect.')).toBeTruthy()
  })
})

describe('Text', () => {
  it('grows with the device text size, up to twice its size', async () => {
    await renderWithProviders(<Text>Bonjour</Text>)

    expect(screen.getByText('Bonjour').props.maxFontSizeMultiplier).toBe(maxTextScale)
    expect(maxTextScale).toBe(2)
  })
})

describe('Wordmark', () => {
  it('reads the app name as it is written, not in lower case', async () => {
    await renderWithProviders(<Wordmark />)

    expect(screen.getByLabelText(appName)).toBeTruthy()
    expect(screen.getByText(appName.toLowerCase())).toBeTruthy()
  })
})

describe('fonts', () => {
  it('ships a file for every weight the type scale may ask for', () => {
    for (const family of ['display', 'text'] as const) {
      for (const weight of fontWeights[family]) {
        expect(Object.keys(fontFiles)).toContain(fontName(family, weight))
      }
    }
  })

  it('falls back to the closest shipped weight', () => {
    // Funnel Display n'est livrée qu'en 700 : un titre demandé en 500 prend le 700.
    expect(fontName('display', 500)).toBe('FunnelDisplay-700')
    expect(fontName('text', 600)).toBe('FunnelSans-600')
  })
})
