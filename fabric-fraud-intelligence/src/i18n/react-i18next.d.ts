// Compile-time type safety for translation keys: a missing key is a TypeScript error.
import 'react-i18next';

import type en from './locales/en.json';
import type enFraudIq from './locales/en.fraudiq.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof en;
      fraudIq: typeof enFraudIq;
    };
  }
}
