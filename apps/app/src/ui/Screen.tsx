// Mise en page commune aux écrans : fond, carte centrée, titre.
// `children` désigne ce qu'on place entre <Screen> et </Screen> : le contenu propre à chaque écran.
import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useColors } from '../theme'

type Props = { title?: string; children: ReactNode }

export function Screen({ title, children }: Props) {
  const c = useColors()
  return (
    // ScrollView : l'écran défile si le contenu dépasse (petit téléphone, clavier ouvert).
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        {title ? (
          <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>
            {title}
          </Text>
        ) : null}
        {children}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 480, gap: 16, padding: 28, borderRadius: 20, borderWidth: 1 },
  title: { fontSize: 26, fontWeight: '700' },
})
