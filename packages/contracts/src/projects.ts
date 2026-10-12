// Formes des données d'un projet : ce qu'un membre peut publier ou modifier, et ce que l'API renvoie.
// Les règles de texte (longueurs, caractères interdits) viennent de text.ts, comme pour le profil.
import { z } from 'zod'
import { TOOL_MAX_LENGTH } from './profile'
import { FreeText, ShortLabel, uniqueIgnoringCase } from './text'

export const PROJECT_TITLE_MAX = 80
export const PROJECT_PITCH_MAX = 140
export const PROJECT_DESCRIPTION_MAX = 10_000
export const PROJECT_TOOLS_MAX = 15
export const PROJECT_PROMPTS_MAX = 5
export const PROJECT_PROMPT_MAX_LENGTH = 4_000
export const DEMO_URL_MAX_LENGTH = 2_000

// z.enum : une liste fermée de valeurs. Les textes affichés (« En construction »…) sont dans les
// traductions ; ici, seulement des codes stables, en anglais.
export const ProjectStatus = z.enum(['idea', 'building', 'testable', 'done', 'paused'])
export type ProjectStatus = z.infer<typeof ProjectStatus>

export const ProjectVisibility = z.enum(['public', 'private'])
export type ProjectVisibility = z.infer<typeof ProjectVisibility>

/** Temps passé, par tranches : moins d'une heure, une soirée, un week-end, des semaines, des mois. */
export const TimeSpent = z.enum(['hour', 'evening', 'weekend', 'weeks', 'months'])
export type TimeSpent = z.infer<typeof TimeSpent>

// Suffixes de noms réservés aux réseaux locaux (box, imprimante, NAS…) : un lien vers eux ne
// marcherait que chez l'auteur, et pourrait viser la machine de celui qui clique.
const LOCAL_SUFFIXES = ['localhost', 'local', 'internal', 'home.arpa', 'lan', 'home']

/**
 * Vrai si l'adresse est un lien https vers un site public, désigné par son nom de domaine.
 * On laisse le navigateur (la classe URL) découper l'adresse : il connaît toutes les façons tordues
 * d'écrire une adresse IP (« 0x7f.1 », « 2130706433 »…) et les ramène à la forme habituelle.
 */
const isPublicHttpsUrl = (value: string) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false // ce n'est pas une adresse
  }
  if (url.protocol !== 'https:') return false
  // « https://ruche.app@pirate.example » mène à pirate.example : ce qui précède @ est un identifiant.
  if (url.username || url.password) return false

  const host = url.hostname.toLowerCase().replace(/\.$/, '') // « localhost. » = « localhost »
  // Une adresse IP plutôt qu'un nom : IPv6 entre crochets, ou IPv4 sous forme de 4 nombres.
  if (host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return false
  // Un nom sans point (« intranet ») ne désigne qu'une machine du réseau local.
  if (!host.includes('.')) return false
  return !LOCAL_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}

/** Le lien de démo : https, vers un site public. */
export const DemoUrl = z
  .string()
  .trim()
  .max(DEMO_URL_MAX_LENGTH)
  .refine(isPublicHttpsUrl, { message: 'must be a public https address' })

// Les champs modifiables d'un projet, avec leurs règles.
const fields = {
  title: ShortLabel(PROJECT_TITLE_MAX),
  pitch: ShortLabel(PROJECT_PITCH_MAX), // une seule ligne, comme une étiquette
  description: FreeText(PROJECT_DESCRIPTION_MAX), // Markdown, affiché assaini par l'appli
  status: ProjectStatus,
  visibility: ProjectVisibility,
  demoUrl: DemoUrl.nullable(), // null : pas (ou plus) de démo
  tools: z.array(ShortLabel(TOOL_MAX_LENGTH)).max(PROJECT_TOOLS_MAX).transform(uniqueIgnoringCase),
  timeSpent: TimeSpent.nullable(),
  prompts: z
    .array(FreeText(PROJECT_PROMPT_MAX_LENGTH))
    .max(PROJECT_PROMPTS_MAX)
    .transform((prompts) => prompts.filter((prompt) => prompt.length > 0)), // ignore les cases vides
}

/**
 * Ce que POST /v1/projects accepte : un titre et un pitch, le reste est facultatif (le serveur
 * applique les valeurs par défaut : idée, public, sans démo…). strictObject refuse tout champ
 * inconnu, par exemple un « authorId » qui ferait publier au nom de quelqu'un d'autre.
 */
export const ProjectInput = z
  .strictObject({
    ...fields, // « ... » recopie tous les champs ci-dessus…
    // … puis on rend facultatifs ceux qui ont une valeur par défaut.
    description: fields.description.optional(),
    status: fields.status.optional(),
    visibility: fields.visibility.optional(),
    demoUrl: fields.demoUrl.optional(),
    tools: fields.tools.optional(),
    timeSpent: fields.timeSpent.optional(),
    prompts: fields.prompts.optional(),
  })
  .meta({ id: 'ProjectInput' })
export type ProjectInput = z.infer<typeof ProjectInput>

/** Ce que PATCH /v1/projects/:id accepte : n'importe quelle partie des champs. */
export const ProjectUpdate = z.strictObject(fields).partial().meta({ id: 'ProjectUpdate' })
export type ProjectUpdate = z.infer<typeof ProjectUpdate>

// --- Ce que l'API renvoie ---

export const ProjectAuthor = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.url().nullable(),
})

/** Un outil affiché comme étiquette : son nom, et l'identifiant de sa page (« claude-code »). */
export const ProjectTool = z.object({ label: z.string(), slug: z.string() })

export const Project = z
  .object({
    id: z.uuid(),
    author: ProjectAuthor,
    title: z.string(),
    pitch: z.string(),
    description: z.string(),
    status: ProjectStatus,
    visibility: ProjectVisibility,
    demoUrl: z.string().nullable(),
    tools: z.array(ProjectTool),
    timeSpent: TimeSpent.nullable(),
    prompts: z.array(z.string()),
    /** Vrai si le membre qui regarde est l'auteur : l'appli affiche alors « Modifier ». */
    isMine: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Project' })
export type Project = z.infer<typeof Project>

/** Un projet en version courte, pour les listes. */
export const ProjectSummary = Project.pick({
  id: true,
  author: true,
  title: true,
  pitch: true,
  status: true,
  visibility: true,
  tools: true,
  updatedAt: true,
}).meta({ id: 'ProjectSummary' })
export type ProjectSummary = z.infer<typeof ProjectSummary>
