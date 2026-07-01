import { create } from 'zustand'

interface ConnectivityStore {
  isOnline: boolean
  lastOnlineAt: Date | null
  setOnline: (online: boolean) => void
}

export const useConnectivityStore = create<ConnectivityStore>((set) => ({
  isOnline: true,
  lastOnlineAt: new Date(),
  setOnline: (online) =>
    set((state) => ({
      isOnline: online,
      lastOnlineAt: online ? new Date() : state.lastOnlineAt,
    })),
}))
