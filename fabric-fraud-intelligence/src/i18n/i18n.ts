import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import zh from './locales/zh.json';
import enFraudIq from './locales/en.fraudiq.json';
import frFraudIq from './locales/fr.fraudiq.json';
import esFraudIq from './locales/es.fraudiq.json';
import zhFraudIq from './locales/zh.fraudiq.json';

export const SUPPORTED_LOCALES = ['en', 'fr', 'es', 'zh'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en, fraudIq: enFraudIq },
      fr: { translation: fr, fraudIq: frFraudIq },
      es: { translation: es, fraudIq: esFraudIq },
      zh: { translation: zh, fraudIq: zhFraudIq },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LOCALES,
    ns: ['translation', 'fraudIq'],
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ffi.lang',
      caches: ['localStorage'],
    },
  });

// BCP-47 tag for Intl formatting; keep in sync with the active i18next language.
export const localeTag = (): string =>
  i18n.language?.startsWith('fr')
    ? 'fr-FR'
    : i18n.language?.startsWith('es')
      ? 'es-ES'
      : i18n.language?.startsWith('zh')
        ? 'zh-HK'
        : 'en-US';

export default i18n;
