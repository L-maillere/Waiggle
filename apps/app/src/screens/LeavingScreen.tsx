// Page d'avertissement « Tu quittes Ruche » : tout lien vers un autre site (démo d'un projet, lien
// dans une description) passe par ici avant de s'ouvrir.
// Pourquoi ? Un lien peut mentir sur sa destination : le texte « le site officiel » peut mener
// ailleurs. Ici, le membre voit l'adresse réelle, et le nom du site en clair, avant de décider.
import { publicHttpsUrl } from '@ruche/contracts'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Linking, StyleSheet, Text } from 'react-native'
import { useColors } from '../theme'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { Screen } from '../ui/Screen'

/**
 * L'adresse si c'est un lien https vers un site public, sinon null. Même règle que pour le lien de
 * démo (voir publicHttpsUrl dans @ruche/contracts) : pas de javascript:, pas d'adresse IP ni de
 * machine du réseau local, pas d'identifiant caché avant « @ », pas de nom écrit dans un autre
 * alphabet qui pourrait imiter un site connu.
 */
const safeTarget = (value: string | undefined): URL | null => (value ? publicHttpsUrl(value) : null)

export function LeavingScreen({ url }: { url: string | undefined }) {
  const { t } = useTranslation()
  const router = useRouter()
  const c = useColors()
  const target = safeTarget(url)

  if (!target) {
    return (
      <Screen title={t('leaving.title')}>
        <Notice message={t('leaving.invalid')} />
        <Button label={t('leaving.back')} variant="secondary" onPress={() => router.back()} />
      </Screen>
    )
  }

  return (
    <Screen title={t('leaving.title')}>
      <Text style={[styles.body, { color: c.text }]}>{t('leaving.body')}</Text>
      <Text style={[styles.label, { color: c.muted }]}>{t('leaving.destination')}</Text>
      {/* L'adresse complète, telle qu'elle sera ouverte : un nom de site écrit avec des lettres d'un
          autre alphabet y apparaît sous sa forme réelle (« xn--… »), ou il a été refusé plus haut. */}
      <Text selectable style={[styles.url, { color: c.text, borderColor: c.border }]}>
        {target.href}
      </Text>
      <Button
        label={t('leaving.continue', { host: target.host })}
        onPress={() => void Linking.openURL(target.href)}
      />
      <Button label={t('leaving.back')} variant="secondary" onPress={() => router.back()} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 23 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  url: { fontSize: 15, borderWidth: 1, borderRadius: 10, padding: 12 },
})
