// Écran affiché juste après l'inscription : « va cliquer sur le lien reçu par e-mail ».
// L'adresse arrive dans l'URL de la page (/check-email?email=…), lue avec useLocalSearchParams.
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import { Emblem } from '../ui/Illustrations'
import { Notice } from '../ui/Notice'
import { Screen } from '../ui/Screen'
import { Stack } from '../ui/Stack'
import { Text } from '../ui/Text'
import { useHydrated } from '../ui/theme/hydration'

export function CheckEmailScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { email = '' } = useLocalSearchParams<{ email?: string }>()
  // L'adresse est dans l'URL du visiteur, inconnue du serveur qui prépare la page web : on ne
  // l'affiche qu'une fois dans le navigateur (voir ui/theme/hydration.ts).
  const hydrated = useHydrated()

  return (
    <Screen>
      <Stack align="center">
        <Emblem icon="envelope-simple" />
      </Stack>
      <Text variant="title2" accessibilityRole="header">
        {t('auth.checkEmail.title')}
      </Text>
      {hydrated ? (
        <>
          <Text tone="secondary">{t('auth.checkEmail.body', { email })}</Text>
          <Notice tone="info" message={t('auth.checkEmail.locked')} />
          <Button
            label={t('auth.checkEmail.back')}
            variant="secondary"
            onPress={() => router.replace('/sign-in')}
          />
        </>
      ) : null}
    </Screen>
  )
}
