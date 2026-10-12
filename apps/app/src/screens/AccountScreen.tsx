// Page « Mon compte » : qui est connecté, profil, langue, déconnexion, export des données,
// suppression du compte.
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@ruche/contracts'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteAccount, downloadMyData, signOut, useSession } from '../accounts/api'
import { Button } from '../ui/Button'
import { LanguageSwitcher } from '../ui/LanguageSwitcher'
import { Notice } from '../ui/Notice'
import { Screen } from '../ui/Screen'
import { Stack } from '../ui/Stack'
import { Surface } from '../ui/Surface'
import { Text } from '../ui/Text'
import { TextField } from '../ui/TextField'

// Paramètres des messages qui citent les longueurs de mot de passe.
const lengths = { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH }

export function AccountScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { data, isPending } = useSession()
  const [password, setPassword] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)

  if (isPending) return <Screen title={t('common.loading')}>{null}</Screen>
  // Personne de connecté : on propose de se connecter.
  if (!data) {
    return (
      <Screen title={t('account.title')}>
        <Notice tone="info" message={t('errors.unauthorized')} />
        <Button label={t('home.signIn')} onPress={() => router.replace('/sign-in')} />
      </Screen>
    )
  }

  const onSignOut = async () => {
    await signOut()
    router.replace('/')
  }

  const onExport = async () => {
    setBusy('export')
    const result = await downloadMyData()
    setBusy(null)
    setExportMessage(
      result.ok
        ? { text: t('account.export.done'), ok: true }
        : { text: t(`auth.errors.${result.error}`, lengths), ok: false },
    )
  }

  const onDelete = async () => {
    setBusy('delete')
    const result = await deleteAccount(password)
    setBusy(null)
    if (result.ok) {
      router.replace('/')
      return
    }
    setDeleteError(
      result.error === 'wrongPassword'
        ? t('account.delete.wrongPassword')
        : t(`auth.errors.${result.error}`, lengths),
    )
  }

  return (
    <Screen title={t('account.title')}>
      <Stack gap="xxs">
        <Text variant="heading">{data.user.name}</Text>
        <Text tone="muted">{data.user.email}</Text>
      </Stack>
      <Button label={t('account.editProfile')} onPress={() => router.push('/profile')} />

      <Stack gap="sm">
        <Text variant="headline" accessibilityRole="header">
          {t('account.language.title')}
        </Text>
        <LanguageSwitcher />
        <Text variant="caption" tone="muted">
          {t('account.language.hint')}
        </Text>
      </Stack>

      <Button label={t('account.signOut')} variant="secondary" onPress={onSignOut} />
      <Button
        label={t('account.export.button')}
        variant="secondary"
        onPress={onExport}
        loading={busy === 'export'}
      />
      {exportMessage ? (
        <Notice tone={exportMessage.ok ? 'success' : 'error'} message={exportMessage.text} />
      ) : null}

      {/* Zone de suppression, dans son propre cadre : c'est une action définitive. */}
      <Surface variant="grouped" padding="lg" gap="md">
        <Text variant="headline" tone="danger" accessibilityRole="header">
          {t('account.delete.title')}
        </Text>
        <Text>{t('account.delete.warning')}</Text>
        <Text variant="callout" tone="muted">
          {t('account.delete.exportFirst')}
        </Text>
        <TextField
          label={t('account.delete.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          error={deleteError ?? undefined}
        />
        <Button
          label={t('account.delete.submit')}
          variant="danger"
          onPress={onDelete}
          loading={busy === 'delete'}
          disabled={password.length === 0} // impossible de supprimer sans avoir tapé son mot de passe
        />
      </Surface>
    </Screen>
  )
}
