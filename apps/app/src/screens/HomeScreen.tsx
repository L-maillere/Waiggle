import { type Language, supportedLanguages } from '@ruche/i18n'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { type Colors, palette } from '../theme'

export function HomeScreen() {
  const { t, i18n } = useTranslation()
  const colors = palette[useColorScheme() === 'dark' ? 'dark' : 'light']
  const styles = makeStyles(colors)
  const current = i18n.language as Language

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('home.title', { appName: t('common.appName') })}
        </Text>
        <Text style={styles.tagline}>{t('home.tagline')}</Text>
        <Text style={styles.soon}>{t('home.comingSoon')}</Text>
      </View>

      <View accessibilityLabel={t('common.language')} style={styles.switcher}>
        {supportedLanguages.map((language) => {
          const selected = language === current
          return (
            <Pressable
              key={language}
              accessibilityRole="button"
              accessibilityState={{ selected }}
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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: 24,
      backgroundColor: c.background,
    },
    card: {
      width: '100%',
      maxWidth: 520,
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
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipSelected: { backgroundColor: c.accentSoft, borderColor: c.accent },
    chipText: { fontSize: 15, color: c.muted },
    chipTextSelected: { color: c.text, fontWeight: '600' },
  })
