// Textes français : la langue de référence. Toute nouvelle clé s'ajoute d'abord ici.
// {{appName}} est un paramètre remplacé au moment de l'affichage : t('home.title', { appName: 'Ruche' }).
// `as const` en bas du fichier fige les valeurs pour que TypeScript en déduise la forme exacte.
export const fr = {
  common: {
    appName: 'Ruche',
    language: 'Langue',
    languages: {
      fr: 'Français',
      en: 'English',
    },
  },
  home: {
    title: 'Bienvenue sur {{appName}}',
    tagline:
      'Publiez vos projets IA, testez ceux de vos proches et motivez-vous mutuellement à créer.',
    comingSoon: 'Le fil arrive bientôt.',
  },
  errors: {
    notFound: "Cette page n'existe pas.",
    validation: 'Certaines informations sont invalides.',
    internal: 'Une erreur inattendue est survenue.',
  },
} as const
