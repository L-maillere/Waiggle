// Page où arrive le membre après avoir cliqué sur le lien de l'e-mail : l'API a vérifié
// l'adresse, puis l'a redirigé ici (callbackURL).
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text } from 'react-native'
import { useColors } from '../theme'
import { Button } from '../ui/Button'
import { Screen } from '../ui/Screen'

export function VerifiedScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const c = useColors()

  return (
    <Screen title={t('auth.verified.title')}>
      <Text style={[styles.body, { color: c.text }]}>{t('auth.verified.body')}</Text>
      <Button label={t('auth.verified.continue')} onPress={() => router.replace('/')} />
    </Screen>
  )
}

const styles = StyleSheet.create({ body: { fontSize: 16, lineHeight: 24 } })
