// Projets d'exemple pour les tests de l'appli.
import type { Project } from '@ruche/contracts'

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
  isMine: true,
  createdAt: '2026-10-12T08:00:00.000Z',
  updatedAt: '2026-10-12T08:00:00.000Z',
}
