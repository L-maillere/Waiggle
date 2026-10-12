// Lecture de la configuration du serveur (les « variables d'environnement »).
// Elles arrivent toujours sous forme de texte, et peuvent manquer ou être fausses :
// on les vérifie toutes au démarrage avec Zod, pour échouer tout de suite et clairement.
import { z } from 'zod'

const EnvSchema = z.object({
  // z.coerce.number() convertit le texte "8080" en nombre 8080, puis vérifie qu'il est valide.
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type Env = { port: number; nodeEnv: 'development' | 'test' | 'production' }

/**
 * Valide la configuration. Une valeur invalide arrête le serveur au démarrage,
 * plutôt que de provoquer une panne bizarre plus tard.
 * On passe la source en paramètre (au lieu de lire process.env directement) pour pouvoir la tester.
 */
export const loadEnv = (source: Record<string, string | undefined>): Env => {
  const env = EnvSchema.parse(source)
  return { port: env.PORT, nodeEnv: env.NODE_ENV }
}
