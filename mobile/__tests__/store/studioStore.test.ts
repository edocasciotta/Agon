import { useStudioStore } from '../../src/store/studioStore'

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

describe('studioStore', () => {
  beforeEach(() => useStudioStore.setState({ studioUrl: null, studioName: null }))

  it('starts with no studio', () => {
    expect(useStudioStore.getState().studioUrl).toBeNull()
  })

  it('sets studio', async () => {
    await useStudioStore.getState().setStudio('http://test.studio', 'Test Studio')
    expect(useStudioStore.getState().studioUrl).toBe('http://test.studio')
    expect(useStudioStore.getState().studioName).toBe('Test Studio')
  })
})
