import { z } from 'zod'

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type Env = { port: number; nodeEnv: 'development' | 'test' | 'production' }

/** Validates configuration at startup: a bad value stops the server instead of failing later. */
export const loadEnv = (source: Record<string, string | undefined>): Env => {
  const env = EnvSchema.parse(source)
  return { port: env.PORT, nodeEnv: env.NODE_ENV }
}
