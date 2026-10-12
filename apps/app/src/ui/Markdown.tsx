// Affiche un texte Markdown (la description d'un projet) avec des composants React Native.
//
// Le Markdown est écrit par les membres : c'est un contenu NON FIABLE. Plutôt que de le transformer
// en HTML (où un `<script>` caché pourrait s'exécuter), on le découpe en morceaux (« jetons ») avec
// la bibliothèque marked, puis on dessine nous-mêmes chaque morceau connu :
// - le HTML n'est jamais interprété : il s'affiche tel quel, comme du texte ;
// - les images ne sont jamais chargées (une image distante peut servir de mouchard) : on montre
//   seulement leur texte de remplacement ;
// - seuls les liens https vers un site public sont cliquables, via la page d'avertissement ;
// - les caractères invisibles (écrits par exemple « &#x202E; ») sont retirés de l'affichage ;
// - l'imbrication est bornée : un texte piégé (« >>>>>… » mille fois) ne fait pas planter la page.
import { publicHttpsUrl, removeForbiddenCharacters } from '@ruche/contracts'
import { lexer, type Token } from 'marked'
import { Fragment, type ReactNode, useMemo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { type Colors, useColors } from '../theme'

type Props = {
  text: string
  /** Appelée avec l'adresse d'un lien https touché (l'écran ouvre la page d'avertissement). */
  onLinkPress: (url: string) => void
}

// Au-delà de ce niveau d'imbrication (une liste dans une citation dans une liste…), le reste est
// affiché en texte brut : aucun texte normal n'a besoin de plus, et chaque niveau coûte un cadre.
const MAX_DEPTH = 6

// Les entités HTML (« &amp; ») que marked laisse dans le texte, remises en caractères (« & »).
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decodeEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#')) {
      const number =
        code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1))
      return Number.isInteger(number) && number >= 0 && number <= 0x10ffff
        ? String.fromCodePoint(number)
        : entity
    }
    return ENTITIES[code.toLowerCase()] ?? entity
  })

/** Le texte à afficher : entités décodées, puis caractères invisibles retirés (voir text.ts). */
const clean = (text: string) => removeForbiddenCharacters(decodeEntities(text))

/** Découpe le texte ; si l'analyse échoue (texte piégé qui épuise la mémoire), null. */
const parse = (text: string): Token[] | null => {
  try {
    return lexer(text)
  } catch {
    return null
  }
}

