// Un champ de saisie avec son étiquette, une aide facultative, un compteur et un message d'erreur.
// Présentation « réglages » : un groupe blanc arrondi, l'étiquette en petit au-dessus de la valeur.
// Plusieurs champs placés dans un <FieldGroup> partagent le même groupe, séparés par un trait.
//
// L'étiquette est aussi donnée aux lecteurs d'écran (accessibilityLabel) : c'est ce qui permet à une
// personne aveugle de savoir quoi taper, et aux tests de retrouver le champ par son nom.
import { borders, layout, radii, space, textStyles } from '@ruche/brand'
import { Children, createContext, Fragment, type ReactNode, useContext, useState } from 'react'
import { TextInput, type TextInputProps, View } from 'react-native'
import { Icon } from './Icon'
import { Text } from './Text'
import { fontName } from './theme/fonts'
import { useTheme } from './theme/ThemeProvider'

type Props = {
  label: string
  value: string
  onChangeText: (text: string) => void
  hint?: string | undefined
  error?: string | undefined
  /** Affiche « 42 / 140 » à côté de l'étiquette (avec maxLength). */
  showCount?: boolean
} & Pick<
  TextInputProps,
  | 'secureTextEntry'
  | 'autoComplete'
  | 'keyboardType'
  | 'textContentType'
  | 'multiline'
  | 'maxLength'
  | 'autoCapitalize'
  | 'placeholder'
>

// Vrai quand le champ est dans un FieldGroup : il ne dessine alors pas son propre groupe.
const InGroup = createContext(false)

/** Le cadre blanc d'un groupe de champs. */
function GroupFrame({
  children,
  state,
}: {
  children: ReactNode
  state: 'idle' | 'focus' | 'error'
}) {
  const { colors, shadows } = useTheme()
  const border = { idle: colors.groupBorder, focus: colors.focusRing, error: colors.dangerBorder }
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.group,
        borderWidth: state === 'idle' ? borders.hairline : borders.strong,
        borderColor: border[state],
        boxShadow: shadows.soft,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  )
}

/** Regroupe plusieurs champs dans un même cadre, séparés par un trait fin. */
export function FieldGroup({ children }: { children: ReactNode }) {
  const { colors } = useTheme()
  // Children.toArray : la liste des enfants, sans les vides (un champ affiché sous condition).
  const fields = Children.toArray(children)
  return (
    <InGroup.Provider value>
      <GroupFrame state="idle">
        {fields.map((field, i) => (
          <Fragment key={(field as { key?: string }).key ?? i}>
            {i > 0 ? (
              <View
                style={{
                  height: borders.hairline,
                  backgroundColor: colors.groupSeparator,
                  marginLeft: space.lg,
                }}
              />
            ) : null}
            {field}
          </Fragment>
        ))}
      </GroupFrame>
    </InGroup.Provider>
  )
}

export function TextField({
  label,
  value,
  onChangeText,
  hint,
  error,
  showCount = false,
  ...inputProps
}: Props) {
  const { colors } = useTheme()
  const inGroup = useContext(InGroup)
  const [focused, setFocused] = useState(false)
  const body = textStyles.body

  const row = (
    <View
      style={{
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        paddingBottom: space.sm,
        gap: space.xxs,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
        <Text variant="caption" weight={600} tone={error ? 'danger' : focused ? 'accent' : 'muted'}>
          {label}
        </Text>
        {showCount && inputProps.maxLength ? (
          <Text variant="caption" tone="muted" tabular>
            {`${Array.from(value).length} / ${inputProps.maxLength}`}
          </Text>
        ) : null}
      </View>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="none"
        placeholderTextColor={colors.textPlaceholder}
        // Le champ utilise la police et la taille du texte courant.
        style={{
          fontFamily: fontName(body.family, body.weight),
          fontSize: body.size,
          lineHeight: body.lineHeight,
          color: colors.text,
          minHeight: layout.touchTarget,
          paddingVertical: space.xs,
          // Sur le web, le navigateur dessine son propre contour : le groupe s'en charge déjà.
          outlineWidth: 0,
          ...(inputProps.multiline ? { minHeight: 96, textAlignVertical: 'top' } : null),
        }}
        {...inputProps} // les autres réglages (mot de passe masqué, type de clavier…) sont transmis tels quels
      />
      {/* Dans un groupe, le message reste dans la ligne du champ concerné. */}
      {inGroup ? <Message error={error} hint={hint} /> : null}
    </View>
  )

  if (inGroup) return row
  return (
    <View style={{ gap: space.sm }}>
      <GroupFrame state={error ? 'error' : focused ? 'focus' : 'idle'}>{row}</GroupFrame>
      <Message error={error} hint={hint} outside />
    </View>
  )
}

/** L'erreur si elle existe, sinon l'aide si elle existe, sinon rien. */
function Message({
  error,
  hint,
  outside = false,
}: {
  error?: string | undefined
  hint?: string | undefined
  outside?: boolean
}) {
  const padding = outside ? { paddingHorizontal: space.sm } : { paddingBottom: space.xs }
  if (error) {
    return (
      <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center', ...padding }}>
        <Icon name="warning-circle" size={16} tone="danger" />
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        </View>
      </View>
    )
  }
  if (!hint) return null
  return (
    <View style={padding}>
      <Text variant="caption" tone="muted">
        {hint}
      </Text>
    </View>
  )
}
