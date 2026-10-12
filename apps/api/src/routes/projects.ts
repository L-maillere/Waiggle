// Routes des projets : publier, lire, modifier, supprimer. Toutes exigent d'être connecté
// (« public » veut dire « visible par les membres »). Qui voit quoi : voir projects/load.ts.
import { createRoute, z } from '@hono/zod-openapi'
import { Project, ProjectInput, ProjectUpdate } from '@ruche/contracts'
import { type Database, schema } from '@ruche/db'
import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { requireUser } from '../auth/session'
import { errorBody, languageOf } from '../errors'
import { loadVisibleProject, withSlugs } from '../projects/load'
import { memberCounterKeys, type RateLimiter, type RateRule } from '../rate-limit'
import type { AppEnv } from '../types'
import { createRouter, errorResponse } from './router'

// Règles anti-abus (voir docs/scenarios/phase-1.md, tranche 3).
const HOUR = 60 * 60 * 1000
const createRule: RateRule = { windowMs: 24 * HOUR, max: 20 }
const changeRule: RateRule = { windowMs: HOUR, max: 60 }

const projectResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: Project } },
})
// L'identifiant du projet dans l'adresse : {id} dans /v1/projects/{id}.
const params = z.object({ id: z.string() })

const createProjectRoute = createRoute({
  method: 'post',
  path: '/v1/projects',
  summary: 'Publish a project',
  request: { body: { required: true, content: { 'application/json': { schema: ProjectInput } } } },
  responses: {
    201: projectResponse('The new project.'),
    400: errorResponse('Invalid data.'),
    401: errorResponse('Not signed in.'),
    429: errorResponse('Too many projects today.'),
  },
})

const readProjectRoute = createRoute({
  method: 'get',
  path: '/v1/projects/{id}',
  summary: 'Read a project',
  request: { params },
  responses: {
    200: projectResponse('The project.'),
    401: errorResponse('Not signed in.'),
    404: errorResponse('No such project, or a private project of another member.'),
  },
})

const updateProjectRoute = createRoute({
  method: 'patch',
  path: '/v1/projects/{id}',
  summary: 'Change my project',
  request: {
    params,
    body: { required: true, content: { 'application/json': { schema: ProjectUpdate } } },
  },
  responses: {
    200: projectResponse('The changed project.'),
    400: errorResponse('Invalid data.'),
    401: errorResponse('Not signed in.'),
    403: errorResponse('Someone else’s project.'),
    404: errorResponse('No such project.'),
    429: errorResponse('Too many changes.'),
  },
})

const deleteProjectRoute = createRoute({
  method: 'delete',
  path: '/v1/projects/{id}',
  summary: 'Delete my project',
  request: { params },
  responses: {
    204: { description: 'Deleted.' },
    401: errorResponse('Not signed in.'),
    403: errorResponse('Someone else’s project.'),
    404: errorResponse('No such project.'),
    429: errorResponse('Too many changes.'),
  },
})

type Deps = { db: Database; limiter: RateLimiter; publicApiUrl: string }

