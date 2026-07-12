import { View, ActivityIndicator, Text } from 'react-native'
import { useTheme } from '../theme/ThemeContext'

export function LoadingView({ message = 'Loading...' }: { message?: string }) {
  const { primary } = useTheme()
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <ActivityIndicator size="large" color={primary} />
      <Text style={{ color: '#6B7280', fontSize: 14 }}>{message}</Text>
    </View>
  )
}
