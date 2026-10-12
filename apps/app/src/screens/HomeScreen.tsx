// L'écran d'accueil. En React, un écran est une fonction qui renvoie ce qu'il faut afficher (du JSX,
// cette syntaxe qui ressemble à du HTML). React Native traduit ensuite <View> et <Text> en vrais
// éléments iOS, Android ou web.
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSession } from '../accounts/api'
import { Button } from '../ui/Button'
import { LanguageSwitcher } from '../ui/LanguageSwitcher'
import { Screen } from '../ui/Screen'
import { Stack } from '../ui/Stack'
import { Text } from '../ui/Text'
import { Wordmark } from '../ui/Wordmark'

export function HomeScreen() {
  // Les « hooks » (fonctions qui commencent par use…) branchent l'écran sur une donnée qui change.
  // useTranslation : donne t() pour traduire, et redessine l'écran quand la langue change.
  const { t } = useTranslation()
  // useSession : le membre connecté, ou null. L'écran se redessine à la connexion / déconnexion.
  const { data: session } = useSession()
  const router = useRouter()

  return (
    // <Screen> pose le fond, la lumière miel et les marges ; l'écran ne dit que ce qu'il contient.
    <Screen>
      <Stack gap="lg">
        <Wordmark size="large" />
        {/* accessibilityRole="header" : les lecteurs d'écran annoncent ce texte comme un titre */}
        <Text variant="title3" accessibilityRole="header">
          {t('home.title')}
        </Text>
        <Text tone="secondary">{t('home.tagline')}</Text>
      </Stack>

      {/* Deux affichages selon qu'un membre est connecté ou non. */}
      {session ? (
        <Stack gap="md">
          <Text variant="headline">{t('home.greeting', { name: session.user.name })}</Text>
          <Text variant="callout" tone="muted">
            {t('home.comingSoon')}
          </Text>
          <Button
            label={t('home.publish')}
            icon="plus"
            onPress={() => router.push('/projects/new')}
          />
          <Button
            label={t('home.account')}
            variant="secondary"
            onPress={() => router.push('/account')}
          />
        </Stack>
      ) : (
        <Stack gap="md">
          <Text variant="callout" tone="muted">
            {t('home.comingSoon')}
          </Text>
          <Button label={t('home.signUp')} onPress={() => router.push('/sign-up')} />
          <Button
            label={t('home.signIn')}
            variant="secondary"
            onPress={() => router.push('/sign-in')}
          />
        </Stack>
      )}

      {/* Le choix de la langue (voir ui/LanguageSwitcher.tsx) */}
      <LanguageSwitcher />
    </Screen>
  )
}
