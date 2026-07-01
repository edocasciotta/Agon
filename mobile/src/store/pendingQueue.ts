import { create } from 'zustand'

export type PendingOperation =
  | { type: 'CREATE_BOOKING'; scheduledClassId: number }
  | { type: 'CANCEL_BOOKING'; bookingId: number }

interface PendingQueueStore {
  queue: PendingOperation[]
  enqueue: (op: PendingOperation) => void
  dequeue: () => PendingOperation | undefined
  clear: () => void
}

export const usePendingQueue = create<PendingQueueStore>((set, get) => ({
  queue: [],
  enqueue: (op) => set((state) => ({ queue: [...state.queue, op] })),
  dequeue: () => {
    const [first, ...rest] = get().queue
    set({ queue: rest })
    return first
  },
  clear: () => set({ queue: [] }),
}))
