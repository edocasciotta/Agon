import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { type Locale } from '../i18n/translations'

const LOCALE_KEY = 'agon_locale'

interface LanguageState {
  locale: Locale
  setLocale: (locale: Locale) => Promise<void>
  loadLocale: () => Promise<void>
}

export const useLanguageStore = create<LanguageState>((set) => ({
  locale: 'en',
  setLocale: async (locale) => {
    set({ locale })
    await SecureStore.setItemAsync(LOCALE_KEY, locale)
  },
  loadLocale: async () => {
    const stored = await SecureStore.getItemAsync(LOCALE_KEY)
    if (stored) set({ locale: stored as Locale })
  },
}))
