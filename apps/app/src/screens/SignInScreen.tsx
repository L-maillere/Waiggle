// Écran de connexion : e-mail et mot de passe.
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, SignInRequest } from '@ruche/contracts'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { signIn } from '../accounts/api'
import type { AuthErrorKey } from '../accounts/errors'
import { type FieldErrors, fieldErrorsFrom } from '../accounts/validation'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { Screen } from '../ui/Screen'
import { TextField } from '../ui/TextField'

// Paramètres des messages qui citent les longueurs de mot de passe.
const lengths = { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH }

export function SignInScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<AuthErrorKey | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const parsed = SignInRequest.safeParse({ email, password })
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error))
      return
    }
    setFieldErrors({})
    setError(null)
    setLoading(true)
    const result = await signIn(parsed.data)
    setLoading(false)
    // replace (et non push) : le bouton « retour » ne ramènera pas sur l'écran de connexion.
    if (result.ok) router.replace('/')
    else setError(result.error)
  }

  return (
    <Screen title={t('auth.signIn.title')}>
      <TextField
        label={t('auth.fields.email')}
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        keyboardType="email-address"
        error={fieldErrors.email ? t('auth.errors.invalidEmail') : undefined}
      />
      <TextField
        label={t('auth.fields.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
      />
      {error ? <Notice message={t(`auth.errors.${error}`, lengths)} /> : null}
      <Button label={t('auth.signIn.submit')} onPress={submit} loading={loading} />
      <Button
        label={t('auth.signIn.switch')}
        variant="secondary"
        onPress={() => router.push('/sign-up')}
      />
    </Screen>
  )
}
