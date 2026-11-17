import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import adminEn from './admin.en.json'
import adminTa from './admin.ta.json'
import en from './en.json'
import ta from './ta.json'

export type Language = 'en' | 'ta'
const STORAGE_KEY = 'rk.lang'

function readStoredLanguage(): Language {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'ta' ? 'ta' : 'en'
  } catch {
    return 'en'
  }
}

export function setLanguage(lang: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Storage can be blocked; the switch still works for this session.
  }
  document.documentElement.lang = lang
  void i18n.changeLanguage(lang)
}

const initial = readStoredLanguage()
document.documentElement.lang = initial

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { ...en, admin: adminEn } },
    ta: { translation: { ...ta, admin: adminTa } },
  },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
