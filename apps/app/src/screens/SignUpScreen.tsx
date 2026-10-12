// Écran d'inscription : prénom, e-mail, mot de passe. Après envoi, le membre doit cliquer sur le
// lien reçu par e-mail avant de pouvoir se connecter.
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, SignUpRequest } from '@ruche/contracts'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { signUp } from '../accounts/api'
import type { AuthErrorKey } from '../accounts/errors'
import { type FieldErrors, fieldErrorsFrom } from '../accounts/validation'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { Screen } from '../ui/Screen'
import { TextField } from '../ui/TextField'

// Paramètres des messages qui citent les longueurs de mot de passe.
const lengths = { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH }

export function SignUpScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()

  // useState garde une valeur qui change (ce que tape le membre) et redessine l'écran à chaque
  // changement. Il renvoie la valeur et la fonction pour la modifier.
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<AuthErrorKey | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    // 1. Vérification locale avec le même schéma que l'API (packages/contracts).
    const parsed = SignUpRequest.safeParse({ name, email, password, language: i18n.language })
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error))
      return
    }
    setFieldErrors({})
    setError(null)
    setLoading(true)
    // 2. Envoi à l'API, puis 3. écran suivant ou message d'erreur.
    const result = await signUp(parsed.data)
    setLoading(false)
    if (result.ok) {
      router.push({ pathname: '/check-email', params: { email: parsed.data.email } })
    } else {
      setError(result.error)
    }
  }

  // Traduit une clé d'erreur de champ en message (ou rien s'il n'y a pas d'erreur).
  const fieldMessage = (key: FieldErrors[keyof FieldErrors]) =>
    key ? t(`auth.errors.${key}`, lengths) : undefined

  return (
    <Screen title={t('auth.signUp.title')}>
      <TextField
        label={t('auth.fields.name')}
        value={name}
        onChangeText={setName}
        autoComplete="name"
        error={fieldMessage(fieldErrors.name)}
      />
      <TextField
        label={t('auth.fields.email')}
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        keyboardType="email-address"
        error={fieldMessage(fieldErrors.email)}
      />
      <TextField
        label={t('auth.fields.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry // masque les caractères tapés
        autoComplete="new-password" // les gestionnaires de mots de passe proposent d'en générer un
        hint={t('auth.fields.passwordHint', lengths)}
        error={fieldMessage(fieldErrors.password)}
      />
      {error ? <Notice message={t(`auth.errors.${error}`, lengths)} /> : null}
      <Button label={t('auth.signUp.submit')} onPress={submit} loading={loading} />
      <Button
        label={t('auth.signUp.switch')}
        variant="secondary"
        onPress={() => router.push('/sign-in')}
      />
    </Screen>
  )
}
