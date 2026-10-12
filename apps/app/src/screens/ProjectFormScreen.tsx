// Formulaire de projet : publier un nouveau projet (sans `id`) ou modifier le sien (avec `id`).
import {
  PROJECT_DESCRIPTION_MAX,
  PROJECT_PITCH_MAX,
  PROJECT_PROMPT_MAX_LENGTH,
  PROJECT_PROMPTS_MAX,
  PROJECT_TITLE_MAX,
  PROJECT_TOOLS_MAX,
  ProjectStatus,
  ProjectVisibility,
  TimeSpent,
  TOOL_MAX_LENGTH,
} from '@ruche/contracts'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '../accounts/api'
import { ApiError } from '../api/errors'
import { createProject, updateProject } from '../projects/api'
import {
  emptyProjectForm,
  formFromProject,
  type ProjectForm,
  type ProjectFormErrors,
  toProjectChanges,
} from '../projects/form'
import { useProject, useSetProject } from '../projects/hooks'
import { Button } from '../ui/Button'
import { Choices } from '../ui/Choices'
import { Notice } from '../ui/Notice'
import { Screen } from '../ui/Screen'
import { Stack } from '../ui/Stack'
import { Text } from '../ui/Text'
import { TextField } from '../ui/TextField'

export function ProjectFormScreen({ id }: { id?: string | undefined }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { data: session, isPending } = useSession()
  // En modification, on part du projet existant ; en création, il n'y a rien à charger.
  const project = useProject(id ?? '', Boolean(session && id))

  if (isPending) return <Screen title={t('common.loading')}>{null}</Screen>
  if (!session) {
    return (
      <Screen>
        <Notice tone="info" message={t('errors.unauthorized')} />
        <Button label={t('home.signIn')} onPress={() => router.replace('/sign-in')} />
      </Screen>
    )
  }
  if (!id) return <ProjectFormView initial={emptyProjectForm} />

  if (project.error) {
    const key = project.error instanceof ApiError ? project.error.key : 'internal'
    return (
      <Screen>
        <Notice message={key === 'notFound' ? t('project.page.notFound') : t(`errors.${key}`)} />
      </Screen>
    )
  }
  if (!project.data) return <Screen title={t('common.loading')}>{null}</Screen>
  if (!project.data.isMine) {
    return (
      <Screen>
        <Notice message={t('project.page.notMine')} />
      </Screen>
    )
  }
  return <ProjectFormView initial={formFromProject(project.data)} projectId={id} />
}

// La limite à citer dans chaque message d'erreur (« au plus {{max}} caractères »).
const limits: Record<string, number> = {
  titleTooLong: PROJECT_TITLE_MAX,
  pitchTooLong: PROJECT_PITCH_MAX,
  descriptionTooLong: PROJECT_DESCRIPTION_MAX,
  tooManyTools: PROJECT_TOOLS_MAX,
  toolTooLong: TOOL_MAX_LENGTH,
  tooManyPrompts: PROJECT_PROMPTS_MAX,
  promptTooLong: PROJECT_PROMPT_MAX_LENGTH,
}

type ViewProps = { initial: ProjectForm; projectId?: string }

