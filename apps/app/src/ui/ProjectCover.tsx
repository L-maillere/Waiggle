// La couverture d'un projet qui n'a pas (encore) de visuel : la lumière miel, avec le titre écrit
// dessus en grand. Les visuels arriveront avec la tranche 3b ; d'ici là, chaque projet a quand même
// une couverture chaleureuse plutôt qu'un cadre vide.
import { honeyLight, type Radius, radii, space } from '@ruche/brand'
import type { ReactNode } from 'react'
import { View } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { Text } from './Text'
import { useTheme } from './theme/ThemeProvider'

type Props = {
  title?: string
  height: number
  radius?: Radius
  /** Ce qui se pose sur la couverture (boutons ronds, panneau de verre). */
  children?: ReactNode
}

export function ProjectCover({ title, height, radius = 'sheet', children }: Props) {
  const { scheme } = useTheme()
  const id = `cover-${scheme}`
  return (
    <View style={{ height, borderRadius: radii[radius], overflow: 'hidden', alignSelf: 'stretch' }}>
      <Svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <Defs>
          <RadialGradient id={id} cx="30%" cy="25%" r="90%">
            {honeyLight[scheme].map((stop) => (
              <Stop key={stop.at} offset={stop.at} stopColor={stop.color} />
            ))}
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {title ? (
        // Le titre décore la couverture : il est déjà lu ailleurs, on le cache aux lecteurs d'écran.
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', left: space.xl, right: space.xl, bottom: space.xl }}
        >
          <Text variant="title1" numberOfLines={3}>
            {title}
          </Text>
        </View>
      ) : null}
      {children}
    </View>
  )
}
