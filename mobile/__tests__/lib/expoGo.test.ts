import { isExpoGo } from '../../src/lib/expoGo'

let mockExecutionEnvironment: string | undefined

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get executionEnvironment() {
      return mockExecutionEnvironment
    },
  },
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
}))

describe('isExpoGo', () => {
  it('returns true when executionEnvironment is storeClient (running inside Expo Go)', () => {
    mockExecutionEnvironment = 'storeClient'
    expect(isExpoGo()).toBe(true)
  })

  it('returns false in a bare/dev-client build', () => {
    mockExecutionEnvironment = 'bare'
    expect(isExpoGo()).toBe(false)
  })

  it('returns false in a standalone/production build', () => {
    mockExecutionEnvironment = 'standalone'
    expect(isExpoGo()).toBe(false)
  })

  it('returns false when executionEnvironment is undefined (e.g. web)', () => {
    mockExecutionEnvironment = undefined
    expect(isExpoGo()).toBe(false)
  })
})
