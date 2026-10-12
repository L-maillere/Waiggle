// Les projets publiés par les membres. Les règles (longueurs, valeurs permises) sont vérifiées par
// l'API avec les schémas de @ruche/contracts avant d'arriver ici ; la base garde les données.
import { sql } from 'drizzle-orm'
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const project = pgTable(
  'project',
  {
    // uuid : un identifiant tiré au hasard par le serveur (impossible à deviner, contrairement à
    // 1, 2, 3…). Il apparaît dans l'adresse du projet.
    id: uuid('id').primaryKey(),
    // L'auteur ; onDelete: 'cascade' → ses projets disparaissent avec son compte.
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    pitch: text('pitch').notNull(),
    description: text('description').default('').notNull(), // Markdown, tel que tapé
    // Codes en anglais (idea, building…) : la liste permise est dans @ruche/contracts.
    status: text('status').default('idea').notNull(),
    visibility: text('visibility').default('public').notNull(),
    demoUrl: text('demo_url'), // null : pas de démo
    // La recette : les outils tels que tapés (« Claude Code »), et leur version « étiquette »
    // (« claude-code »), qui sert à retrouver tous les projets faits avec un outil.
    tools: text('tools').array().default(sql`'{}'::text[]`).notNull(),
    toolSlugs: text('tool_slugs').array().default(sql`'{}'::text[]`).notNull(),
    timeSpent: text('time_spent'), // null : non renseigné
    prompts: text('prompts').array().default(sql`'{}'::text[]`).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  // Les index sont des sommaires qui accélèrent les recherches fréquentes :
  // - les projets d'un membre, du plus récent au plus ancien ;
  // - les projets qui portent une étiquette (« GIN » : un sommaire du contenu des listes).
  (t) => [
    index('project_author_created_idx').on(t.authorId, t.createdAt),
    index('project_tool_slugs_idx').using('gin', t.toolSlugs),
  ],
)
