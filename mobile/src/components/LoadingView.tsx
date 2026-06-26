import { View, ActivityIndicator, Text } from 'react-native'

export function LoadingView({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <ActivityIndicator size="large" color="#4F46E5" />
      <Text style={{ color: '#6B7280', fontSize: 14 }}>{message}</Text>
    </View>
  )
}
