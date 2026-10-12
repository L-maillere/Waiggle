// Écran affiché juste après l'inscription : « va cliquer sur le lien reçu par e-mail ».
// L'adresse arrive dans l'URL de la page (/check-email?email=…), lue avec useLocalSearchParams.
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text } from 'react-native'
import { useColors } from '../theme'
import { Button } from '../ui/Button'
import { Screen } from '../ui/Screen'

export function CheckEmailScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const c = useColors()
  const { email = '' } = useLocalSearchParams<{ email?: string }>()

  return (
    <Screen title={t('auth.checkEmail.title')}>
      <Text style={[styles.body, { color: c.text }]}>{t('auth.checkEmail.body', { email })}</Text>
      <Button
        label={t('auth.checkEmail.back')}
        variant="secondary"
        onPress={() => router.replace('/sign-in')}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({ body: { fontSize: 16, lineHeight: 24 } })
