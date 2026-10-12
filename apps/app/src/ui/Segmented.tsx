// Un contrôle segmenté : deux à quatre choix côte à côte dans une capsule, le choix actif en blanc
// plein (la « goutte »). Sert pour l'apparence (Automatique / Jour / Nuit) ou la langue.
// Annoncé comme un groupe de boutons radio, comme Choices.
import { radii, space } from '@ruche/brand'
import { Pressable, View } from 'react-native'
import { Icon, type IconName } from './Icon'
import { Text } from './Text'
import { useTheme } from './theme/ThemeProvider'

type Option<T extends string> = { value: T; label: string; icon?: IconName }

type Props<T extends string> = {
  /** Le nom du groupe, lu par les lecteurs d'écran (« Apparence »). */
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}

export function Segmented<T extends string>({ label, options, value, onChange }: Props<T>) {
  const { colors, shadows } = useTheme()
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        padding: space.xs,
        gap: space.xs,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceGrouped,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      {options.map((option) => {
        const checked = option.value === value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked }}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              flexDirection: 'row',
              gap: space.xs,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 40,
              paddingHorizontal: space.md,
              borderRadius: radii.pill,
              ...(checked
                ? { backgroundColor: colors.surfaceRaised, boxShadow: shadows.soft }
                : null),
            }}
          >
            {option.icon ? (
              <Icon name={option.icon} size={18} tone={checked ? 'default' : 'muted'} />
            ) : null}
            <Text
              variant="callout"
              weight={checked ? 700 : 500}
              tone={checked ? 'default' : 'muted'}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
