// Le choix de la langue : un bouton par langue gérée. Pour un membre connecté, le choix est aussi
// enregistré sur son compte (il le retrouve sur ses autres appareils et dans ses e-mails).
import { type Language, supportedLanguages } from '@ruche/i18n'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSession } from '../accounts/api'
import { updateProfile } from '../profile/api'
import { useSetMe } from '../profile/hooks'
import { useColors } from '../theme'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const { data: session } = useSession()
  const setMe = useSetMe()
  const c = useColors()
  const current = i18n.language as Language

  const choose = async (language: Language) => {
    // D'abord l'écran, immédiatement : le membre voit le résultat sans attendre le réseau.
    await i18n.changeLanguage(language)
    if (!session) return
    // Puis le compte. Si l'enregistrement échoue (réseau coupé…), l'écran reste dans la langue
    // choisie : seul le souvenir sur les autres appareils est perdu, inutile d'inquiéter le membre.
    const result = await updateProfile({ language })
    if (result.ok) setMe(result.data)
  }

  return (
    <View accessibilityLabel={t('common.language')} style={styles.row}>
      {/* .map() transforme chaque langue en bouton */}
      {supportedLanguages.map((language) => {
        const selected = language === current
        return (
          <Pressable
            key={language} // React a besoin d'une clé unique pour suivre chaque élément d'une liste
            accessibilityRole="button"
            accessibilityState={{ selected }} // annoncé « sélectionné » par les lecteurs d'écran
            onPress={() => choose(language)}
            style={[
              styles.chip,
              { borderColor: selected ? c.accent : c.border },
              selected && { backgroundColor: c.accentSoft },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? c.text : c.muted },
                selected && styles.bold,
              ]}
            >
              {t(`common.languages.${language}`)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999, // bords complètement arrondis
    borderWidth: 1,
  },
  label: { fontSize: 15 },
  bold: { fontWeight: '600' },
})
