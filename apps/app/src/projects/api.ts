// Ce que l'appli peut faire avec les projets : les lire, les publier, les modifier, les supprimer.
// Les écrans n'appellent que ces fonctions ; les tests les remplacent par de faux appels.
import { Project, type ProjectInput, type ProjectUpdate } from '@ruche/contracts'
import { request, requestWithoutBody } from '../api/client'
import { ApiError, type ApiResult } from '../api/errors'

// encodeURIComponent : l'identifiant vient de l'adresse de la page ; on l'insère sans qu'il puisse
// changer le chemin de la requête (un « ../ » glissé dedans resterait un simple texte).
const projectPath = (id: string) => `/v1/projects/${encodeURIComponent(id)}`

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/** Lit un projet (GET /v1/projects/:id). Lève une ApiError en cas d'échec (404 s'il est privé). */
export const getProject = async (id: string): Promise<Project> => {
  const result = await request(projectPath(id), {}, Project)
  if (!result.ok) throw new ApiError(result.error)
  return result.data
}

export const createProject = (input: ProjectInput): Promise<ApiResult<Project>> =>
  request('/v1/projects', json('POST', input), Project)

export const updateProject = (id: string, changes: ProjectUpdate): Promise<ApiResult<Project>> =>
  request(projectPath(id), json('PATCH', changes), Project)

export const deleteProject = (id: string): Promise<ApiResult<null>> =>
  requestWithoutBody(projectPath(id), { method: 'DELETE' })
