import { registerForPushNotifications } from '../src/notifications'

const mockGetPermissionsAsync = jest.fn()
const mockRequestPermissionsAsync = jest.fn()
const mockGetExpoPushTokenAsync = jest.fn()
const mockSetNotificationHandler = jest.fn()

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  setNotificationHandler: (...args: unknown[]) => mockSetNotificationHandler(...args),
}))

// `mock`-prefixed so babel-plugin-jest-hoist allows referencing it from inside the
// (hoisted) jest.mock factory below.
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

describe('registerForPushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExecutionEnvironment = undefined
  })

  it('returns null and never touches the permission/token APIs when running in Expo Go', async () => {
    mockExecutionEnvironment = 'storeClient'

    const result = await registerForPushNotifications()

    expect(result).toBeNull()
    expect(mockGetPermissionsAsync).not.toHaveBeenCalled()
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled()
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled()
  })

  it('registers normally when not running in Expo Go (real build) and permission is already granted', async () => {
    mockExecutionEnvironment = 'bare'
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' })
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' })

    const result = await registerForPushNotifications()

    expect(result).toBe('ExponentPushToken[abc]')
    expect(mockGetPermissionsAsync).toHaveBeenCalledTimes(1)
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled()
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledTimes(1)
  })

  it('requests permission when not already granted, and returns null if the user denies', async () => {
    mockExecutionEnvironment = 'bare'
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' })
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' })

    const result = await registerForPushNotifications()

    expect(result).toBeNull()
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1)
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled()
  })

  it('returns null instead of throwing when the underlying APIs reject', async () => {
    mockExecutionEnvironment = 'standalone'
    mockGetPermissionsAsync.mockRejectedValue(new Error('native module unavailable'))

    const result = await registerForPushNotifications()

    expect(result).toBeNull()
  })
})
