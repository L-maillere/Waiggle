import { describe, expect, it } from 'vitest'
import { loadEnv } from './env'

// On passe de fausses variables d'environnement à loadEnv : pas besoin de toucher au vrai système.
const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://ruche:secret@db:5432/ruche',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  PUBLIC_API_URL: 'https://api.ruche.app',
  APP_URL: 'https://ruche.app',
  MAIL_PROVIDER: 'brevo',
  BREVO_API_KEY: 'key',
  MAIL_FROM_EMAIL: 'no-reply@ruche.app',
}

describe('loadEnv', () => {
  it('uses safe defaults for local development', () => {
    expect(loadEnv({})).toMatchObject({
      port: 3000,
      nodeEnv: 'development',
      databaseUrl: undefined,
      publicApiUrl: 'http://localhost:3000',
      appUrl: 'http://localhost:8081',
      mail: { provider: 'console' },
    })
  })

  it('reads a complete production configuration', () => {
    expect(loadEnv({ ...production, PORT: '8080' })).toMatchObject({
      port: 8080,
      nodeEnv: 'production',
      databaseUrl: production.DATABASE_URL,
      mail: {
        provider: 'brevo',
        apiKey: 'key',
        from: { email: 'no-reply@ruche.app', name: 'Ruche' },
      },
    })
  })

  it('refuses an invalid port instead of starting half-configured', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow()
    expect(() => loadEnv({ PORT: '70000' })).toThrow()
  })

  it('refuses to start in production without a database or a strong secret', () => {
    expect(() => loadEnv({ ...production, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/)
    expect(() => loadEnv({ ...production, BETTER_AUTH_SECRET: 'short' })).toThrow(/SECRET/)
  })

  it('refuses to send real emails without an API key', () => {
    expect(() => loadEnv({ ...production, BREVO_API_KEY: undefined })).toThrow(/BREVO_API_KEY/)
  })
})
