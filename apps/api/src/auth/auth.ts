// Configuration de Better Auth, la bibliothèque qui gère les comptes : inscription, connexion,
// sessions, vérification de l'adresse e-mail, suppression du compte.
// Écrire soi-même ces mécanismes est risqué (stockage des mots de passe, jetons, attaques) :
// on s'appuie sur une bibliothèque éprouvée, et on règle ici son comportement pour Ruche.
import { expo } from '@better-auth/expo'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@ruche/contracts'
import { type Database, schema } from '@ruche/db'
import {
  defaultLanguage,
  type Language,
  parseAcceptLanguage,
  resolveLanguage,
  supportedLanguages,
} from '@ruche/i18n'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'
import type { Mailer } from '../email/mailer'
import { existingAccountEmail, verificationEmail } from '../email/templates'
import type { FileStorage } from '../media/storage'
import { authSchemaOptions } from './schema-options'

export type AuthOptions = {
  db: Database
  mailer: Mailer
  /** Stockage des fichiers : l'avatar d'un compte supprimé y est effacé. */
  storage: FileStorage
  /** Clé secrète qui signe les sessions (BETTER_AUTH_SECRET). */
  secret: string
  /** Adresse publique de l'API, utilisée pour construire les liens des e-mails. */
  publicApiUrl: string
  /** Adresse de l'appli web : seule origine autorisée à appeler l'API avec des cookies. */
  appUrl: string
  /** Limitation de débit (anti-force brute). Désactivable pour certains tests. */
  rateLimit: boolean
}

const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (supportedLanguages as readonly string[]).includes(value)

// Langue d'un membre déjà inscrit : celle de son profil, le français si elle est absente ou invalide.
const languageOf = (user: object): Language => {
  const language = 'language' in user ? user.language : undefined
  return isLanguage(language) ? language : defaultLanguage
}

export const createAuth = ({
  db,
  mailer,
  storage,
  secret,
  publicApiUrl,
  appUrl,
  rateLimit,
}: AuthOptions) => {
  // Avatars à effacer après la suppression d'un compte (identifiant du membre → fichier).
  const avatarsToDelete = new Map<string, string>()

  return betterAuth({
    ...authSchemaOptions,
    appName: 'Ruche',
    baseURL: publicApiUrl,
    secret,
    database: drizzleAdapter(db, { provider: 'pg', schema }),

    // Origines autorisées : l'appli web, et l'appli mobile (adresses qui commencent par ruche://).
    // Une requête venant d'un autre site est refusée : protection contre les attaques « CSRF ».
    trustedOrigins: [appUrl, 'ruche://'],

    // Le plugin Expo permet à l'appli iOS / Android de garder sa session (elle n'a pas de cookies
    // comme un navigateur ; le jeton est rangé dans le coffre-fort du téléphone).
    plugins: [expo()],

    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      // Pas de connexion tant que l'adresse n'est pas vérifiée. Effet secondaire voulu :
      // une inscription avec une adresse existante répond comme une inscription normale.
      requireEmailVerification: true,
      // … et c'est le propriétaire de l'adresse qui est prévenu, par e-mail.
      onExistingUserSignUp: async ({ user }) => {
        await mailer.send({
          to: user.email,
          ...existingAccountEmail(languageOf(user), {
            name: user.name,
            signInUrl: `${appUrl}/sign-in`,
          }),
        })
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      // Tentative de connexion avec une adresse non vérifiée : on renvoie le lien.
      sendOnSignIn: true,
      // Cliquer sur le lien vérifie l'adresse ET connecte le membre.
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60, // le lien est valable une heure
      sendVerificationEmail: async ({ user, url }) => {
        await mailer.send({
          to: user.email,
          ...verificationEmail(languageOf(user), { name: user.name, url }),
        })
      },
    },

    user: {
      ...authSchemaOptions.user,
      // Suppression du compte par le membre lui-même (route POST /api/auth/delete-user),
      // après confirmation de son mot de passe. Les sessions et méthodes de connexion
      // disparaissent avec lui (suppression « en cascade » dans la base).
      deleteUser: {
        enabled: true,
        // Juste avant la suppression : on note le fichier de l'avatar (la ligne `profile` va
        // disparaître avec le compte, on ne pourrait plus le retrouver après).
        beforeDelete: async (user) => {
          const [row] = await db
            .select({ avatarKey: schema.profile.avatarKey })
            .from(schema.profile)
            .where(eq(schema.profile.userId, user.id))
          if (row?.avatarKey) avatarsToDelete.set(user.id, row.avatarKey)
        },
        // Juste après : on efface le fichier lui-même du stockage.
        afterDelete: async (user) => {
          const key = avatarsToDelete.get(user.id)
          if (!key) return
          avatarsToDelete.delete(user.id)
          await storage.delete(key)
        },
      },
    },

    // Routes génériques de Better Auth que Ruche n'utilise pas. update-user permettrait de
    // changer son nom ou son image sans passer par nos règles (image hébergée n'importe où,
    // qui révélerait l'adresse IP de chaque visiteur) : le profil passe par PATCH /v1/me.
    disabledPaths: ['/update-user'],

    rateLimit: {
      ...authSchemaOptions.rateLimit,
      enabled: rateLimit,
      // Règle générale : 100 requêtes par minute et par adresse IP.
      window: 60,
      max: 100,
      // Règles plus strictes sur les routes sensibles. 5 essais de connexion par quart d'heure
      // rendent impossible de deviner un mot de passe en essayant des milliers de combinaisons.
      customRules: {
        '/sign-in/email': { window: 15 * 60, max: 5 },
        '/sign-up/email': { window: 60 * 60, max: 10 },
        '/send-verification-email': { window: 60 * 60, max: 5 },
        '/delete-user': { window: 15 * 60, max: 5 },
      },
    },

    advanced: {
      // L'adresse IP du visiteur est transmise par Caddy dans l'en-tête X-Real-IP
      // (Caddy remplace toute valeur envoyée par le visiteur : impossible de la falsifier).
      ipAddress: { ipAddressHeaders: ['x-real-ip'] },
      cookiePrefix: 'ruche',
      // Contrôles d'origine toujours actifs, y compris pendant les tests (Better Auth les coupe
      // par défaut quand il détecte un test). Ils refusent notamment un lien de retour
      // (callbackURL) vers un site extérieur, et les requêtes venues d'un autre site.
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },

    // Les « hooks » de base de données s'exécutent juste avant ou après une écriture.
    databaseHooks: {
      user: {
        create: {
          // Avant de créer un membre : on fixe sa langue. Celle envoyée par l'appli si elle est
          // valide, sinon celle de son navigateur, sinon le français.
          // On lit la demande d'origine (context.body) : à ce stade, `user.language` vaut déjà
          // la valeur par défaut 'fr' même si l'appli n'a rien envoyé.
          before: async (user, context) => {
            const requested: unknown = context?.body?.language
            const header =
              context?.headers?.get('accept-language') ??
              context?.request?.headers.get('accept-language')
            const language = isLanguage(requested)
              ? requested
              : resolveLanguage(parseAcceptLanguage(header))
            return { data: { ...user, language } }
          },
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
