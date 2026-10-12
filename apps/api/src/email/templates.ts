// Les e-mails envoyés par Ruche, dans la langue du membre.
// Chaque e-mail existe en deux versions : texte brut (lu par tous les logiciels de messagerie)
// et HTML (plus joli). Les textes viennent de @ruche/i18n, comme ceux de l'appli.
import { type Language, resources } from '@ruche/i18n'

export type Email = { to: string; subject: string; text: string; html: string }
export type EmailContent = Omit<Email, 'to'>

const APP_NAME = 'Ruche'

// Remplace {{param}} par sa valeur : fill('Bonjour {{name}}', { name: 'Léa' }) → 'Bonjour Léa'.
const fill = (template: string, params: Record<string, string>) =>
  template.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => params[key] ?? '')

/**
 * « Échappe » un texte avant de l'insérer dans du HTML : < devient &lt;, etc.
 * Sans ça, un membre qui s'appellerait `<img src=x onerror=...>` pourrait glisser du code
 * dans les e-mails. Règle d'or : tout ce qui vient d'un utilisateur est échappé.
 */
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

type Layout = {
  greeting: string
  paragraphs: string[]
  button: { label: string; url: string }
  note: string
  footer: string
}

// Mise en page commune à tous les e-mails. Styles écrits directement dans les balises :
// beaucoup de messageries ignorent les feuilles de style.
const render = ({ greeting, paragraphs, button, note, footer }: Layout) => ({
  text: [greeting, '', ...paragraphs, '', button.url, '', note, '', '—', footer].join('\n'),
  html: `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fffbf2;font-family:Arial,sans-serif;color:#1f1a12">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #eadfc8;border-radius:16px;padding:28px">
    <p style="font-size:16px">${escapeHtml(greeting)}</p>
    ${paragraphs.map((p) => `<p style="font-size:16px;line-height:1.5">${escapeHtml(p)}</p>`).join('\n    ')}
    <p style="margin:28px 0">
      <a href="${escapeHtml(button.url)}" style="background:#b87a00;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">${escapeHtml(button.label)}</a>
    </p>
    <p style="font-size:13px;color:#6b5e4a">${escapeHtml(note)}</p>
  </div>
  <p style="text-align:center;font-size:12px;color:#6b5e4a">${escapeHtml(footer)}</p>
</body></html>`,
})

/** L'e-mail qui contient le lien pour vérifier l'adresse et activer le compte. */
export const verificationEmail = (
  language: Language,
  { name, url }: { name: string; url: string },
): EmailContent => {
  const t = resources[language].translation.email
  return {
    subject: fill(t.verify.subject, { appName: APP_NAME }),
    ...render({
      greeting: fill(t.greeting, { name }),
      paragraphs: [t.verify.body, t.verify.expires],
      button: { label: t.verify.button, url },
      note: t.verify.ignore,
      footer: fill(t.footer, { appName: APP_NAME }),
    }),
  }
}

/**
 * L'e-mail envoyé quand quelqu'un essaie de s'inscrire avec une adresse déjà utilisée.
 * L'API répond comme pour une inscription normale (pour ne pas révéler que l'adresse existe),
 * et c'est le vrai propriétaire de l'adresse qui est prévenu, ici.
 */
export const existingAccountEmail = (
  language: Language,
  { name, signInUrl }: { name: string; signInUrl: string },
): EmailContent => {
  const t = resources[language].translation.email
  return {
    subject: fill(t.existingAccount.subject, { appName: APP_NAME }),
    ...render({
      greeting: fill(t.greeting, { name }),
      paragraphs: [t.existingAccount.body],
      button: { label: t.existingAccount.button, url: signInUrl },
      note: t.existingAccount.ignore,
      footer: fill(t.footer, { appName: APP_NAME }),
    }),
  }
}
