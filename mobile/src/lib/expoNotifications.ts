import { isExpoGo } from './expoGo'

type NotificationsModule = typeof import('expo-notifications')

/**
 * Synchronously loads `expo-notifications`, or returns `null` when running inside Expo Go.
 *
 * This must stay a conditional `require()` rather than a static `import * as Notifications from
 * 'expo-notifications'` at the top of a file. Static imports are hoisted and always execute
 * before any of the importing module's own code runs — which is exactly how this crash happened:
 * `app/(tabs)/profile.tsx`'s static import alone (no function call needed) was enough to trigger
 * `expo-notifications`'s Expo-Go-incompatible module-scope side effect (see `expoGo.ts` for the
 * full explanation). A plain `require()` call, by contrast, only evaluates the module the moment
 * this line actually runs, so gating it behind `isExpoGo()` genuinely prevents the package from
 * ever being evaluated while running inside Expo Go.
 *
 * (A dynamic `import()` would express the same intent, but this project's Jest config has no
 * `--experimental-vm-modules`/dynamic-import Babel transform, so `import()` throws under test —
 * `require()` works identically under Metro and Jest and keeps `jest.mock('expo-notifications',
 * ...)` working unchanged in existing tests.)
 */
export function loadExpoNotifications(): NotificationsModule | null {
  if (isExpoGo()) return null
  return require('expo-notifications') as NotificationsModule
}
