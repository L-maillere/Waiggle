// Provisional palette until the visual identity is defined.
export const palette = {
  light: {
    background: '#FFFBF2',
    surface: '#FFFFFF',
    text: '#1F1A12',
    muted: '#6B5E4A',
    accent: '#B87A00',
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

export type Colors = (typeof palette)[keyof typeof palette]
