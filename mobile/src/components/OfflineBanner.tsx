import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { format } from 'date-fns'
import { useConnectivityStore } from '../store/connectivityStore'

export function OfflineBanner() {
  const { isOnline, lastOnlineAt } = useConnectivityStore()

  if (isOnline) return null

  const lastSeen = lastOnlineAt
    ? `Last updated: ${format(lastOnlineAt, 'HH:mm')}. `
    : ''

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        {lastSeen}Server unreachable — showing cached data.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF08A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
    color: '#78350F',
    textAlign: 'center',
  },
})
