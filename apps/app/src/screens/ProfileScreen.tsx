// Page « Mon profil » : photo, nom, bio et outils favoris du membre connecté.
import {
  AVATAR_MAX_BYTES,
  BIO_MAX_LENGTH,
  FAVORITE_TOOLS_MAX,
  type Me,
  NAME_MAX_LENGTH,
  TOOL_MAX_LENGTH,
} from '@ruche/contracts'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { useSession } from '../accounts/api'
import { ApiError, type ApiErrorKey } from '../api/errors'
import { pickAvatar, updateProfile, uploadAvatar } from '../profile/api'
import { type ProfileFormErrors, toProfileUpdate } from '../profile/form'
import { useMe, useSetMe } from '../profile/hooks'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { Screen } from '../ui/Screen'
import { TextField } from '../ui/TextField'

export function ProfileScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const me = useMe(Boolean(session))

  if (isPending) return <Screen title={t('common.loading')}>{null}</Screen>
  if (!session) {
    return (
      <Screen title={t('profile.title')}>
        <Notice tone="info" message={t('errors.unauthorized')} />
        <Button label={t('home.signIn')} onPress={() => router.replace('/sign-in')} />
      </Screen>
    )
  }
  if (me.error) {
    // L'erreur levée par getMe porte la clé du message (voir ApiError dans api/client.ts).
    const key = me.error instanceof ApiError ? me.error.key : 'internal'
    return (
      <Screen title={t('profile.title')}>
        <Notice message={t(`errors.${key}`)} />
      </Screen>
    )
  }
  if (!me.data) return <Screen title={t('common.loading')}>{null}</Screen>
  // Le formulaire n'est affiché qu'une fois le profil chargé : il part ainsi des bonnes valeurs.
  return <ProfileForm me={me.data} />
}

type Message = { text: string; ok: boolean } | null

function ProfileForm({ me }: { me: Me }) {
  const { t } = useTranslation()
  const { refetch: refetchSession } = useSession()
  const setMe = useSetMe()

  // Un useState par champ : la valeur affichée, et la fonction pour la changer.
  const [name, setName] = useState(me.name)
  const [bio, setBio] = useState(me.bio)
  const [tools, setTools] = useState(me.favoriteTools.join(', '))
  const [errors, setErrors] = useState<ProfileFormErrors>({})
  const [message, setMessage] = useState<Message>(null)
  const [busy, setBusy] = useState<'save' | 'avatar' | null>(null)

  const onSave = async () => {
    setMessage(null)
    // On vérifie avant d'envoyer : le membre voit tout de suite ce qui ne va pas.
    const checked = toProfileUpdate({ name, bio, tools })
    if (!checked.ok) {
      setErrors(checked.errors)
      return
    }
    setErrors({})
    setBusy('save')
    const result = await updateProfile(checked.changes)
    setBusy(null)
    if (!result.ok) {
      setMessage({ text: t(`errors.${result.error}`), ok: false })
      return
    }
    setMe(result.data) // le cache partagé reçoit le profil à jour
    setTools(result.data.favoriteTools.join(', ')) // affiche la liste nettoyée (sans doublons)
    void refetchSession() // la session porte aussi le nom (affiché sur l'accueil) : on la relit
    setMessage({ text: t('profile.saved'), ok: true })
  }

  const onChangeAvatar = async () => {
    setMessage(null)
    try {
      const picked = await pickAvatar()
      if (!picked) return // le membre a annulé : rien à faire
      setBusy('avatar')
      const result = await uploadAvatar(picked)
      if (result.ok) {
        setMe(result.data)
        setMessage({ text: t('profile.avatar.updated'), ok: true })
      } else {
        setMessage({ text: avatarError(result.error), ok: false })
      }
    } catch {
      // Image illisible sur l'appareil, par exemple.
      setMessage({ text: t('errors.internal'), ok: false })
    } finally {
      // finally : exécuté dans tous les cas, réussite ou erreur.
      setBusy(null)
    }
  }

  // Pour l'avatar, des messages plus précis que les messages génériques.
  const avatarError = (error: ApiErrorKey) => {
    if (error === 'payloadTooLarge') {
      return t('profile.errors.avatarTooLarge', { max: AVATAR_MAX_BYTES / (1024 * 1024) })
    }
    if (error === 'unsupportedMediaType') return t('profile.errors.avatarType')
    return t(`errors.${error}`)
  }

  const nameError =
    errors.name === 'nameTooLong'
      ? t('profile.errors.nameTooLong', { max: NAME_MAX_LENGTH })
      : errors.name && t('auth.errors.nameRequired')
  const toolsError =
    errors.tools &&
    t(`profile.errors.${errors.tools}`, {
      max: errors.tools === 'tooManyTools' ? FAVORITE_TOOLS_MAX : TOOL_MAX_LENGTH,
    })

  return (
    <Screen title={t('profile.title')}>
      <View style={styles.avatar}>
        <Avatar name={name} url={me.avatarUrl} label={t('profile.avatar.label')} />
        <Button
          label={t('profile.avatar.change')}
          variant="secondary"
          onPress={onChangeAvatar}
          loading={busy === 'avatar'}
        />
      </View>

      <TextField
        label={t('auth.fields.name')}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        maxLength={NAME_MAX_LENGTH}
        error={nameError || undefined}
      />
      <TextField
        label={t('profile.fields.bio')}
        value={bio}
        onChangeText={setBio}
        autoCapitalize="sentences"
        multiline
        // Pas de maxLength ici : le compteur montre la limite sans couper le texte en plein milieu.
        hint={t('profile.fields.bioCounter', { count: bio.length, max: BIO_MAX_LENGTH })}
        error={errors.bio && t('profile.errors.bioTooLong', { max: BIO_MAX_LENGTH })}
      />
      <TextField
        label={t('profile.fields.tools')}
        value={tools}
        onChangeText={setTools}
        hint={t('profile.fields.toolsHint', { max: FAVORITE_TOOLS_MAX })}
        error={toolsError || undefined}
      />

      {message ? <Notice tone={message.ok ? 'info' : 'error'} message={message.text} /> : null}
      <Button label={t('profile.save')} onPress={onSave} loading={busy === 'save'} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', gap: 12 },
})
