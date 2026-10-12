// Nettoyage des avatars avec sharp, une bibliothèque de traitement d'images très rapide.
// On ne republie JAMAIS le fichier envoyé tel quel : on en fabrique un nouveau.
// - Les métadonnées disparaissent (position GPS, modèle du téléphone, date…).
// - Un fichier piégé qui se ferait passer pour une image est rejeté au décodage.
// - Tous les avatars ont le même format et la même taille, ce qui est léger à afficher.
import sharp from 'sharp'
import { createQueue, QueueFullError } from './queue'

export const AVATAR_SIZE = 512

// Formats d'origine acceptés, tels que sharp les détecte en lisant le contenu du fichier
// (et non d'après son nom ou ce que le navigateur prétend : ça, n'importe qui peut le falsifier).
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp'])

// Garde-fous contre les images piégées, qui feraient exploser la mémoire du serveur :
// - les « bombes de décompression » : un petit fichier qui annonce une image immense
//   (une fois décodée, elle prendrait des gigaoctets). 4096 × 4096 pixels au plus : une photo de
//   téléphone (12 mégapixels) passe, et l'appli réduit de toute façon les images à 1024 px ;
// - les images très allongées (65 000 × 600…) : sharp ne sait pas les réduire pendant la lecture,
//   elles coûtent bien plus cher que leur nombre de pixels ne le laisse croire.
const MAX_INPUT_PIXELS = 4096 * 4096
const MAX_ASPECT_RATIO = 4

// Deux traitements au plus en même temps, huit au plus en attente (au-delà : « réessaie dans un
// instant »). Dix envois simultanés attendent leur tour au lieu de se partager (et d'épuiser) la
// mémoire. sharp n'utilise qu'un fil de calcul par image, et ne garde rien en cache.
sharp.concurrency(1)
sharp.cache(false)
const queue = createQueue(2, 8)

export type AvatarResult =
  | { ok: true; data: Uint8Array }
  // unsupported : pas une image acceptée ; busy : trop d'images en attente de traitement.
  | { ok: false; reason: 'unsupported' | 'busy' }

export const processAvatar = async (input: Uint8Array): Promise<AvatarResult> => {
  try {
    return await queue(() => process(input))
  } catch (error) {
    if (error instanceof QueueFullError) return { ok: false, reason: 'busy' }
    throw error
  }
}

const process = async (input: Uint8Array): Promise<AvatarResult> => {
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    // metadata() ne lit que l'en-tête du fichier : rapide, et sans décoder l'image.
    const { format, width, height, depth } = await image.metadata()
    if (!format || !ACCEPTED_FORMATS.has(format)) return { ok: false, reason: 'unsupported' }
    // 8 bits par couleur (« uchar ») seulement : une image 16 bits coûte deux fois plus de mémoire
    // à décoder, pour une différence invisible sur un avatar.
    if (depth !== 'uchar') return { ok: false, reason: 'unsupported' }
    if (Math.max(width, height) > MAX_ASPECT_RATIO * Math.min(width, height)) {
      return { ok: false, reason: 'unsupported' }
    }

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
