// Un message encadré : une erreur (rouge) ou une information.
// accessibilityRole="alert" : les lecteurs d'écran lisent le message dès qu'il apparaît.
import { StyleSheet, Text, View } from 'react-native'
import { useColors } from '../theme'

type Props = { message: string; tone?: 'error' | 'info' }

export function Notice({ message, tone = 'error' }: Props) {
  const c = useColors()
  const isError = tone === 'error'
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.box,
        {
          backgroundColor: isError ? c.dangerSoft : c.accentSoft,
          borderColor: isError ? c.danger : c.accent,
        },
      ]}
    >
      <Text style={[styles.text, { color: isError ? c.danger : c.text }]}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 12 },
  text: { fontSize: 15, lineHeight: 21 },
})
