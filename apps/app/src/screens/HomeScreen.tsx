// L'écran d'accueil. En React, un écran est une fonction qui renvoie ce qu'il faut afficher (du JSX,
// cette syntaxe qui ressemble à du HTML). React Native traduit ensuite <View> et <Text> en vrais
// éléments iOS, Android ou web.
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { useSession } from '../accounts/api'
import { type Colors, useColors } from '../theme'
import { Button } from '../ui/Button'
import { LanguageSwitcher } from '../ui/LanguageSwitcher'

export function HomeScreen() {
  // Les « hooks » (fonctions qui commencent par use…) branchent l'écran sur une donnée qui change.
  // useTranslation : donne t() pour traduire, et redessine l'écran quand la langue change.
  const { t } = useTranslation()
  // useSession : le membre connecté, ou null. L'écran se redessine à la connexion / déconnexion.
  const { data: session } = useSession()
  const router = useRouter()
  const styles = makeStyles(useColors())

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        {/* accessibilityRole="header" : les lecteurs d'écran annoncent ce texte comme un titre */}
        <Text accessibilityRole="header" style={styles.title}>
          {t('home.title', { appName: t('common.appName') })}
        </Text>
        <Text style={styles.tagline}>{t('home.tagline')}</Text>

        {/* Deux affichages selon qu'un membre est connecté ou non. */}
        {session ? (
          <>
            <Text style={styles.greeting}>{t('home.greeting', { name: session.user.name })}</Text>
            <Text style={styles.soon}>{t('home.comingSoon')}</Text>
            <Button label={t('home.publish')} onPress={() => router.push('/projects/new')} />
            <Button
              label={t('home.account')}
              variant="secondary"
              onPress={() => router.push('/account')}
            />
          </>
        ) : (
          <>
            <Text style={styles.soon}>{t('home.comingSoon')}</Text>
            <Button label={t('home.signUp')} onPress={() => router.push('/sign-up')} />
            <Button
              label={t('home.signIn')}
              variant="secondary"
              onPress={() => router.push('/sign-in')}
            />
          </>
        )}
      </View>

      {/* Le choix de la langue (voir ui/LanguageSwitcher.tsx) */}
      <LanguageSwitcher />
    </View>
  )
}

// Les styles ressemblent à du CSS, écrits en objets JavaScript (fontSize au lieu de font-size).
// Ils dépendent des couleurs, d'où une fonction qui les fabrique pour le thème clair ou sombre.
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screen: {
      flex: 1, // occupe tout l'écran
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: 24,
      backgroundColor: c.background,
    },
    card: {
      width: '100%',
      maxWidth: 520, // reste lisible sur un grand écran d'ordinateur
      gap: 12,
      padding: 28,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    title: { fontSize: 30, fontWeight: '700', color: c.text },
    tagline: { fontSize: 17, lineHeight: 25, color: c.text },
    greeting: { fontSize: 18, fontWeight: '600', color: c.text },
    soon: { fontSize: 15, color: c.muted, marginBottom: 4 },
  })
