// Lecture de la configuration du serveur (les « variables d'environnement »).
// Elles arrivent toujours sous forme de texte, et peuvent manquer ou être fausses :
// on les vérifie toutes au démarrage avec Zod, pour échouer tout de suite et clairement.
import { appName } from '@ruche/brand'
import { z } from 'zod'

// Les chaînes vides ("") sont traitées comme absentes : c'est ce que produit souvent un .env mal rempli.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional())

const EnvSchema = z
  .object({
    // z.coerce.number() convertit le texte "8080" en nombre 8080, puis vérifie qu'il est valide.
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    // Absente en développement : une base PGlite locale est utilisée à la place.
    DATABASE_URL: optional(z.string()),
    PGLITE_DIR: z.string().default('.data/pglite'),
    // Dossier des fichiers envoyés par les membres (avatars…). Dans Docker : un volume.
    MEDIA_DIR: z.string().default('.data/media'),
    MIGRATIONS_DIR: optional(z.string()),
    // Clé secrète qui signe les sessions. Qui la connaît peut se faire passer pour n'importe qui.
    BETTER_AUTH_SECRET: optional(z.string()),
    // Adresse publique de l'API (pour construire les liens dans les e-mails) et de l'appli web.
    PUBLIC_API_URL: z.url().default('http://localhost:3000'),
    APP_URL: z.url().default('http://localhost:8081'),
    MAIL_PROVIDER: z.enum(['console', 'brevo']).default('console'),
    BREVO_API_KEY: optional(z.string()),
    MAIL_FROM_EMAIL: z.email().default('no-reply@localhost.localdomain'),
    // Nom de l'expéditeur des e-mails. Vide : le nom de l'appli (@ruche/brand).
    MAIL_FROM_NAME: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().default(appName),
    ),
  })
  // superRefine : des règles qui dépendent de plusieurs variables à la fois.
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (!env.DATABASE_URL) {
        ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'required in production' })
      }
      if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
        ctx.addIssue({
          code: 'custom',
          path: ['BETTER_AUTH_SECRET'],
          message: 'required in production, at least 32 characters (openssl rand -base64 32)',
        })
      }
    }
    if (env.MAIL_PROVIDER === 'brevo' && !env.BREVO_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['BREVO_API_KEY'], message: 'required to send emails' })
    }
  })

// Secret de secours, uniquement hors production : il est public (il est dans ce fichier !).
const DEVELOPMENT_SECRET = 'development-only-secret-do-not-use-in-production'

export type MailConfig =
  | { provider: 'console' }
  | { provider: 'brevo'; apiKey: string; from: { email: string; name: string } }

export type Env = {
  port: number
  nodeEnv: 'development' | 'test' | 'production'
  databaseUrl: string | undefined
  pgliteDir: string
  mediaDir: string
  migrationsDir: string | undefined
  authSecret: string
  publicApiUrl: string
  appUrl: string
  mail: MailConfig
}

/**
 * Valide la configuration. Une valeur invalide arrête le serveur au démarrage,
 * plutôt que de provoquer une panne bizarre plus tard.
 * On passe la source en paramètre (au lieu de lire process.env directement) pour pouvoir la tester.
 */
export const loadEnv = (source: Record<string, string | undefined>): Env => {
  const result = EnvSchema.safeParse(source)
  if (!result.success) {
    // Message lisible : « BETTER_AUTH_SECRET: required in production… », une ligne par problème.
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid configuration:\n${problems.join('\n')}`)
  }
  const env = result.data
  return {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    databaseUrl: env.DATABASE_URL,
    pgliteDir: env.PGLITE_DIR,
    mediaDir: env.MEDIA_DIR,
    migrationsDir: env.MIGRATIONS_DIR,
    authSecret: env.BETTER_AUTH_SECRET ?? DEVELOPMENT_SECRET,
    publicApiUrl: env.PUBLIC_API_URL,
    appUrl: env.APP_URL,
    mail:
      env.MAIL_PROVIDER === 'brevo'
        ? {
            provider: 'brevo',
            apiKey: env.BREVO_API_KEY ?? '',
            from: { email: env.MAIL_FROM_EMAIL, name: env.MAIL_FROM_NAME },
          }
        : { provider: 'console' },
  }
}
