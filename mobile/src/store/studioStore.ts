import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { STUDIO_URL_KEY } from '../api/client'

interface StudioStore {
  studioUrl: string | null
  studioName: string | null
  setStudio: (url: string, name: string) => void
  clearStudio: () => void
}

export const useStudioStore = create<StudioStore>((set) => ({
  studioUrl: null,
  studioName: null,
  setStudio: async (url, name) => {
    await SecureStore.setItemAsync(STUDIO_URL_KEY, url)
    set({ studioUrl: url, studioName: name })
  },
  clearStudio: async () => {
    await SecureStore.deleteItemAsync(STUDIO_URL_KEY)
    set({ studioUrl: null, studioName: null })
  },
}))
