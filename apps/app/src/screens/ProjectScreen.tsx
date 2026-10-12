// Page d'un projet : titre, auteur, statut, démo, description et « recette » (outils, temps passé,
// prompts clés). L'auteur peut le modifier ou le supprimer.
import type { Project } from '@ruche/contracts'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '../accounts/api'
import { ApiError } from '../api/errors'
import { deleteProject } from '../projects/api'
import { useForgetProject, useProject } from '../projects/hooks'
import { Button } from '../ui/Button'
import { CodeBlock } from '../ui/CodeBlock'
import { Markdown } from '../ui/Markdown'
import { Notice } from '../ui/Notice'
import { Screen } from '../ui/Screen'
import { Stack } from '../ui/Stack'
import { StatusPill } from '../ui/StatusPill'
import { Surface } from '../ui/Surface'
import { Tag } from '../ui/Tag'
import { Text } from '../ui/Text'

export function ProjectScreen({ id }: { id: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { data: session, isPending } = useSession()
  // Pas de session : aucune requête (« public » veut dire « visible par les membres »).
  const project = useProject(id, Boolean(session))

  if (isPending) return <Screen title={t('common.loading')}>{null}</Screen>
  if (!session) {
    return (
      <Screen>
        <Notice tone="info" message={t('errors.unauthorized')} />
        <Button label={t('home.signIn')} onPress={() => router.replace('/sign-in')} />
      </Screen>
    )
  }
  if (project.error) {
    // « Introuvable » : le même message, que le projet n'existe pas ou qu'il soit privé.
    const key = project.error instanceof ApiError ? project.error.key : 'internal'
    return (
      <Screen>
        <Notice message={key === 'notFound' ? t('project.page.notFound') : t(`errors.${key}`)} />
      </Screen>
    )
  }
  if (!project.data) return <Screen title={t('common.loading')}>{null}</Screen>
  return <ProjectView project={project.data} />
}

function ProjectView({ project }: { project: Project }) {
  const { t } = useTranslation()
  const router = useRouter()
  const forgetProject = useForgetProject()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tout lien extérieur passe par la page d'avertissement (voir LeavingScreen).
  const openLink = (url: string) => router.push({ pathname: '/out', params: { url } })

  const onDelete = async () => {
    setBusy(true)
    const result = await deleteProject(project.id)
    setBusy(false)
    if (!result.ok) {
      setError(t(`errors.${result.error}`))
      return
    }
    forgetProject(project.id) // le projet n'existe plus : on l'oublie aussi dans le cache
    router.replace('/')
  }

  const hasRecipe = project.tools.length > 0 || project.timeSpent || project.prompts.length > 0

  return (
    // Arrivé par un lien direct, il n'y a pas de page précédente : le retour mène à l'accueil.
    <Screen
      title={project.title}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    >
      <Stack gap="sm">
        <Text variant="callout" tone="muted">
          {t('project.page.by', { name: project.author.name })}
        </Text>
        <StatusPill
          label={t(`project.status.${project.status}`)}
          strong={project.status === 'testable'} // « Testable » en miel plein : on appelle au test
        />
      </Stack>
      {project.visibility === 'private' ? (
        <Notice tone="info" message={t('project.page.private')} />
      ) : null}

      <Text variant="headline" tone="secondary">
        {project.pitch}
      </Text>

      {project.demoUrl ? (
        <Button
          label={t('project.page.tryDemo')}
          icon="arrow-up-right"
          onPress={() => openLink(project.demoUrl ?? '')}
        />
      ) : (
        <Text tone="muted">{t('project.page.noDemo')}</Text>
      )}

      {project.description ? (
        <Surface padding="xl">
          <Markdown text={project.description} onLinkPress={openLink} />
        </Surface>
      ) : null}

      {hasRecipe ? (
        <Stack gap="md">
          <Text variant="heading" accessibilityRole="header">
            {t('project.page.recipe')}
          </Text>
          {project.tools.length > 0 ? (
            <Stack direction="row" gap="sm" wrap>
              {project.tools.map((tool) => (
                <Tag key={tool.slug} label={tool.label} />
              ))}
            </Stack>
          ) : null}
          {project.timeSpent ? (
            <Stack direction="row" gap="sm" align="baseline">
              <Text tone="muted">{t('project.page.timeSpent')}</Text>
              <Text weight={600}>{t(`project.timeSpent.${project.timeSpent}`)}</Text>
            </Stack>
          ) : null}
          {project.prompts.length > 0 ? (
            <Stack gap="sm">
              <Text tone="muted">{t('project.page.prompts')}</Text>
              {project.prompts.map((prompt, i) => (
                // Les prompts sont affichés tels quels, sans mise en forme : on voit le vrai texte.
                // biome-ignore lint/suspicious/noArrayIndexKey: deux prompts peuvent être identiques
                <CodeBlock key={i}>{prompt}</CodeBlock>
              ))}
            </Stack>
          ) : null}
        </Stack>
      ) : null}

      {project.isMine ? (
        <Stack gap="md">
          {error ? <Notice message={error} /> : null}
          {confirming ? (
            <>
              <Text>{t('project.page.deleteConfirm')}</Text>
              <Button
                label={t('project.page.deleteConfirmButton')}
                variant="confirm"
                onPress={onDelete}
                loading={busy}
              />
              <Button
                label={t('project.page.cancel')}
                variant="secondary"
                onPress={() => setConfirming(false)}
              />
            </>
          ) : (
            <>
              <Button
                label={t('project.page.edit')}
                variant="secondary"
                icon="pencil-simple"
                onPress={() =>
                  router.push({ pathname: '/projects/[id]/edit', params: { id: project.id } })
                }
              />
              <Button
                label={t('project.page.delete')}
                variant="danger"
                icon="trash"
                onPress={() => setConfirming(true)}
              />
            </>
          )}
        </Stack>
      ) : null}
    </Screen>
  )
}
