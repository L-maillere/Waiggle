import { describe, expect, it } from 'vitest'
import { SignUpRequest } from './accounts'

const valid = { name: 'Léa', email: 'lea@example.com', password: 'correct-horse-battery' }

describe('SignUpRequest', () => {
  it('accepts a name, an email and a password of at least 12 characters', () => {
    expect(SignUpRequest.safeParse(valid).success).toBe(true)
  })

  it('refuses a password shorter than 12 characters', () => {
    expect(SignUpRequest.safeParse({ ...valid, password: 'short-pass1' }).success).toBe(false)
  })

  it('refuses an invalid email address', () => {
    expect(SignUpRequest.safeParse({ ...valid, email: 'lea.example.com' }).success).toBe(false)
  })

  it('refuses a name made only of spaces', () => {
    expect(SignUpRequest.safeParse({ ...valid, name: '   ' }).success).toBe(false)
  })

  it('only accepts supported languages', () => {
    expect(SignUpRequest.safeParse({ ...valid, language: 'en' }).success).toBe(true)
    expect(SignUpRequest.safeParse({ ...valid, language: 'de' }).success).toBe(false)
  })
})
