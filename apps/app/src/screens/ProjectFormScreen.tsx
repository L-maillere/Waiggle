// Formulaire de projet : publier un nouveau projet (sans `id`) ou modifier le sien (avec `id`).
import {
  PROJECT_DESCRIPTION_MAX,
  PROJECT_PITCH_MAX,
  PROJECT_PROMPT_MAX_LENGTH,
  PROJECT_PROMPTS_MAX,
  PROJECT_TITLE_MAX,
  PROJECT_TOOLS_MAX,
  ProjectStatus,
  publicHttpsUrl,
  TimeSpent,
  TOOL_MAX_LENGTH,
} from '@ruche/contracts'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '../accounts/api'
import { ApiError } from '../api/errors'
import { TopNav } from '../navigation/TopNav'
import { parseTools } from '../profile/form'
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
import { Columns } from '../ui/Columns'
import { Disclosure } from '../ui/Disclosure'
import { Notice } from '../ui/Notice'
import { ProjectCard } from '../ui/ProjectCard'
import { Screen } from '../ui/Screen'
import { SheetHeader } from '../ui/SheetHeader'
import { Row, Stack } from '../ui/Stack'
import { Surface } from '../ui/Surface'
import { Switch } from '../ui/Switch'
import { TagInput } from '../ui/TagInput'
import { Text } from '../ui/Text'
import { FieldGroup, TextField } from '../ui/TextField'
import { useLayout } from '../ui/theme/layout'

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
  const { data: session } = useSession()
  const wide = useLayout().sizeClass === 'wide'
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

  // L'adresse de démo est vérifiée pendant la frappe : le membre sait tout de suite si elle ira.
  const demoOk = form.demoUrl.trim() !== '' && publicHttpsUrl(form.demoUrl.trim()) !== null
  const hasRecipe = form.tools.trim() !== '' || form.timeSpent !== null || form.prompts.length > 0
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'))
  const submit = {
    label: projectId ? t('project.edit.submit') : t('project.new.submit'),
    onPress: () => void onSubmit(),
    loading: busy,
  }
  const title = projectId ? t('project.edit.title') : t('project.new.title')

  const fields = (
    <>
      <FieldGroup>
        <TextField
          label={t('project.fields.title')}
          value={form.title}
          onChangeText={change('title')}
          autoCapitalize="sentences"
          maxLength={PROJECT_TITLE_MAX}
          showCount
          error={errorText(errors.title)}
        />
        <TextField
          label={t('project.fields.pitch')}
          value={form.pitch}
          onChangeText={change('pitch')}
          autoCapitalize="sentences"
          limit={PROJECT_PITCH_MAX}
          showCount
          error={errorText(errors.pitch)}
        />
      </FieldGroup>
      <TextField
        label={t('project.fields.demoUrl')}
        value={form.demoUrl}
        onChangeText={change('demoUrl')}
        keyboardType="url"
        hint={t('project.fields.demoUrlHint')}
        success={demoOk ? t('project.fields.demoUrlOk') : undefined}
        error={errorText(errors.demoUrl)}
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
      <Surface variant="grouped" padding="lg">
        <Switch
          label={t('project.fields.public')}
          hint={t('project.fields.publicHint')}
          value={form.visibility === 'public'}
          onValueChange={(isPublic) => change('visibility')(isPublic ? 'public' : 'private')}
        />
      </Surface>
      <TextField
        label={t('project.fields.description')}
        value={form.description}
        onChangeText={change('description')}
        autoCapitalize="sentences"
        multiline
        hint={t('project.fields.descriptionHint')}
        error={errorText(errors.description)}
      />
      {/* La recette est facultative : repliée, sauf si le projet en a déjà une. */}
      <Disclosure
        title={t('project.fields.recipe')}
        hint={t('project.fields.recipeHint')}
        initiallyOpen={hasRecipe}
      >
        <TagInput
          label={t('project.fields.tools')}
          values={parseTools(form.tools)}
          onChange={(list) => change('tools')(list.join(', '))}
          placeholder={t('project.fields.toolsPlaceholder')}
          removeLabel={(item) => t('common.remove', { item })}
          limit={t('project.fields.toolsLimit', { max: PROJECT_TOOLS_MAX })}
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
      </Disclosure>
      {message ? <Notice message={message} /> : null}
    </>
  )

  // Sur téléphone : l'en-tête « Annuler / Titre / Publier », puis le formulaire.
  if (!wide) {
    return (
      <Screen
        header={
          <SheetHeader
            title={title}
            cancel={{ label: t('common.cancel'), onPress: back }}
            action={submit}
          />
        }
      >
        {fields}
      </Screen>
    )
  }

  // Sur ordinateur : le formulaire à gauche, l'aperçu de la carte du fil à droite, qui suit la frappe.
  return (
    <Screen
      width="page"
      header={<TopNav />}
      title={title}
      {...(projectId ? null : { subtitle: t('project.new.subtitle') })}
    >
      <Columns
        main={fields}
        side={
          <Stack gap="md">
            <Row justify="between">
              <Text variant="heading">{t('project.preview.title')}</Text>
              <Text variant="caption" tone="muted">
                {t('project.preview.hint')}
              </Text>
            </Row>
            <ProjectCard
              title={form.title.trim() || t('project.preview.untitled')}
              pitch={form.pitch.trim() || t('project.preview.noPitch')}
              author={{ name: session?.user.name ?? '', avatarUrl: null }}
              when={t('project.preview.now')}
              status={{
                label: t(`project.status.${form.status}`),
                strong: form.status === 'testable',
              }}
              {...(demoOk
                ? { tryIt: { label: t('project.page.tryDemo'), onPress: () => {} } }
                : null)}
            />
          </Stack>
        }
      />
      <Row gap="md" justify="end">
        <Button label={t('common.cancel')} variant="secondary" onPress={back} />
        <Button {...submit} />
      </Row>
    </Screen>
  )
}
