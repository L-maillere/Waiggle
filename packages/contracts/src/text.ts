// Règles communes à tous les textes écrits par les membres (nom, bio, outils…).
// Certains caractères sont invisibles à l'écran mais pas pour les programmes :
// - le caractère « nul » (U+0000) : PostgreSQL refuse de l'enregistrer, la requête planterait ;
// - les caractères de contrôle (retour chariot, échappement…) : ils peuvent abîmer un affichage ;
// - les caractères invisibles et ceux qui inversent le sens d'écriture (U+202E…) : ils
//   permettent de fabriquer un nom qui paraît vide, ou qui se lit comme celui de quelqu'un d'autre.
// On les refuse dès la vérification des données, avant qu'ils n'atteignent la base.
import { z } from 'zod'

export const NAME_MAX_LENGTH = 80

// Les caractères refusés, par leur numéro Unicode (« code point »).
const isControl = (code: number) => code <= 0x1f || (code >= 0x7f && code <= 0x9f)
const isInvisibleOrBidi = (code: number) =>
  code === 0x200b || // espace de largeur nulle
  code === 0x2028 || // séparateur de ligne
  code === 0x2029 || // séparateur de paragraphe
  (code >= 0x202a && code <= 0x202e) || // forçage du sens d'écriture
  (code >= 0x2060 && code <= 0x2064) || // caractères de mise en forme invisibles
  (code >= 0x2066 && code <= 0x2069) || // isolements du sens d'écriture
  code === 0xfeff // espace insécable de largeur nulle
// Remarque : U+200D (« liant », qui assemble 👩 et 💻 en 👩‍💻) reste autorisé.

const LINE_BREAKS = new Set([0x0a, 0x0d]) // \n et \r

/** Vrai si le texte ne contient que des caractères autorisés. */
const isClean = (text: string, allowLineBreaks: boolean) => {
  // for…of parcourt le texte caractère par caractère (y compris les emoji, faits de 2 « unités »).
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (allowLineBreaks && LINE_BREAKS.has(code)) continue
    if (isControl(code) || isInvisibleOrBidi(code)) return false
  }
  return true
}

const message = 'contains forbidden characters'

/** Un nom affiché : 1 à 80 caractères, sur une ligne. */
export const DisplayName = z
  .string()
  .trim()
  .min(1)
  .max(NAME_MAX_LENGTH)
  // refine ajoute une règle maison : la fonction renvoie true si la valeur est acceptable.
  .refine((text) => isClean(text, false), { message })

/** Un texte libre (une bio…) : les retours à la ligne sont permis. */
export const FreeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((text) => isClean(text, true), { message })

/** Une courte étiquette (un nom d'outil…) : non vide, sur une ligne. */
export const ShortLabel = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((text) => isClean(text, false), { message })
