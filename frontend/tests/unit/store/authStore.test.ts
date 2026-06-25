import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../../../src/renderer/src/store/authStore'

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
  })

  it('starts with no token', () => {
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it('sets token via setAuth', () => {
    useAuthStore.getState().setAuth('abc123', { id: 1, email: 'a@b.com', full_name: 'Test', role: 'manager' })
    expect(useAuthStore.getState().accessToken).toBe('abc123')
  })

  it('clears token on logout', () => {
    useAuthStore.getState().setAuth('abc123', { id: 1, email: 'a@b.com', full_name: 'Test', role: 'manager' })
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().accessToken).toBeNull()
  })
})
