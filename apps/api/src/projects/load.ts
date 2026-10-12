// Lecture des projets dans la base, toujours « du point de vue » d'un membre : c'est ici, et
// seulement ici, que se décide ce qu'il a le droit de voir. Un projet privé n'est visible que de
// son auteur ; pour tous les autres, il n'existe pas.
import {
  type Project,
  ProjectId,
  ProjectStatus,
  ProjectVisibility,
  TimeSpent,
} from '@ruche/contracts'
import { type Database, schema } from '@ruche/db'
import { and, desc, eq, or } from 'drizzle-orm'
import { mediaUrl } from '../profile/me'
import { toolSlug } from './slug'

// Une requête de base : le projet, avec le nom et l'avatar de son auteur.
// innerJoin : « avec son auteur » (il existe toujours) ; leftJoin : « avec son profil s'il en a un ».
const selectProjects = (db: Database) =>
  db
    .select({
      project: schema.project,
      authorName: schema.user.name,
      authorAvatarKey: schema.profile.avatarKey,
    })
    .from(schema.project)
    .innerJoin(schema.user, eq(schema.user.id, schema.project.authorId))
    .leftJoin(schema.profile, eq(schema.profile.userId, schema.project.authorId))

type ProjectRow = Awaited<ReturnType<ReturnType<typeof selectProjects>['execute']>>[number]

/** La condition « visible par ce membre » : public, ou écrit par lui. */
const visibleTo = (viewerId: string) =>
  or(eq(schema.project.visibility, 'public'), eq(schema.project.authorId, viewerId))

/** Transforme une ligne de la base en projet tel que l'API le renvoie (contrat `Project`). */
const toProject = (
  { project, authorName, authorAvatarKey }: ProjectRow,
  viewerId: string,
  publicApiUrl: string,
): Project => ({
  id: project.id,
  author: {
    id: project.authorId,
    name: authorName,
    avatarUrl: authorAvatarKey ? mediaUrl(publicApiUrl, authorAvatarKey) : null,
  },
  title: project.title,
  pitch: project.pitch,
  description: project.description,
  // .parse vérifie que la valeur lue est bien l'une de celles permises (sinon, erreur 500 :
  // mieux vaut le signaler que renvoyer une donnée incohérente).
  status: ProjectStatus.parse(project.status),
  visibility: ProjectVisibility.parse(project.visibility),
  demoUrl: project.demoUrl,
  tools: project.tools.map((label, i) => ({
    label,
    slug: project.toolSlugs[i] ?? toolSlug(label),
  })),
  timeSpent: project.timeSpent === null ? null : TimeSpent.parse(project.timeSpent),
  prompts: project.prompts,
  isMine: project.authorId === viewerId,
  createdAt: project.createdAt.toISOString(),
  updatedAt: project.updatedAt.toISOString(),
})

/**
 * Le projet `id` s'il est visible par `viewerId`, sinon null : qu'il n'existe pas ou qu'il soit
 * privé, la réponse est la même, pour ne rien révéler.
 */
export const loadVisibleProject = async (
  db: Database,
  id: string,
  viewerId: string,
  publicApiUrl: string,
): Promise<Project | null> => {
  // Une adresse mal formée ne peut désigner aucun projet (et ferait échouer la requête SQL).
  if (!ProjectId.safeParse(id).success) return null
  const [row] = await selectProjects(db).where(and(eq(schema.project.id, id), visibleTo(viewerId)))
  return row ? toProject(row, viewerId, publicApiUrl) : null
}

/** Tous les projets d'un auteur que `viewerId` a le droit de voir, du plus récent au plus ancien. */
export const loadProjectsOf = async (
  db: Database,
  authorId: string,
  viewerId: string,
  publicApiUrl: string,
): Promise<Project[]> => {
  const rows = await selectProjects(db)
    .where(and(eq(schema.project.authorId, authorId), visibleTo(viewerId)))
    .orderBy(desc(schema.project.createdAt))
  return rows.map((row) => toProject(row, viewerId, publicApiUrl))
}

/**
 * Les outils et leurs étiquettes, sans doublon d'étiquette (« Claude Code » et « claude-code »
 * sont le même outil : on garde le premier nom tapé).
 */
export const withSlugs = (labels: string[]) => {
  const tools: string[] = []
  const toolSlugs: string[] = []
  for (const label of labels) {
    const slug = toolSlug(label)
    if (toolSlugs.includes(slug)) continue
    tools.push(label)
    toolSlugs.push(slug)
  }
  return { tools, toolSlugs }
}
