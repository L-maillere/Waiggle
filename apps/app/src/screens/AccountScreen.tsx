// Page « Mon compte » : qui est connecté, profil, langue, déconnexion, export des données,
// suppression du compte.
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@ruche/contracts'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { deleteAccount, downloadMyData, signOut, useSession } from '../accounts/api'
import { useColors } from '../theme'
import { Button } from '../ui/Button'
import { LanguageSwitcher } from '../ui/LanguageSwitcher'
import { Notice } from '../ui/Notice'
import { Screen } from '../ui/Screen'
import { TextField } from '../ui/TextField'

// Paramètres des messages qui citent les longueurs de mot de passe.
const lengths = { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH }

export function AccountScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const c = useColors()
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
      <View style={styles.identity}>
        <Text style={[styles.name, { color: c.text }]}>{data.user.name}</Text>
        <Text style={{ color: c.muted }}>{data.user.email}</Text>
      </View>
      <Button label={t('account.editProfile')} onPress={() => router.push('/profile')} />

      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: c.text }]}>
          {t('account.language.title')}
        </Text>
        <LanguageSwitcher />
        <Text style={{ color: c.muted }}>{t('account.language.hint')}</Text>
      </View>

      <Button label={t('account.signOut')} variant="secondary" onPress={onSignOut} />
      <Button
        label={t('account.export.button')}
        variant="secondary"
        onPress={onExport}
        loading={busy === 'export'}
      />
      {exportMessage ? (
        <Notice tone={exportMessage.ok ? 'info' : 'error'} message={exportMessage.text} />
      ) : null}

      {/* Zone de suppression, séparée visuellement : c'est une action définitive. */}
      <View style={[styles.danger, { borderColor: c.danger }]}>
        <Text accessibilityRole="header" style={[styles.dangerTitle, { color: c.danger }]}>
          {t('account.delete.title')}
        </Text>
        <Text style={{ color: c.text }}>{t('account.delete.warning')}</Text>
        <Text style={{ color: c.muted }}>{t('account.delete.exportFirst')}</Text>
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
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  identity: { gap: 2 },
  name: { fontSize: 20, fontWeight: '700' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  danger: { gap: 10, borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 8 },
  dangerTitle: { fontSize: 17, fontWeight: '700' },
})
