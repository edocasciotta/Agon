import { create } from 'zustand'

interface SessionStore {
  needsReauth: boolean
  setNeedsReauth: (v: boolean) => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  needsReauth: false,
  setNeedsReauth: (v) => set({ needsReauth: v }),
}))