export const projectRoutes = ({ db, limiter, publicApiUrl }: Deps) => {
  const app = createRouter()

  // Connecté obligatoire, vérifié avant même de lire le contenu de la requête.
  app.use('/v1/projects', requireUser)
  app.use('/v1/projects/*', requireUser)

  // Réponses d'erreur courantes, dans la langue du visiteur. Une fonction par code : chaque route
  // déclare les codes qu'elle peut renvoyer, et TypeScript vérifie qu'elle s'y tient.
  const unauthorized = (c: Context<AppEnv>) => c.json(errorBody(languageOf(c), 'unauthorized'), 401)
  const forbidden = (c: Context<AppEnv>) => c.json(errorBody(languageOf(c), 'forbidden'), 403)
  const notFound = (c: Context<AppEnv>) => c.json(errorBody(languageOf(c), 'not_found'), 404)
  const tooMany = (c: Context<AppEnv>, retryAfterSeconds: number) => {
    c.header('Retry-After', String(retryAfterSeconds))
    return c.json(errorBody(languageOf(c), 'rate_limited'), 429)
  }

  /**
   * Le projet, s'il appartient au membre. Sinon : « introuvable » s'il ne le voit pas (projet
   * privé d'un autre, ou inexistant), « refusé » s'il le voit mais n'en est pas l'auteur.
   */
  const ownProject = async (id: string, userId: string) => {
    const project = await loadVisibleProject(db, id, userId, publicApiUrl)
    if (!project) return 'not_found' as const
    if (!project.isMine) return 'forbidden' as const
    return project
  }

  app.openapi(createProjectRoute, async (c) => {
    const user = c.get('user')
    if (!user) return unauthorized(c)
    const decision = await limiter.hit(memberCounterKeys(user.id).projectCreate, createRule)
    if (!decision.allowed) return tooMany(c, decision.retryAfterSeconds)

    const input = c.req.valid('json')
    // L'identifiant est tiré par le serveur ; l'auteur est le membre connecté, jamais une donnée
    // envoyée par l'appli. Les valeurs absentes prennent leur valeur par défaut.
    const id = crypto.randomUUID()
    await db.insert(schema.project).values({
      id,
      authorId: user.id,
      title: input.title,
      pitch: input.pitch,
      description: input.description ?? '',
      status: input.status ?? 'idea',
      visibility: input.visibility ?? 'public',
      demoUrl: input.demoUrl ?? null,
      ...withSlugs(input.tools ?? []),
      timeSpent: input.timeSpent ?? null,
      prompts: input.prompts ?? [],
    })

    const project = await loadVisibleProject(db, id, user.id, publicApiUrl)
    if (!project) throw new Error('project not found right after its creation')
    return c.json(project, 201)
  })

  app.openapi(readProjectRoute, async (c) => {
    const user = c.get('user')
    if (!user) return unauthorized(c)
    const project = await loadVisibleProject(db, c.req.valid('param').id, user.id, publicApiUrl)
    if (!project) return notFound(c)
    return c.json(project, 200)
  })

  app.openapi(updateProjectRoute, async (c) => {
    const user = c.get('user')
    if (!user) return unauthorized(c)
    const decision = await limiter.hit(memberCounterKeys(user.id).projectChange, changeRule)
    if (!decision.allowed) return tooMany(c, decision.retryAfterSeconds)

    const { id } = c.req.valid('param')
    const access = await ownProject(id, user.id)
    if (access === 'not_found') return notFound(c)
    if (access === 'forbidden') return forbidden(c)

    // On n'écrit que les champs envoyés (même astuce que pour le profil).
    const changes = c.req.valid('json')
    const set = {
      ...(changes.title !== undefined && { title: changes.title }),
      ...(changes.pitch !== undefined && { pitch: changes.pitch }),
      ...(changes.description !== undefined && { description: changes.description }),
      ...(changes.status !== undefined && { status: changes.status }),
      ...(changes.visibility !== undefined && { visibility: changes.visibility }),
      ...(changes.demoUrl !== undefined && { demoUrl: changes.demoUrl }),
      ...(changes.tools !== undefined && withSlugs(changes.tools)),
      ...(changes.timeSpent !== undefined && { timeSpent: changes.timeSpent }),
      ...(changes.prompts !== undefined && { prompts: changes.prompts }),
    }
    if (Object.keys(set).length > 0) {
      await db.update(schema.project).set(set).where(eq(schema.project.id, id))
    }

    const project = await loadVisibleProject(db, id, user.id, publicApiUrl)
    if (!project) return notFound(c)
    return c.json(project, 200)
  })

  app.openapi(deleteProjectRoute, async (c) => {
    const user = c.get('user')
    if (!user) return unauthorized(c)
    const decision = await limiter.hit(memberCounterKeys(user.id).projectChange, changeRule)
    if (!decision.allowed) return tooMany(c, decision.retryAfterSeconds)

    const { id } = c.req.valid('param')
    const access = await ownProject(id, user.id)
    if (access === 'not_found') return notFound(c)
    if (access === 'forbidden') return forbidden(c)

    await db.delete(schema.project).where(eq(schema.project.id, id))
    // 204 : « c'est fait », sans contenu à renvoyer.
    return c.body(null, 204)
  })

  return app
}
