// Un bouton, en trois styles : principal (action principale de l'écran), secondaire, danger.
// Pendant une action en cours (loading), il est désactivé pour éviter les doubles envois.
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { useColors } from '../theme'

type Props = {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
  disabled?: boolean
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: Props) {
  const c = useColors()
  const inactive = disabled || loading
  // Couleurs selon le style choisi.
  const look = {
    primary: { background: c.accent, border: c.accent, text: c.onAccent },
    secondary: { background: 'transparent', border: c.border, text: c.text },
    danger: { background: c.dangerSoft, border: c.danger, text: c.danger },
  }[variant]

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      // Les lecteurs d'écran annoncent « désactivé » ou « occupé ».
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: look.background, borderColor: look.border },
        (pressed || inactive) && styles.dimmed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.text} />
      ) : (
        <Text style={[styles.label, { color: look.text }]}>{label}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48, // 48 points minimum : assez grand pour un doigt (recommandation d'accessibilité)
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '600' },
  dimmed: { opacity: 0.6 },
})
