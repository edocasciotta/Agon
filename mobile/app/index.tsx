import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { TOKEN_KEY, STUDIO_URL_KEY } from '../src/api/client'

export default function IndexScreen() {
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      const studioUrl = await SecureStore.getItemAsync(STUDIO_URL_KEY)
      const token = await SecureStore.getItemAsync(TOKEN_KEY)

      if (!studioUrl) {
        router.replace('/onboarding/scan')
      } else if (!token) {
        router.replace('/onboarding/login')
      } else {
        router.replace('/(tabs)')
      }
    }
    checkAuth()
  }, [])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#4F46E5" />
    </View>
  )
}
