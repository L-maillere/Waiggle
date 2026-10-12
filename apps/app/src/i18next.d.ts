import type { Translation } from '@ruche/i18n'

// Makes t('...') keys type-checked against the French reference.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: Translation }
  }
}
