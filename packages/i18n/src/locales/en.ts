import type { Translation } from '../types'

// Textes anglais. Le type `Translation` (calqué sur le français) oblige à fournir exactement
// les mêmes clés : en oublier une ou en ajouter une de trop empêche la compilation.
export const en: Translation = {
  common: {
    appName: 'Ruche',
    language: 'Language',
    languages: {
      fr: 'Français',
      en: 'English',
    },
    loading: 'Loading…',
  },
  home: {
    title: 'Welcome to {{appName}}',
    tagline:
      'Share your AI projects, try the ones your friends and family build, and keep each other going.',
    comingSoon: 'The feed is coming soon.',
    greeting: 'Hi {{name}}!',
    signUp: 'Create an account',
    signIn: 'Sign in',
    account: 'My account',
  },
  auth: {
    fields: {
      name: 'First name or nickname',
      email: 'Email address',
      password: 'Password',
      passwordHint: 'At least {{min}} characters.',
    },
    signUp: {
      title: 'Create an account',
      submit: 'Create my account',
      switch: 'Already have an account? Sign in',
    },
    signIn: {
      title: 'Sign in',
      submit: 'Sign in',
      switch: 'No account yet? Create one',
    },
    checkEmail: {
      title: 'Check your inbox',
      body: 'We sent a link to {{email}}. Click it to activate your account.',
      back: 'Back to sign in',
    },
    verified: {
      title: 'Email verified',
      body: 'Your account is active. You can now sign in, here or in the app.',
      continue: 'Continue',
    },
    errors: {
      nameRequired: 'Enter a first name or a nickname.',
      invalidEmail: 'This email address is not valid.',
      passwordTooShort: 'Your password must be at least {{min}} characters long.',
      passwordTooLong: 'Your password must be at most {{max}} characters long.',
      invalidCredentials: 'Incorrect email or password.',
      emailNotVerified: 'Your email is not verified yet: we just sent you the link again.',
      tooManyAttempts: 'Too many attempts. Try again in a few minutes.',
      generic: 'Something went wrong. Please try again in a moment.',
    },
  },
  account: {
    title: 'My account',
    signOut: 'Sign out',
    editProfile: 'Edit my profile',
    language: {
      title: 'Language',
      hint: 'Your emails are also sent in this language.',
    },
    export: {
      button: 'Download my data',
      done: 'Your data has been downloaded.',
    },
    delete: {
      title: 'Delete my account',
      warning: 'Your profile and everything you published will be permanently erased.',
      exportFirst: 'Remember to download your data first.',
      password: 'Confirm with your password',
      submit: 'Delete permanently',
      wrongPassword: 'Incorrect password.',
    },
  },
  profile: {
    title: 'My profile',
    avatar: {
      label: 'Profile picture',
      change: 'Change picture',
      updated: 'Picture updated.',
    },
    fields: {
      bio: 'Bio',
      bioCounter: '{{count}} / {{max}}',
      tools: 'Favorite tools',
      toolsHint: 'Separate them with commas ({{max}} at most).',
    },
    save: 'Save',
    saved: 'Profile saved.',
    errors: {
      nameTooLong: 'Your name must be at most {{max}} characters long.',
      bioTooLong: 'Your bio must be at most {{max}} characters long.',
      tooManyTools: '{{max}} tools at most.',
      toolTooLong: 'Each tool must be at most {{max}} characters long.',
      avatarTooLarge: 'The image is larger than {{max}} MB.',
      avatarType: 'Choose a JPEG, PNG or WebP image.',
      invalidCharacters: 'Some characters are not allowed (invisible or control characters).',
    },
  },
  email: {
    footer: '{{appName}}, the network for AI projects among friends and family.',
    greeting: 'Hi {{name}},',
    verify: {
      subject: 'Activate your {{appName}} account',
      body: 'Click the button below to confirm your email address and activate your account.',
      button: 'Activate my account',
      expires: 'This link is valid for one hour.',
      ignore: 'If you did not create an account, simply ignore this message.',
    },
    existingAccount: {
      subject: 'Sign-up attempt on {{appName}}',
      body: 'Someone just tried to create an account with your email address. You already have one: simply sign in.',
      button: 'Sign in',
      ignore: 'If it was not you, there is nothing to do: your account is safe.',
    },
  },
  errors: {
    notFound: 'This page does not exist.',
    validation: 'Some information is invalid.',
    unauthorized: 'Sign in to continue.',
    forbidden: 'This action is not allowed.',
    rateLimited: 'Too many requests. Try again in a few minutes.',
    payloadTooLarge: 'This file is too large.',
    unsupportedMediaType: 'This type of file is not accepted.',
    internal: 'Something went wrong.',
    network: 'Can’t reach Ruche. Check your connection and try again.',
  },
}
