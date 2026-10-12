// Nettoyage des avatars avec sharp, une bibliothèque de traitement d'images très rapide.
// On ne republie JAMAIS le fichier envoyé tel quel : on en fabrique un nouveau.
// - Les métadonnées disparaissent (position GPS, modèle du téléphone, date…).
// - Un fichier piégé qui se ferait passer pour une image est rejeté au décodage.
// - Tous les avatars ont le même format et la même taille, ce qui est léger à afficher.
import sharp from 'sharp'

export const AVATAR_SIZE = 512

// Formats d'origine acceptés, tels que sharp les détecte en lisant le contenu du fichier
// (et non d'après son nom ou ce que le navigateur prétend : ça, n'importe qui peut le falsifier).
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp'])

// Garde-fou contre les « bombes de décompression » : une petite image compressée qui
// prendrait des gigaoctets de mémoire une fois décodée. 40 millions de pixels au plus.
const MAX_INPUT_PIXELS = 40_000_000

export type AvatarResult = { ok: true; data: Uint8Array } | { ok: false; reason: 'unsupported' }

export const processAvatar = async (input: Uint8Array): Promise<AvatarResult> => {
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    const { format } = await image.metadata()
    if (!format || !ACCEPTED_FORMATS.has(format)) return { ok: false, reason: 'unsupported' }

    const data = await image
      .rotate() // redresse la photo selon son orientation EXIF, avant que l'EXIF ne disparaisse
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' }) // carré, recadré au centre
      .webp({ quality: 82 })
      // sharp n'écrit aucune métadonnée par défaut : rien n'est recopié de l'original.
      .toBuffer()
    return { ok: true, data: new Uint8Array(data) }
  } catch {
    // sharp n'arrive pas à décoder : ce n'est pas une image valide.
    return { ok: false, reason: 'unsupported' }
  }
}
