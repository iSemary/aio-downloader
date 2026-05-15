import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import ar from './locales/ar.json'
import de from './locales/de.json'
import en from './locales/en.json'

export const LOCALE_COOKIE = 'aio_lang'

const resources = { en: { translation: en }, ar: { translation: ar }, de: { translation: de } }

export function applyDocumentLanguage(lng) {
  const code = (lng || 'en').split('-')[0]
  document.documentElement.lang = code
  document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr'
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar', 'de'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['cookie', 'localStorage', 'navigator'],
      caches: ['cookie', 'localStorage'],
      lookupCookie: LOCALE_COOKIE,
      lookupLocalStorage: LOCALE_COOKIE,
      cookieMinutes: 60 * 24 * 365,
      cookieOptions: { path: '/', sameSite: 'lax' },
    },
  })
  .then(() => {
    applyDocumentLanguage(i18n.language)
  })

i18n.on('languageChanged', applyDocumentLanguage)

export default i18n
