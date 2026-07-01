import { useConnectivityStore } from '../../src/store/connectivityStore'

describe('connectivityStore', () => {
  beforeEach(() => {
    useConnectivityStore.setState({ isOnline: true, lastOnlineAt: new Date() })
  })

  it('starts as online', () => {
    expect(useConnectivityStore.getState().isOnline).toBe(true)
  })

  it('setOnline(false) marks the store as offline', () => {
    useConnectivityStore.getState().setOnline(false)
    expect(useConnectivityStore.getState().isOnline).toBe(false)
  })

  it('setOnline(true) marks the store as online', () => {
    useConnectivityStore.setState({ isOnline: false, lastOnlineAt: null })
    useConnectivityStore.getState().setOnline(true)
    expect(useConnectivityStore.getState().isOnline).toBe(true)
  })

  it('lastOnlineAt is updated when going online', () => {
    const before = new Date(Date.now() - 5000)
    useConnectivityStore.setState({ isOnline: false, lastOnlineAt: before })

    useConnectivityStore.getState().setOnline(true)

    const after = useConnectivityStore.getState().lastOnlineAt
    expect(after).not.toBeNull()
    expect(after!.getTime()).toBeGreaterThan(before.getTime())
  })

  it('lastOnlineAt is preserved when going offline', () => {
    const lastSeen = new Date(Date.now() - 10_000)
    useConnectivityStore.setState({ isOnline: true, lastOnlineAt: lastSeen })

    useConnectivityStore.getState().setOnline(false)

    expect(useConnectivityStore.getState().lastOnlineAt).toEqual(lastSeen)
  })

  it('offline → online → offline cycle preserves last known online time', () => {
    useConnectivityStore.getState().setOnline(false)
    useConnectivityStore.getState().setOnline(true)
    const onlineTime = useConnectivityStore.getState().lastOnlineAt!
    useConnectivityStore.getState().setOnline(false)

    expect(useConnectivityStore.getState().isOnline).toBe(false)
    expect(useConnectivityStore.getState().lastOnlineAt).toEqual(onlineTime)
  })
})
