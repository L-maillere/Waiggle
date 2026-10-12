// Un champ de saisie avec son étiquette, une aide facultative et un message d'erreur.
// L'étiquette est aussi donnée aux lecteurs d'écran (accessibilityLabel) : c'est ce qui permet
// à une personne aveugle de savoir quoi taper, et aux tests de retrouver le champ par son nom.
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native'
import { useColors } from '../theme'

type Props = {
  label: string
  value: string
  onChangeText: (text: string) => void
  hint?: string | undefined
  error?: string | undefined
} & Pick<TextInputProps, 'secureTextEntry' | 'autoComplete' | 'keyboardType' | 'textContentType'>

export function TextField({ label, value, onChangeText, hint, error, ...inputProps }: Props) {
  const c = useColors()
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        style={[
          styles.input,
          {
            color: c.text,
            borderColor: error ? c.danger : c.border,
            backgroundColor: c.background,
          },
        ]}
        placeholderTextColor={c.muted}
        {...inputProps} // les autres réglages (mot de passe masqué, type de clavier…) sont transmis tels quels
      />
      {/* Affiche l'erreur si elle existe, sinon l'aide si elle existe, sinon rien. */}
      {error ? (
        <Text style={[styles.small, { color: c.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.small, { color: c.muted }]}>{hint}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: '600' },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  small: { fontSize: 13 },
})
