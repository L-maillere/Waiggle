// Tests du résumé d'erreur écrit dans les journaux (logs) du serveur.
import { describe, expect, it } from 'vitest'
import { describeError } from './log'

describe('describeError', () => {
  it('keeps what helps to debug: the kind of error, its code and where it happened', () => {
    const cause = Object.assign(new Error('invalid byte sequence'), { code: '22021' })
    const error = new Error('Failed query: update "profile" set "bio" = $1\nparams: x', { cause })

    const summary = describeError(error, { method: 'PATCH', path: '/v1/me' })

    expect(summary).toMatchObject({ name: 'Error', code: '22021', method: 'PATCH', path: '/v1/me' })
    expect(summary.stack.length).toBeGreaterThan(0)
  })

  it('never copies the message, which may contain what the member typed', () => {
    const error = new Error('Failed query\nparams: lea@example.com,Ma bio secrète')

    const text = JSON.stringify(describeError(error, { method: 'PATCH', path: '/v1/me' }))

    expect(text).not.toContain('lea@example.com')
    expect(text).not.toContain('Ma bio secrète')
  })

  it('copes with something thrown that is not an Error', () => {
    expect(describeError('oops', { method: 'GET', path: '/' })).toMatchObject({ name: 'string' })
  })
})
