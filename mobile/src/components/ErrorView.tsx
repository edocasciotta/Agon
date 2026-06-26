import { View, Text } from 'react-native'
import { getErrorMessage } from '../lib/errorMessages'

export function ErrorView({ code, message }: { code?: string; message?: string }) {
  const text = code ? getErrorMessage(code) : (message ?? 'An error occurred')
  return (
    <View style={{ margin: 16, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 8 }}>
      <Text style={{ color: '#DC2626', fontSize: 14 }}>{text}</Text>
    </View>
  )
}
