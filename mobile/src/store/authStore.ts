import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { TOKEN_KEY } from '../api/client'
import type { ClientUser } from '../types'

export type { ClientUser }

interface AuthStore {
  user: ClientUser | null
  setUser: (user: ClientUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    set({ user: null })
  },
}))
