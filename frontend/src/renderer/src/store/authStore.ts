import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface User {
  id: number
  email: string
  full_name: string
  role: 'manager' | 'instructor' | 'client'
}

interface AuthStore {
  accessToken: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  logout: () => void
}

// Use sessionStorage so data lives only in-memory for the renderer process
// lifetime and is never written to disk (TECHNICAL_SPEC §5.1).
// accessToken is additionally excluded via partialize — it never leaves memory.
const sessionStorageAdapter = createJSONStorage(() => sessionStorage)

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => set({ accessToken, user }),
      logout: () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'agon-auth',
      storage: sessionStorageAdapter,
      partialize: (state) => ({ user: state.user }),
    }
  )
)
