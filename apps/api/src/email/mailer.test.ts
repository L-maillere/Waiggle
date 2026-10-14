import { describe, expect, it } from 'vitest'
import { createBrevoMailer } from './mailer'

const email = { to: 'lea@example.com', subject: 'Sujet', text: 'Texte', html: '<p>Texte</p>' }

describe('createBrevoMailer', () => {
  it('sends the email through the Brevo API, with the key in a header and no tracking', async () => {
    // Un faux `fetch` qui note la requête au lieu de l'envoyer sur Internet.
    const calls: { url: string; init: RequestInit }[] = []
    const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return new Response(JSON.stringify({ messageId: 'm1' }), { status: 201 })
    }
    const mailer = createBrevoMailer({
      apiKey: 'test-key',
      from: { email: 'no-reply@waiggle.io', name: 'Ruche' },
      fetch: fakeFetch,
    })

    await mailer.send(email)

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://api.brevo.com/v3/smtp/email')
    const headers = new Headers(calls[0]?.init.headers)
    expect(headers.get('api-key')).toBe('test-key')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      sender: { email: 'no-reply@waiggle.io', name: 'Ruche' },
      // Pas de pixel d'ouverture ni de lien de suivi : la promesse « pas de traqueurs ».
      to: [{ email: 'lea@example.com', contactPixelTrackingConsent: false }],
      subject: 'Sujet',
      textContent: 'Texte',
      htmlContent: '<p>Texte</p>',
    })
  })

  it('fails loudly when Brevo refuses the email', async () => {
    const mailer = createBrevoMailer({
      apiKey: 'bad-key',
      from: { email: 'no-reply@waiggle.io', name: 'Ruche' },
      fetch: async () => new Response('unauthorized', { status: 401 }),
    })

    await expect(mailer.send(email)).rejects.toThrow(/401/)
  })
})
