// Une question à choix unique (statut, visibilité…) : une rangée de pastilles dont une seule est
// cochée. Les lecteurs d'écran l'annoncent comme un groupe de boutons radio, ce qui permet aussi aux
// tests de retrouver chaque choix par son nom : getByRole('radio', { name: 'Testable' }).
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useColors } from '../theme'

type Option<T extends string> = { value: T; label: string }

// <T extends string> : un composant « générique ». T est le type des valeurs possibles
// ('idea' | 'building' | …) : TypeScript vérifie que les options et la valeur choisie concordent.
type Props<T extends string> = {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}

export function Choices<T extends string>({ label, options, value, onChange }: Props<T>) {
  const c = useColors()
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
        {options.map((option) => {
          const checked = option.value === value
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked }}
              onPress={() => onChange(option.value)}
              style={[
                styles.chip,
                { borderColor: checked ? c.accent : c.border },
                checked && { backgroundColor: c.accentSoft },
              ]}
            >
              <Text
                style={[styles.text, { color: checked ? c.text : c.muted }, checked && styles.bold]}
              >
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  text: { fontSize: 15 },
  bold: { fontWeight: '600' },
})
