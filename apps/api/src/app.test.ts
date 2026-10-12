import { ErrorResponse, HealthResponse } from '@ruche/contracts'
import { describe, expect, it } from 'vitest'
import { createApp } from './app'

const app = createApp({ version: '9.9.9' })

describe('GET /health', () => {
  it('answers ok with the running version', async () => {
    const res = await app.request('/health')

    expect(res.status).toBe(200)
    expect(HealthResponse.parse(await res.json())).toEqual({ status: 'ok', version: '9.9.9' })
  })
})

describe('GET /openapi.json', () => {
  it('publishes the API contract, including the health route', async () => {
    const res = await app.request('/openapi.json')
    const doc = (await res.json()) as { info: { title: string }; paths: Record<string, unknown> }

    expect(res.status).toBe(200)
    expect(doc.info.title).toBe('Ruche API')
    expect(doc.paths['/health']).toBeDefined()
  })
})

describe('unknown routes', () => {
  it('answer 404 in French by default', async () => {
    const res = await app.request('/does-not-exist')
    const body = ErrorResponse.parse(await res.json())

    expect(res.status).toBe(404)
    expect(res.headers.get('content-language')).toBe('fr')
    expect(body.error).toEqual({ code: 'not_found', message: "Cette page n'existe pas." })
  })

  it('answer in English when the client prefers it', async () => {
    const res = await app.request('/does-not-exist', {
      headers: { 'Accept-Language': 'en-US,en;q=0.9,fr;q=0.5' },
    })
    const body = ErrorResponse.parse(await res.json())

    expect(res.headers.get('content-language')).toBe('en')
    expect(body.error.message).toBe('This page does not exist.')
  })
})

describe('security headers', () => {
  it('are set on every response', async () => {
    const res = await app.request('/health')

    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(res.headers.get('strict-transport-security')).toContain('max-age=')
  })
})
