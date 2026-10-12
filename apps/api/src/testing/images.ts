// Fabrique de fausses photos pour les tests, avec sharp.
// On ne stocke aucune vraie photo dans le dépôt : on les génère à la demande.
import sharp from 'sharp'

/**
 * Une photo JPEG 1200 × 800 qui contient des métadonnées EXIF, dont une position GPS,
 * comme celles que prend un téléphone. C'est exactement ce qu'on ne doit jamais republier.
 */
export const photoWithGps = () =>
  sharp({ create: { width: 1200, height: 800, channels: 3, background: '#d9a441' } })
    .jpeg()
    .withExif({
      IFD0: { Make: 'Phone', Model: 'Secret model', Copyright: 'Léa' },
      // IFD3 = la section GPS des métadonnées EXIF : latitude 48° 51' 24" N (Paris).
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '48/1 51/1 24/1' },
    })
    .toBuffer()

/** Une image PNG simple. */
export const pngImage = () =>
  sharp({ create: { width: 300, height: 600, channels: 4, background: '#3b6ea8' } })
    .png()
    .toBuffer()

/** Prépare un formulaire d'envoi de fichier (multipart/form-data) avec un champ "avatar". */
export const avatarForm = (bytes: Uint8Array, type = 'image/jpeg', filename = 'photo.jpg') => {
  const form = new FormData()
  form.append('avatar', new File([new Uint8Array(bytes)], filename, { type }))
  return form
}
