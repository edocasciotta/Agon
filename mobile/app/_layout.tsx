import { useEffect } from 'react'
import { Linking, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'
import { OfflineBanner } from '../src/components/OfflineBanner'
import { useNetworkStatus } from '../src/hooks/useNetworkStatus'
import { usePendingQueue } from '../src/store/pendingQueue'
import { bookingsApi } from '../src/api/bookings'
import { useLanguageStore } from '../src/store/languageStore'
import { useSessionStore } from '../src/store/sessionStore'
import { useAuthStore } from '../src/store/authStore'
import { ThemeProvider } from '../src/theme/ThemeContext'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
})

function SessionGuard() {
  const router = useRouter()
  const needsReauth = useSessionStore((s) => s.needsReauth)

  useEffect(() => {
    if (needsReauth) {
      useSessionStore.getState().setNeedsReauth(false)
      useAuthStore.getState().logout()
      router.replace('/onboarding/login')
    }
  }, [needsReauth, router])

  return null
}

function NetworkWatcher() {
  const isOnline = useNetworkStatus()
  const { queue, dequeue } = usePendingQueue()

  useEffect(() => {
    if (!isOnline || queue.length === 0) return
    // Drain pending queue on reconnect
    const drainQueue = async () => {
      let op = dequeue()
      while (op) {
        try {
          if (op.type === 'CREATE_BOOKING') {
            await bookingsApi.create(op.scheduledClassId)
          } else if (op.type === 'CANCEL_BOOKING') {
            await bookingsApi.cancel(op.bookingId)
          }
        } catch {
          // Silently skip failed re-attempts — user will see stale data and can retry
        }
        op = dequeue()
      }
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    }
    drainQueue()
  }, [isOnline]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

function DeepLinkHandler() {
  const router = useRouter()

  function handleUrl(url: string | null) {
    if (!url) return
    // agon://bookings/123  →  navigate to booking detail
    const bookingMatch = url.match(/agon:\/\/bookings\/(\d+)/)
    if (bookingMatch) {
      router.push(`/bookings/${bookingMatch[1]}` as never)
      return
    }
    // agon://classes/123  →  navigate to class detail
    const classMatch = url.match(/agon:\/\/classes\/(\d+)/)
    if (classMatch) {
      router.push(`/class/${classMatch[1]}` as never)
      return
    }
    // agon://waitlist/123  →  navigate to booking/waitlist confirmation
    const waitlistMatch = url.match(/agon:\/\/waitlist\/(\d+)/)
    if (waitlistMatch) {
      router.push(`/bookings/waitlist/${waitlistMatch[1]}` as never)
      return
    }
    // agon://appointments/123  →  navigate to the Appointments tab (own list — no
    // detail-by-id screen exists yet, and the id is only validated as numeric here)
    const appointmentMatch = url.match(/agon:\/\/appointments\/(\d+)/)
    if (appointmentMatch) {
      router.push('/(tabs)/appointments' as never)
    }
  }

  useEffect(() => {
    // Handle notification tap when app is already open
    const notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>
      if (data?.url && typeof data.url === 'string') {
        handleUrl(data.url)
      }
    })

    // Handle deep link when app is launched from background via link
    Linking.getInitialURL().then(handleUrl)

    const linkSub = Linking.addEventListener('url', (event) => handleUrl(event.url))

    return () => {
      notifSub.remove()
      linkSub.remove()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  })

  useEffect(() => {
    useLanguageStore.getState().loadLocale()
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <StatusBar style="auto" />
          <SessionGuard />
          <NetworkWatcher />
          <DeepLinkHandler />
          <View style={{ flex: 1 }}>
            <OfflineBanner />
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/scan" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/register" options={{ title: 'Create Account' }} />
              <Stack.Screen name="onboarding/login" options={{ title: 'Sign In' }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </View>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