function ProjectFormView({ initial, projectId }: ViewProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const setProject = useSetProject()
  // Tout le formulaire dans un seul état : un objet, modifié champ par champ.
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<ProjectFormErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /**
   * Fabrique la fonction qui change un champ. `<K extends keyof ProjectForm>` : K est le nom d'un
   * champ, et la valeur doit avoir le type de ce champ (TypeScript refuse un statut inconnu…).
   * `{ ...previous, [key]: value }` : une copie de l'objet, avec ce seul champ remplacé.
   */
  const change =
    <K extends keyof ProjectForm>(key: K) =>
    (value: ProjectForm[K]) =>
      setForm((previous) => ({ ...previous, [key]: value }))

  const errorText = (key: string | undefined) =>
    key && t(`project.errors.${key}` as 'project.errors.titleRequired', { max: limits[key] })

  const setPrompt = (index: number, text: string) =>
    change('prompts')(form.prompts.map((prompt, i) => (i === index ? text : prompt)))

  const onSubmit = async () => {
    setMessage(null)
    const checked = toProjectChanges(form)
    if (!checked.ok) {
      setErrors(checked.errors)
      return
    }
    setErrors({})
    setBusy(true)
    const result = projectId
      ? await updateProject(projectId, checked.changes)
      : await createProject(checked.changes)
    setBusy(false)
    if (!result.ok) {
      setMessage(t(`errors.${result.error}`))
      return
    }
    setProject(result.data) // la page du projet s'affichera sans nouvelle requête
    router.replace({ pathname: '/projects/[id]', params: { id: result.data.id } })
  }

  return (
    <Screen title={projectId ? t('project.edit.title') : t('project.new.title')}>
      <TextField
        label={t('project.fields.title')}
        value={form.title}
        onChangeText={change('title')}
        autoCapitalize="sentences"
        maxLength={PROJECT_TITLE_MAX}
        error={errorText(errors.title)}
      />
      <TextField
        label={t('project.fields.pitch')}
        value={form.pitch}
        onChangeText={change('pitch')}
        autoCapitalize="sentences"
        hint={t('project.fields.pitchCounter', {
          count: form.pitch.length,
          max: PROJECT_PITCH_MAX,
        })}
        error={errorText(errors.pitch)}
      />
      <Choices
        label={t('project.fields.status')}
        options={ProjectStatus.options.map((value) => ({
          value,
          label: t(`project.status.${value}`),
        }))}
        value={form.status}
        onChange={change('status')}
      />
      <Choices
        label={t('project.fields.visibility')}
        options={ProjectVisibility.options.map((value) => ({
          value,
          label: t(`project.visibility.${value}`),
        }))}
        value={form.visibility}
        onChange={change('visibility')}
      />
      <TextField
        label={t('project.fields.demoUrl')}
        value={form.demoUrl}
        onChangeText={change('demoUrl')}
        keyboardType="url"
        hint={t('project.fields.demoUrlHint')}
        error={errorText(errors.demoUrl)}
      />
      <TextField
        label={t('project.fields.description')}
        value={form.description}
        onChangeText={change('description')}
        autoCapitalize="sentences"
        multiline
        hint={t('project.fields.descriptionHint')}
        error={errorText(errors.description)}
      />
      <TextField
        label={t('project.fields.tools')}
        value={form.tools}
        onChangeText={change('tools')}
        hint={t('project.fields.toolsHint', { max: PROJECT_TOOLS_MAX })}
        error={errorText(errors.tools)}
      />
      <Choices
        label={t('project.fields.timeSpent')}
        // « Non précisé » correspond à null : on le représente par la valeur 'unknown'.
        options={(['unknown', ...TimeSpent.options] as const).map((value) => ({
          value,
          label: t(`project.timeSpent.${value}`),
        }))}
        value={form.timeSpent ?? 'unknown'}
        onChange={(value) => change('timeSpent')(value === 'unknown' ? null : value)}
      />

      <Stack gap="md">
        <Text variant="headline">{t('project.fields.prompts')}</Text>
        <Text variant="callout" tone={errors.prompts ? 'danger' : 'muted'}>
          {errorText(errors.prompts) ||
            t('project.fields.promptsHint', { max: PROJECT_PROMPTS_MAX })}
        </Text>
        {form.prompts.map((prompt, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: un prompt n'a pas d'identifiant ; sa position en tient lieu
          <Stack key={i} gap="sm">
            <TextField
              label={t('project.fields.prompt', { number: i + 1 })}
              value={prompt}
              onChangeText={(text) => setPrompt(i, text)}
              multiline
            />
            <Button
              label={t('project.fields.removePrompt', { number: i + 1 })}
              variant="secondary"
              size="compact"
              icon="trash"
              onPress={() => change('prompts')(form.prompts.filter((_, j) => j !== i))}
            />
          </Stack>
        ))}
        {form.prompts.length < PROJECT_PROMPTS_MAX ? (
          <Button
            label={t('project.fields.addPrompt')}
            variant="secondary"
            icon="plus"
            onPress={() => change('prompts')([...form.prompts, ''])}
          />
        ) : null}
      </Stack>

      {message ? <Notice message={message} /> : null}
      <Button
        label={projectId ? t('project.edit.submit') : t('project.new.submit')}
        onPress={onSubmit}
        loading={busy}
      />
    </Screen>
  )
}
