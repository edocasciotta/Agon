import Constants, { ExecutionEnvironment } from 'expo-constants'

/**
 * True when the app is currently running inside the Expo Go client, as opposed to a real
 * development build or a production/standalone build.
 *
 * Why this matters: as of Expo Go SDK 53+, remote push notification support was removed from
 * Expo Go entirely (it still works in dev-client/production builds). The installed
 * `expo-notifications` package (0.32.17) fires a disruptive, module-scope `console.error` on
 * Android the instant it is imported inside Expo Go: `index.js` re-exports
 * `setAutoServerRegistrationEnabledAsync` from `./DevicePushTokenAutoRegistration.fx`, which
 * forces that file to evaluate whenever `expo-notifications` is imported at all. Its top-level
 * code calls `addPushTokenListener()` synchronously, which immediately calls
 * `warnOfExpoGoPushUsage()` — the source of the exact error seen in the field. This fires before
 * any of our own code runs, so guarding individual calls like
 * `requestPermissionsAsync()`/`getExpoPushTokenAsync()` is not enough; the package must not be
 * imported at all while running in Expo Go. See `src/notifications.ts`, `app/_layout.tsx`, and
 * `app/(tabs)/profile.tsx`, which all defer their `expo-notifications` import behind this check.
 *
 * `Constants.appOwnership === 'expo'` is deprecated in the installed `expo-constants` version
 * (18.x, Expo SDK 54) in favor of `Constants.executionEnvironment`. This is also what Expo's own
 * internal `isRunningInExpoGo()` helper (used by `expo-notifications` itself, via the `expo`
 * package) is equivalent to.
 */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient
}
