import { create } from 'zustand'

interface StudioStore {
  studioUrl: string | null
  studioName: string | null
  setStudio: (url: string, name: string) => void
  clearStudio: () => void
}

export const useStudioStore = create<StudioStore>((set) => ({
  studioUrl: null,
  studioName: null,
  setStudio: (url, name) => set({ studioUrl: url, studioName: name }),
  clearStudio: () => set({ studioUrl: null, studioName: null })
}))
