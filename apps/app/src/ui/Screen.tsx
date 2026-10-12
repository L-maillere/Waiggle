// La mise en page commune aux écrans : le fond, la lumière d'ambiance, les marges, la largeur
// maximale du contenu, le défilement et, en option, un bouton de retour et un titre.
// `children` désigne ce qu'on place entre <Screen> et </Screen> : le contenu propre à chaque écran.
import { layout, space } from '@ruche/brand'
import { type ReactNode, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBrowserLanguage } from '../i18n'
import { AmbientLight } from './AmbientLight'
import { IconButton } from './IconButton'
import { Text } from './Text'
import { markHydrated } from './theme/hydration'
import { useLayout } from './theme/layout'
import { useTheme } from './theme/ThemeProvider'

type Props = {
  title?: string
  children: ReactNode
  /** Affiche un bouton « Retour » en haut à gauche. */
  onBack?: () => void
  /**
   * form : une colonne étroite et centrée (connexion, formulaires) ;
   * page : toute la largeur, jusqu'à 1 280 points (pages en colonnes sur ordinateur).
   */
  width?: 'form' | 'page'
  /** La lumière d'ambiance derrière l'écran (vrai par défaut). */
  ambient?: boolean
  /** Le résumé flou du visuel qui colore la lumière (sinon : lumière miel). */
  thumbhash?: string | null
}

export function Screen({
  title,
  children,
  onBack,
  width = 'form',
  ambient = true,
  thumbhash = null,
}: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const { padding } = useLayout()
  // Les « marges de sécurité » : la place prise par l'encoche, l'heure, la barre du bas du téléphone.
  const insets = useSafeAreaInsets()
  // Une fois l'écran affiché dans le navigateur, la page peut passer au thème, à la largeur et à la
  // langue réels du visiteur (voir theme/hydration.ts).
  useEffect(() => markHydrated(), [])
  useBrowserLanguage()

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {ambient ? <AmbientLight thumbhash={thumbhash} /> : null}
      {/* ScrollView : l'écran défile si le contenu dépasse (petit téléphone, clavier ouvert). */}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          paddingTop: insets.top + space.lg,
          paddingBottom: insets.bottom + space.huge,
          paddingHorizontal: padding,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: '100%',
            maxWidth: width === 'form' ? layout.formWidth : layout.maxContentWidth,
            gap: space.xl,
            // Un formulaire seul se place au milieu de la hauteur de l'écran.
            ...(width === 'form' && !onBack ? { flexGrow: 1, justifyContent: 'center' } : null),
          }}
        >
          {onBack ? (
            <IconButton icon="arrow-left" label={t('common.back')} onPress={onBack} />
          ) : null}
          {title ? (
            <Text variant="title2" accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {children}
        </View>
      </ScrollView>
    </View>
  )
}
