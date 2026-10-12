// Couleurs provisoires, en attendant l'identité visuelle définitive.
// Deux jeux : clair et sombre. L'écran choisit selon le réglage du téléphone.
export const palette = {
  light: {
    background: '#FFFBF2',
    surface: '#FFFFFF',
    text: '#1F1A12',
    muted: '#6B5E4A', // texte secondaire
    accent: '#B87A00', // couleur « miel » pour ce qui est actif ou sélectionné
    accentSoft: '#FCEFD2',
    border: '#EADFC8',
  },
  dark: {
    background: '#16130E',
    surface: '#221D15',
    text: '#F6EFE2',
    muted: '#BFB29B',
    accent: '#F2B437',
    accentSoft: '#3A2E17',
    border: '#3A3226',
  },
} as const

// Le type d'un jeu de couleurs, déduit de l'objet ci-dessus (clair ou sombre).
export type Colors = (typeof palette)[keyof typeof palette]