export function Markdown({ text, onLinkPress }: Props) {
  const styles = makeStyles(useColors())
  // useMemo : on ne redécoupe le texte que s'il change, pas à chaque affichage de l'écran.
  const tokens = useMemo(() => parse(text), [text])

  // Les éléments « en ligne » : texte, gras, liens… placés à l'intérieur d'un paragraphe.
  const inline = (list: Token[] | undefined, depth = 0): ReactNode =>
    list?.map((token, i) => {
      // La position sert de clé React : les morceaux n'ont pas d'identifiant, et leur ordre est fixe.
      const key = i
      // Trop profond : le reste en texte brut, sans descendre plus loin.
      if (depth > MAX_DEPTH) return clean(token.raw)
      const children = (tokens: Token[] | undefined) => inline(tokens, depth + 1)
      switch (token.type) {
        case 'text':
        case 'escape':
          return 'tokens' in token && token.tokens ? (
            <Fragment key={key}>{children(token.tokens)}</Fragment>
          ) : (
            clean(token.text)
          )
        case 'strong':
          return (
            <Text key={key} style={styles.bold}>
              {children(token.tokens)}
            </Text>
          )
        case 'em':
          return (
            <Text key={key} style={styles.italic}>
              {children(token.tokens)}
            </Text>
          )
        case 'del':
          return (
            <Text key={key} style={styles.strike}>
              {children(token.tokens)}
            </Text>
          )
        case 'codespan':
          // Dans du code, les entités restent telles qu'elles ont été tapées (« &amp; »).
          return (
            <Text key={key} style={styles.code}>
              {removeForbiddenCharacters(token.text)}
            </Text>
          )
        case 'br':
          return '\n'
        case 'link': {
          // Seul un lien https vers un site public est cliquable (voir publicHttpsUrl) ; les autres
          // (javascript:, http:, adresse IP, réseau local…) restent du simple texte.
          const target = publicHttpsUrl(token.href)
          return target ? (
            <Text
              key={key}
              accessibilityRole="link"
              onPress={() => onLinkPress(target.href)}
              style={styles.link}
            >
              {children(token.tokens)}
            </Text>
          ) : (
            <Fragment key={key}>{children(token.tokens)}</Fragment>
          )
        }
        case 'image':
          return clean(token.text) // le texte de remplacement, jamais l'image elle-même
        default:
          // Tout le reste (HTML compris) : le texte brut, tel qu'il a été tapé.
          return removeForbiddenCharacters(token.raw)
      }
    })

  // Les blocs : titres, paragraphes, listes, citations, code…
  const block = (token: Token, key: number, depth = 0): ReactNode => {
    // Trop profond : le reste du bloc en texte brut.
    if (depth > MAX_DEPTH) {
      return (
        <Text key={key} style={styles.text}>
          {clean(token.raw.trim())}
        </Text>
      )
    }
    const blocks = (tokens: Token[] | undefined) =>
      tokens?.map((child, i) => block(child, i, depth + 1))
    switch (token.type) {
      case 'heading':
        return (
          <Text key={key} accessibilityRole="header" style={[styles.text, styles.heading]}>
            {inline(token.tokens, depth)}
          </Text>
        )
      case 'paragraph':
      case 'text':
        return (
          <Text key={key} style={styles.text}>
            {'tokens' in token && token.tokens ? inline(token.tokens, depth) : clean(token.text)}
          </Text>
        )
      case 'code':
        return (
          <Text key={key} selectable style={[styles.code, styles.codeBlock]}>
            {removeForbiddenCharacters(token.text)}
          </Text>
        )
      case 'blockquote':
        return (
          <View key={key} style={styles.quote}>
            {blocks(token.tokens)}
          </View>
        )
      case 'list':
        return (
          <View key={key} style={styles.list}>
            {token.items.map((item: Token & { tokens?: Token[] }, i: number) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: les éléments d'une liste n'ont pas d'identifiant
              <View key={i} style={styles.item}>
                <Text style={styles.text}>
                  {token.ordered ? `${Number(token.start || 1) + i}.` : '•'}
                </Text>
                <View style={styles.itemBody}>{blocks(item.tokens)}</View>
              </View>
            ))}
          </View>
        )
      case 'hr':
        return <View key={key} style={styles.hr} />
      case 'space':
      case 'def':
        return null
      default:
        // HTML, tableaux… : affichés tels qu'ils ont été tapés, sans interprétation.
        return (
          <Text key={key} style={styles.text}>
            {clean(token.raw.trim())}
          </Text>
        )
    }
  }

  // L'analyse a échoué : le texte tel quel, nettoyé, sans mise en forme.
  if (!tokens) {
    return (
      <Text selectable style={styles.text}>
        {removeForbiddenCharacters(text)}
      </Text>
    )
  }
  return <View style={styles.root}>{tokens.map((token, i) => block(token, i))}</View>
}

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    root: { gap: 10 },
    text: { fontSize: 16, lineHeight: 24, color: c.text },
    heading: { fontSize: 19, fontWeight: '700', marginTop: 4 },
    bold: { fontWeight: '700' },
    italic: { fontStyle: 'italic' },
    strike: { textDecorationLine: 'line-through' },
    link: { color: c.accent, textDecorationLine: 'underline' },
    code: { fontFamily: mono, fontSize: 14, backgroundColor: c.accentSoft, color: c.text },
    codeBlock: { padding: 12, borderRadius: 8, lineHeight: 20 },
    quote: { borderLeftWidth: 3, borderLeftColor: c.border, paddingLeft: 12, gap: 8 },
    list: { gap: 4 },
    item: { flexDirection: 'row', gap: 8 },
    itemBody: { flex: 1, gap: 4 },
    hr: { height: 1, backgroundColor: c.border, marginVertical: 4 },
  })
