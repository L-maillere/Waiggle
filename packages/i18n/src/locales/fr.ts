// Textes français : la langue de référence. Toute nouvelle clé s'ajoute d'abord ici.
// {{appName}} est un paramètre remplacé au moment de l'affichage : t('home.title', { appName: 'Ruche' }).
// `as const` en bas du fichier fige les valeurs pour que TypeScript en déduise la forme exacte.
// Ton : on tutoie, comme entre proches.
export const fr = {
  common: {
    appName: 'Ruche',
    language: 'Langue',
    languages: {
      fr: 'Français',
      en: 'English',
    },
    loading: 'Chargement…',
  },
  home: {
    title: 'Bienvenue sur {{appName}}',
    tagline: 'Publie tes projets IA, teste ceux de tes proches et motivez-vous les uns les autres.',
    comingSoon: 'Le fil arrive bientôt.',
    greeting: 'Bonjour {{name}} !',
    signUp: 'Créer un compte',
    signIn: 'Se connecter',
    account: 'Mon compte',
  },
  auth: {
    fields: {
      name: 'Prénom ou pseudo',
      email: 'Adresse e-mail',
      password: 'Mot de passe',
      passwordHint: 'Au moins {{min}} caractères.',
    },
    signUp: {
      title: 'Créer un compte',
      submit: 'Créer mon compte',
      switch: 'Déjà un compte ? Se connecter',
    },
    signIn: {
      title: 'Se connecter',
      submit: 'Me connecter',
      switch: 'Pas encore de compte ? En créer un',
    },
    checkEmail: {
      title: 'Vérifie ta boîte mail',
      body: 'Nous avons envoyé un lien à {{email}}. Clique dessus pour activer ton compte.',
      back: 'Retour à la connexion',
    },
    verified: {
      title: 'Adresse vérifiée',
      body: 'Ton compte est actif. Tu peux maintenant te connecter, ici ou dans l’appli.',
      continue: 'Continuer',
    },
    errors: {
      nameRequired: 'Indique un prénom ou un pseudo.',
      invalidEmail: 'Cette adresse e-mail n’est pas valide.',
      passwordTooShort: 'Le mot de passe doit faire au moins {{min}} caractères.',
      passwordTooLong: 'Le mot de passe doit faire au plus {{max}} caractères.',
      invalidCredentials: 'Adresse e-mail ou mot de passe incorrect.',
      emailNotVerified:
        'Ton adresse n’est pas encore vérifiée : nous venons de te renvoyer le lien par e-mail.',
      tooManyAttempts: 'Trop de tentatives. Réessaie dans quelques minutes.',
      generic: 'Une erreur est survenue. Réessaie dans un instant.',
    },
  },
  account: {
    title: 'Mon compte',
    signOut: 'Me déconnecter',
    editProfile: 'Modifier mon profil',
    language: {
      title: 'Langue',
      hint: 'Tes e-mails te sont aussi envoyés dans cette langue.',
    },
    export: {
      button: 'Télécharger mes données',
      done: 'Tes données ont été téléchargées.',
    },
    delete: {
      title: 'Supprimer mon compte',
      warning: 'Ton profil et tout ce que tu as publié seront effacés définitivement.',
      exportFirst: 'Pense à télécharger tes données avant.',
      password: 'Confirme avec ton mot de passe',
      submit: 'Supprimer définitivement',
      wrongPassword: 'Mot de passe incorrect.',
    },
  },
  profile: {
    title: 'Mon profil',
    avatar: {
      label: 'Photo de profil',
      change: 'Changer la photo',
      updated: 'Photo mise à jour.',
    },
    fields: {
      bio: 'Bio',
      bioCounter: '{{count}} / {{max}}',
      tools: 'Outils favoris',
      toolsHint: 'Sépare-les par des virgules ({{max}} au plus).',
    },
    save: 'Enregistrer',
    saved: 'Profil enregistré.',
    errors: {
      bioTooLong: 'La bio doit faire au plus {{max}} caractères.',
      tooManyTools: '{{max}} outils au plus.',
      toolTooLong: 'Chaque outil doit faire au plus {{max}} caractères.',
      avatarTooLarge: 'L’image dépasse {{max}} Mo.',
      avatarType: 'Choisis une image JPEG, PNG ou WebP.',
    },
  },
  email: {
    footer: '{{appName}}, le réseau des projets IA entre proches.',
    greeting: 'Bonjour {{name}},',
    verify: {
      subject: 'Active ton compte {{appName}}',
      body: 'Clique sur le bouton ci-dessous pour confirmer ton adresse et activer ton compte.',
      button: 'Activer mon compte',
      expires: 'Ce lien est valable une heure.',
      ignore: 'Si tu n’as pas créé de compte, ignore simplement ce message.',
    },
    existingAccount: {
      subject: 'Tentative d’inscription sur {{appName}}',
      body: 'Quelqu’un vient d’essayer de créer un compte avec ton adresse. Tu as déjà un compte : il te suffit de te connecter.',
      button: 'Me connecter',
      ignore: 'Si ce n’était pas toi, tu n’as rien à faire : ton compte est en sécurité.',
    },
  },
  errors: {
    notFound: "Cette page n'existe pas.",
    validation: 'Certaines informations sont invalides.',
    unauthorized: 'Connecte-toi pour continuer.',
    rateLimited: 'Trop de demandes. Réessaie dans quelques minutes.',
    payloadTooLarge: 'Ce fichier est trop lourd.',
    unsupportedMediaType: 'Ce type de fichier n’est pas accepté.',
    internal: 'Une erreur inattendue est survenue.',
  },
} as const
