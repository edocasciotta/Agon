import { useSessionStore } from '../../src/store/sessionStore'

describe('sessionStore', () => {
  beforeEach(() => useSessionStore.setState({ needsReauth: false }))

  it('starts with needsReauth false', () => {
    expect(useSessionStore.getState().needsReauth).toBe(false)
  })

  it('sets needsReauth to true', () => {
    useSessionStore.getState().setNeedsReauth(true)
    expect(useSessionStore.getState().needsReauth).toBe(true)
  })

  it('clears needsReauth', () => {
    useSessionStore.getState().setNeedsReauth(true)
    useSessionStore.getState().setNeedsReauth(false)
    expect(useSessionStore.getState().needsReauth).toBe(false)
  })
})
