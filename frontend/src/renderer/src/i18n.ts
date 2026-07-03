import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import it from './locales/it.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import es from './locales/es.json'
import pt from './locales/pt.json'
import nl from './locales/nl.json'
const _SUPPORTED_LANGS = ['en', 'it', 'fr', 'de', 'es', 'pt', 'nl']
const _savedLang = (() => {
  try {
    return localStorage.getItem('agon-language')
  } catch {
    return null
  }
})()
const _initialLng = _savedLang && _SUPPORTED_LANGS.includes(_savedLang) ? _savedLang : 'en'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    it: { translation: it },
    fr: { translation: fr },
    de: { translation: de },
    es: { translation: es },
    pt: { translation: pt },
    nl: { translation: nl },
  },
  lng: _initialLng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
