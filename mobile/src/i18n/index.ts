import { useLanguageStore } from '../store/languageStore'
import { translate } from './translations'

export function useT(): (key: string) => string {
  const locale = useLanguageStore((s) => s.locale)
  return (key: string) => translate(locale, key)
}

export { type Locale, LOCALES } from './translations'
