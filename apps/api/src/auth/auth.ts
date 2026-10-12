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
import type { Mailer } from '../email/mailer'
import { existingAccountEmail, verificationEmail } from '../email/templates'
import { authSchemaOptions } from './schema-options'

export type AuthOptions = {
  db: Database
  mailer: Mailer
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

export const createAuth = ({ db, mailer, secret, publicApiUrl, appUrl, rateLimit }: AuthOptions) =>
  betterAuth({
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
      deleteUser: { enabled: true },
    },

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

export type Auth = ReturnType<typeof createAuth>
