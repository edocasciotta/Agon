import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { TOKEN_KEY, STUDIO_URL_KEY, STUDIO_NAME_KEY } from '../src/api/client'
import { authApi } from '../src/api/auth'
import { useAuthStore } from '../src/store/authStore'
import { useStudioStore } from '../src/store/studioStore'
import { useTheme } from '../src/theme/ThemeContext'

export default function IndexScreen() {
  const router = useRouter()
  const { primary } = useTheme()

  useEffect(() => {
    async function checkAuth() {
      const studioUrl = await SecureStore.getItemAsync(STUDIO_URL_KEY)
      const token = await SecureStore.getItemAsync(TOKEN_KEY)

      if (!studioUrl) {
        router.replace('/onboarding/scan')
        return
      }

      // Restore studio name from SecureStore so screens have it immediately
      const studioName = await SecureStore.getItemAsync(STUDIO_NAME_KEY)
      useStudioStore.getState().hydrate(studioUrl, studioName ?? 'Agon Studio')

      if (!token) {
        router.replace('/onboarding/login')
        return
      }

      // Verify token and rehydrate user — if expired, go to login (studio URL preserved)
      try {
        const user = await authApi.me()
        useAuthStore.getState().setUser(user)
        router.replace('/(tabs)')
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY)
        router.replace('/onboarding/login')
      }
    }
    checkAuth()
  }, [])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={primary} />
    </View>
  )
}
