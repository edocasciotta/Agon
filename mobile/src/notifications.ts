import { isExpoGo } from './lib/expoGo'
import { loadExpoNotifications } from './lib/expoNotifications'

let handlerConfigured = false

export async function registerForPushNotifications(): Promise<string | null> {
  // Expo Go (SDK 53+) removed remote push notification support entirely — real registration is
  // unsupported there, so skip it rather than attempt (and fail) permission/token requests.
  // `loadExpoNotifications()` never even imports `expo-notifications` in this case (see
  // `src/lib/expoNotifications.ts`), which is what actually prevents the crash.
  if (isExpoGo()) return null

  try {
    const Notifications = loadExpoNotifications()
    if (!Notifications) return null

    if (!handlerConfigured) {
      handlerConfigured = true
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      })
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') return null

    const token = await Notifications.getExpoPushTokenAsync()
    return token.data
  } catch {
    return null
  }
}
