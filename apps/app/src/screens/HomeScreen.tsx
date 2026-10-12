// L'écran d'accueil. En React, un écran est une fonction qui renvoie ce qu'il faut afficher (du JSX,
// cette syntaxe qui ressemble à du HTML). React Native traduit ensuite <View> et <Text> en vrais
// éléments iOS, Android ou web.
import { type Language, supportedLanguages } from '@ruche/i18n'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { type Colors, palette } from '../theme'

export function HomeScreen() {
  // Les « hooks » (fonctions qui commencent par use…) branchent l'écran sur une donnée qui change.
  // useTranslation : donne t() pour traduire, et redessine l'écran quand la langue change.
  const { t, i18n } = useTranslation()
  // useColorScheme : 'dark' si le téléphone est en mode sombre.
  const colors = palette[useColorScheme() === 'dark' ? 'dark' : 'light']
  const styles = makeStyles(colors)
  const current = i18n.language as Language

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        {/* accessibilityRole="header" : les lecteurs d'écran annoncent ce texte comme un titre */}
        <Text accessibilityRole="header" style={styles.title}>
          {t('home.title', { appName: t('common.appName') })}
        </Text>
        <Text style={styles.tagline}>{t('home.tagline')}</Text>
        <Text style={styles.soon}>{t('home.comingSoon')}</Text>
      </View>

      <View accessibilityLabel={t('common.language')} style={styles.switcher}>
        {/* Un bouton par langue gérée : .map() transforme chaque langue en élément affiché */}
        {supportedLanguages.map((language) => {
          const selected = language === current
          return (
            <Pressable
              key={language} // React a besoin d'une clé unique pour suivre chaque élément d'une liste
              accessibilityRole="button"
              accessibilityState={{ selected }} // annoncé « sélectionné » par les lecteurs d'écran
              onPress={() => i18n.changeLanguage(language)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {t(`common.languages.${language}`)}
              </Text>
            </Pressable>
          )
        })}
      </View>
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
    soon: { fontSize: 15, color: c.muted },
    switcher: { flexDirection: 'row', gap: 8 },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 999, // bords complètement arrondis
      borderWidth: 1,
      borderColor: c.border,
    },
    chipSelected: { backgroundColor: c.accentSoft, borderColor: c.accent },
    chipText: { fontSize: 15, color: c.muted },
    chipTextSelected: { color: c.text, fontWeight: '600' },
  })
