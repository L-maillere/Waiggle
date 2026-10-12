// La photo de profil d'un membre, en rond. Sans photo : son initiale sur un rond de miel.
import { Image, View } from 'react-native'
import { Text } from './Text'
import { useTheme } from './theme/ThemeProvider'

type Props = { name: string; url: string | null; label: string; size?: number }

export function Avatar({ name, url, label, size = 96 }: Props) {
  const { colors } = useTheme()
  const round = { width: size, height: size, borderRadius: size / 2 }
  if (url) {
    // accessibilityLabel : ce que les lecteurs d'écran annoncent à la place de l'image.
    return (
      <Image
        accessibilityLabel={label}
        source={{ uri: url }}
        style={{ ...round, backgroundColor: colors.honeySoft }}
      />
    )
  }
  // L'initiale : une variante de texte proportionnée à la taille du rond.
  const variant = size >= 72 ? 'title1' : size >= 40 ? 'headline' : 'caption'
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        ...round,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.honey,
      }}
    >
      {/* L'initiale en majuscule ; Array.from découpe correctement les lettres accentuées ou emoji. */}
      <Text variant={variant} weight={700} tone="onHoney">
        {Array.from(name.trim())[0]?.toUpperCase() ?? '?'}
      </Text>
    </View>
  )
}
