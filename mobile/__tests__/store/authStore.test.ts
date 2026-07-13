import { useAuthStore } from '../../src/store/authStore'

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

describe('authStore', () => {
  beforeEach(() => useAuthStore.setState({ user: null }))

  it('starts with no user', () => {
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('sets user', () => {
    useAuthStore
      .getState()
      .setUser({ id: 1, email: 'a@b.com', full_name: 'Test', role: 'client', photo_url: null })
    expect(useAuthStore.getState().user?.email).toBe('a@b.com')
  })
})
