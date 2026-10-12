// La photo de profil d'un membre, en rond. Sans photo : un rond coloré avec son initiale.
import { Image, StyleSheet, Text, View } from 'react-native'
import { useColors } from '../theme'

type Props = { name: string; url: string | null; label: string; size?: number }

export function Avatar({ name, url, label, size = 96 }: Props) {
  const c = useColors()
  const round = { width: size, height: size, borderRadius: size / 2 }
  if (url) {
    // accessibilityLabel : ce que les lecteurs d'écran annoncent à la place de l'image.
    return <Image accessibilityLabel={label} source={{ uri: url }} style={round} />
  }
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.placeholder, round, { backgroundColor: c.accentSoft, borderColor: c.accent }]}
    >
      {/* L'initiale en majuscule ; Array.from découpe correctement les lettres accentuées ou emoji. */}
      <Text style={[styles.initial, { color: c.text, fontSize: size * 0.4 }]}>
        {Array.from(name.trim())[0]?.toUpperCase() ?? '?'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  initial: { fontWeight: '700' },
})
