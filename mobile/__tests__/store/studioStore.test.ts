import * as SecureStore from 'expo-secure-store'
import { useStudioStore } from '../../src/store/studioStore'
import { STUDIO_URL_KEY, STUDIO_NAME_KEY } from '../../src/api/client'

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

const mockSetItem = SecureStore.setItemAsync as jest.Mock
const mockDeleteItem = SecureStore.deleteItemAsync as jest.Mock

describe('studioStore', () => {
  beforeEach(() => {
    useStudioStore.setState({ studioUrl: null, studioName: null })
    jest.clearAllMocks()
  })

  it('starts with no studio', () => {
    expect(useStudioStore.getState().studioUrl).toBeNull()
    expect(useStudioStore.getState().studioName).toBeNull()
  })

  it('sets studio URL and name in state and SecureStore', async () => {
    await useStudioStore.getState().setStudio('http://test.studio', 'Test Studio')
    expect(useStudioStore.getState().studioUrl).toBe('http://test.studio')
    expect(useStudioStore.getState().studioName).toBe('Test Studio')
    expect(mockSetItem).toHaveBeenCalledWith(STUDIO_URL_KEY, 'http://test.studio')
    expect(mockSetItem).toHaveBeenCalledWith(STUDIO_NAME_KEY, 'Test Studio')
  })

  it('clears both URL and name from state and SecureStore', async () => {
    await useStudioStore.getState().setStudio('http://test.studio', 'Test Studio')
    await useStudioStore.getState().clearStudio()
    expect(useStudioStore.getState().studioUrl).toBeNull()
    expect(useStudioStore.getState().studioName).toBeNull()
    expect(mockDeleteItem).toHaveBeenCalledWith(STUDIO_URL_KEY)
    expect(mockDeleteItem).toHaveBeenCalledWith(STUDIO_NAME_KEY)
  })

  it('hydrate sets state without writing to SecureStore', () => {
    useStudioStore.getState().hydrate('http://hydrated.studio', 'Hydrated Studio')
    expect(useStudioStore.getState().studioUrl).toBe('http://hydrated.studio')
    expect(useStudioStore.getState().studioName).toBe('Hydrated Studio')
    expect(mockSetItem).not.toHaveBeenCalled()
  })
})
