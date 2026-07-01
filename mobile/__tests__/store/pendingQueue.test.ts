import { usePendingQueue } from '../../src/store/pendingQueue'

describe('pendingQueue', () => {
  beforeEach(() => {
    usePendingQueue.setState({ queue: [] })
  })

  it('starts empty', () => {
    expect(usePendingQueue.getState().queue).toHaveLength(0)
  })

  it('enqueues a CREATE_BOOKING operation', () => {
    usePendingQueue.getState().enqueue({ type: 'CREATE_BOOKING', scheduledClassId: 42 })
    expect(usePendingQueue.getState().queue).toHaveLength(1)
    expect(usePendingQueue.getState().queue[0]).toEqual({ type: 'CREATE_BOOKING', scheduledClassId: 42 })
  })

  it('enqueues a CANCEL_BOOKING operation', () => {
    usePendingQueue.getState().enqueue({ type: 'CANCEL_BOOKING', bookingId: 7 })
    expect(usePendingQueue.getState().queue[0]).toEqual({ type: 'CANCEL_BOOKING', bookingId: 7 })
  })

  it('dequeues in FIFO order', () => {
    usePendingQueue.getState().enqueue({ type: 'CREATE_BOOKING', scheduledClassId: 1 })
    usePendingQueue.getState().enqueue({ type: 'CANCEL_BOOKING', bookingId: 2 })

    const first = usePendingQueue.getState().dequeue()
    expect(first).toEqual({ type: 'CREATE_BOOKING', scheduledClassId: 1 })
    expect(usePendingQueue.getState().queue).toHaveLength(1)

    const second = usePendingQueue.getState().dequeue()
    expect(second).toEqual({ type: 'CANCEL_BOOKING', bookingId: 2 })
    expect(usePendingQueue.getState().queue).toHaveLength(0)
  })

  it('dequeue on empty queue returns undefined', () => {
    const result = usePendingQueue.getState().dequeue()
    expect(result).toBeUndefined()
  })

  it('clear removes all items', () => {
    usePendingQueue.getState().enqueue({ type: 'CREATE_BOOKING', scheduledClassId: 10 })
    usePendingQueue.getState().enqueue({ type: 'CREATE_BOOKING', scheduledClassId: 11 })
    usePendingQueue.getState().clear()
    expect(usePendingQueue.getState().queue).toHaveLength(0)
  })
})
