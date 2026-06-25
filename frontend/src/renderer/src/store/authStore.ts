import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => {
        localStorage.setItem('agon_access_token', accessToken)
        set({ accessToken, user })
      },
      logout: () => {
        localStorage.removeItem('agon_access_token')
        localStorage.removeItem('agon_refresh_token')
        set({ accessToken: null, user: null })
      },
    }),
    { name: 'agon-auth' }
  )
)
