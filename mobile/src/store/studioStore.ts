import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { STUDIO_URL_KEY, STUDIO_NAME_KEY } from '../api/client'

interface StudioStore {
  studioUrl: string | null
  studioName: string | null
  setStudio: (url: string, name: string) => void
  clearStudio: () => void
  hydrate: (url: string, name: string) => void
}

export const useStudioStore = create<StudioStore>((set) => ({
  studioUrl: null,
  studioName: null,
  setStudio: async (url, name) => {
    await SecureStore.setItemAsync(STUDIO_URL_KEY, url)
    await SecureStore.setItemAsync(STUDIO_NAME_KEY, name)
    set({ studioUrl: url, studioName: name })
  },
  clearStudio: async () => {
    await SecureStore.deleteItemAsync(STUDIO_URL_KEY)
    await SecureStore.deleteItemAsync(STUDIO_NAME_KEY)
    set({ studioUrl: null, studioName: null })
  },
  // Sets in-memory state only — used on startup to restore persisted values without re-writing
  hydrate: (url, name) => set({ studioUrl: url, studioName: name }),
}))
