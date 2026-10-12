// Le choix de la langue, en contrôle segmenté. Pour un membre connecté, le choix est aussi
// enregistré sur son compte (il le retrouve sur ses autres appareils et dans ses e-mails).
import { type Language, supportedLanguages } from '@ruche/i18n'
import { useTranslation } from 'react-i18next'
import { useSession } from '../accounts/api'
import { updateProfile } from '../profile/api'
import { useSetMe } from '../profile/hooks'
import { Segmented } from './Segmented'

type Props = {
  /** compact : « FR / EN », pour un coin d'écran ; sinon les noms complets. */
  compact?: boolean
}

export function LanguageSwitcher({ compact = false }: Props) {
  const { t, i18n } = useTranslation()
  const { data: session } = useSession()
  const setMe = useSetMe()

  const choose = async (language: Language) => {
    // D'abord l'écran, immédiatement : le membre voit le résultat sans attendre le réseau.
    await i18n.changeLanguage(language)
    if (!session) return
    // Puis le compte. Si l'enregistrement échoue (réseau coupé…), l'écran reste dans la langue
    // choisie : seul le souvenir sur les autres appareils est perdu, inutile d'inquiéter le membre.
    const result = await updateProfile({ language })
    if (result.ok) setMe(result.data)
  }

  return (
    <Segmented
      label={t('common.language')}
      // .map() transforme chaque langue en option du contrôle
      options={supportedLanguages.map((language) => ({
        value: language,
        // En version compacte, on affiche le code (« FR ») mais on lit le nom (« Français »).
        label: compact ? language.toUpperCase() : t(`common.languages.${language}`),
        spokenLabel: t(`common.languages.${language}`),
      }))}
      value={i18n.language as Language}
      onChange={(language) => void choose(language)}
      fill={!compact}
    />
  )
}
