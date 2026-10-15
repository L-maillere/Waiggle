// Projets d'exemple pour les tests de l'appli.
import type { Project, ProjectVisual } from '@ruche/contracts'

export const recipesProject: Project = {
  id: '6f1c2a8e-3b4d-4c5e-9f60-7a8b9c0d1e2f',
  author: { id: 'u1', name: 'Léa', avatarUrl: null },
  title: 'Mon agent de recettes',
  pitch: 'Un menu avec ce qu’il y a au frigo.',
  description: '## Comment ça marche\n\nOn **photographie** le frigo.',
  status: 'testable',
  visibility: 'public',
  demoUrl: 'https://recettes.example.com',
  tools: [
    { label: 'Claude Code', slug: 'claude-code' },
    { label: 'Cursor', slug: 'cursor' },
  ],
  timeSpent: 'weekend',
  prompts: ['Propose trois recettes avec : {ingrédients}'],
  visuals: [],
  portraitCover: null,
  isMine: true,
  createdAt: '2026-10-12T08:00:00.000Z',
  updatedAt: '2026-10-12T08:00:00.000Z',
}

/**
 * Une photo de projet, telle que l'API la décrit. Son adresse est sur l'API de développement
 * (localhost:3000) : les captures d'écran (scripts/shots.mjs) y répondent par une image d'exemple.
 */
export const photo = (id: string, width = 1600, height = 900): ProjectVisual => ({
  id,
  kind: 'image',
  url: `http://localhost:3000/media/visuals/${id}.webp`,
  width,
  height,
  thumbhash: '3OcRJYB4d3h/iIeHeEh3eIhw+j3A', // gitleaks:allow (un résumé d'image, pas une clé)
})

/** Le même projet, avec trois photos et une couverture verticale. */
export const projectWithPhotos: Project = {
  ...recipesProject,
  visuals: [
    photo('11111111-1111-4111-8111-111111111111'),
    photo('22222222-2222-4222-8222-222222222222'),
    photo('33333333-3333-4333-8333-333333333333'),
  ],
  portraitCover: photo('44444444-4444-4444-8444-444444444444', 900, 1600),
}
