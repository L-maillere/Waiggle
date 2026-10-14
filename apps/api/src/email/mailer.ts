// L'envoi des e-mails. Le reste du code ne parle qu'à l'interface `Mailer` (« envoie cet e-mail »),
// sans savoir qui l'envoie vraiment. On peut ainsi brancher :
// - Brevo en production (prestataire français d'e-mails),
// - la console en développement (le lien s'affiche dans le terminal),
// - une boîte en mémoire dans les tests (on peut relire ce qui aurait été envoyé).
import type { Email } from './templates'

export type { Email }

export interface Mailer {
  send(email: Email): Promise<void>
}

/** Pour les tests : garde les e-mails dans un tableau au lieu de les envoyer. */
export const createMemoryMailer = () => {
  const sent: Email[] = []
  return {
    sent,
    async send(email: Email) {
      sent.push(email)
    },
  } satisfies Mailer & { sent: Email[] }
}

/** Pour le développement : affiche l'e-mail (et donc le lien à cliquer) dans le terminal. */
export const createConsoleMailer = (): Mailer => ({
  async send({ to, subject, text }) {
    console.log(`\n--- E-mail pour ${to} ---\n${subject}\n\n${text}\n--- fin ---\n`)
  },
})

type BrevoOptions = {
  apiKey: string
  from: { email: string; name: string }
  /** Remplaçable dans les tests, pour ne rien envoyer sur Internet. */
  fetch?: typeof fetch
}

/** Pour la production : envoi par l'API HTTP de Brevo. */
export const createBrevoMailer = ({
  apiKey,
  from,
  fetch: doFetch = fetch,
}: BrevoOptions): Mailer => ({
  async send({ to, subject, text, html }) {
    const res = await doFetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: from,
        // contactPixelTrackingConsent: false → Brevo n'insère ni pixel d'ouverture ni lien de
        // suivi des clics dans cet e-mail (les liens pointent directement chez nous). C'est la
        // promesse « pas de traqueurs », et un membre n'a jamais à passer par un domaine inconnu
        // pour activer son compte. Le réglage « consentement par contact » du compte Brevo fait la
        // même chose par défaut : les deux ensemble, au cas où l'un des deux saute.
        to: [{ email: to, contactPixelTrackingConsent: false }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(10_000), // on n'attend jamais plus de 10 secondes
    })
    // Un échec d'envoi doit se voir : on lève une erreur plutôt que de l'ignorer en silence.
    // On ne recopie pas la réponse de Brevo, qui pourrait contenir des détails internes.
    if (!res.ok) throw new Error(`Brevo refused the email (HTTP ${res.status})`)
  },
})
