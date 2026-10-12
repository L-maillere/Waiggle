// Page d'un projet : titre, auteur, statut, démo, description et « recette » (outils, temps passé,
// prompts clés). L'auteur peut le modifier ou le supprimer.
import type { Project } from '@ruche/contracts'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useSession } from '../accounts/api'
import { ApiError } from '../api/errors'
import { deleteProject } from '../projects/api'
import { useForgetProject, useProject } from '../projects/hooks'
import { type Colors, useColors } from '../theme'
import { Button } from '../ui/Button'
import { Markdown } from '../ui/Markdown'
import { Notice } from '../ui/Notice'
import { Screen } from '../ui/Screen'

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
  const styles = makeStyles(useColors())
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
    <Screen title={project.title}>
      <Text style={styles.muted}>{t('project.page.by', { name: project.author.name })}</Text>
      <View style={styles.badges}>
        <Text style={styles.badge}>{t(`project.status.${project.status}`)}</Text>
      </View>
      {project.visibility === 'private' ? (
        <Notice tone="info" message={t('project.page.private')} />
      ) : null}

      <Text style={styles.pitch}>{project.pitch}</Text>

      {project.demoUrl ? (
        <Button label={t('project.page.tryDemo')} onPress={() => openLink(project.demoUrl ?? '')} />
      ) : (
        <Text style={styles.muted}>{t('project.page.noDemo')}</Text>
      )}

      {project.description ? <Markdown text={project.description} onLinkPress={openLink} /> : null}

      {hasRecipe ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {t('project.page.recipe')}
          </Text>
          {project.tools.length > 0 ? (
            <View style={styles.badges}>
              {project.tools.map((tool) => (
                <Text key={tool.slug} style={styles.tag}>
                  {tool.label}
                </Text>
              ))}
            </View>
          ) : null}
          {project.timeSpent ? (
            <View style={styles.line}>
              <Text style={styles.muted}>{t('project.page.timeSpent')}</Text>
              <Text style={styles.text}>{t(`project.timeSpent.${project.timeSpent}`)}</Text>
            </View>
          ) : null}
          {project.prompts.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.muted}>{t('project.page.prompts')}</Text>
              {project.prompts.map((prompt, i) => (
                // Les prompts sont affichés tels quels, sans mise en forme : on voit le vrai texte.
                // biome-ignore lint/suspicious/noArrayIndexKey: deux prompts peuvent être identiques
                <Text key={i} selectable style={styles.prompt}>
                  {prompt}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {project.isMine ? (
        <View style={styles.section}>
          {error ? <Notice message={error} /> : null}
          {confirming ? (
            <>
              <Text style={styles.text}>{t('project.page.deleteConfirm')}</Text>
              <Button
                label={t('project.page.deleteConfirmButton')}
                variant="danger"
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
                onPress={() =>
                  router.push({ pathname: '/projects/[id]/edit', params: { id: project.id } })
                }
              />
              <Button
                label={t('project.page.delete')}
                variant="danger"
                onPress={() => setConfirming(true)}
              />
            </>
          )}
        </View>
      ) : null}
    </Screen>
  )
}

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    text: { fontSize: 16, color: c.text },
    muted: { fontSize: 15, color: c.muted },
    pitch: { fontSize: 18, lineHeight: 26, color: c.text },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    badge: {
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
      backgroundColor: c.accentSoft,
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 12,
      overflow: 'hidden',
    },
    tag: {
      fontSize: 14,
      color: c.text,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 12,
    },
    section: { gap: 10 },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    line: { flexDirection: 'row', gap: 8, alignItems: 'baseline' },
    prompt: {
      fontFamily: mono,
      fontSize: 14,
      lineHeight: 20,
      color: c.text,
      backgroundColor: c.accentSoft,
      borderRadius: 8,
      padding: 12,
    },
  })
