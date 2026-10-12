import { describe, expect, it } from 'vitest'
import { loadEnv } from './env'

describe('loadEnv', () => {
  it('uses safe defaults for local development', () => {
    expect(loadEnv({})).toEqual({ port: 3000, nodeEnv: 'development' })
  })

  it('reads the port and environment from variables', () => {
    expect(loadEnv({ PORT: '8080', NODE_ENV: 'production' })).toEqual({
      port: 8080,
      nodeEnv: 'production',
    })
  })

  it('refuses an invalid port instead of starting half-configured', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow()
    expect(() => loadEnv({ PORT: '70000' })).toThrow()
  })
})
