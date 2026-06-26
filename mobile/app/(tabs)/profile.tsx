import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../src/store/authStore'
import { useStudioStore } from '../../src/store/studioStore'
import * as Notifications from 'expo-notifications'
import { useState, useEffect } from 'react'

export default function ProfileScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const [notifStatus, setNotifStatus] = useState<string>('unknown')

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => setNotifStatus(status))
  }, [])

  const handleDisconnect = async () => {
    await useStudioStore.getState().clearStudio()
    router.replace('/onboarding/scan')
  }

  const handleSignOut = async () => {
    await useAuthStore.getState().logout()
    router.replace('/onboarding/login')
  }

  const handleToggleNotifications = async () => {
    if (notifStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      setNotifStatus(status)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.full_name ?? '—'}</Text>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Push Notifications</Text>
          <View style={styles.rowRight}>
            <Text style={[
              styles.notifStatus,
              { color: notifStatus === 'granted' ? '#059669' : '#DC2626' }
            ]}>
              {notifStatus === 'granted' ? 'Enabled' : 'Disabled'}
            </Text>
            {notifStatus !== 'granted' && (
              <TouchableOpacity onPress={handleToggleNotifications} style={styles.enableButton}>
                <Text style={styles.enableButtonText}>Enable</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={handleSignOut}>
          <Text style={styles.dangerButtonText}>Sign Out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dangerButton, styles.disconnectButton]} onPress={handleDisconnect}>
          <Text style={[styles.dangerButtonText, styles.disconnectText]}>Disconnect from Studio</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 16,
    color: '#111827',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  enableButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  enableButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  dangerButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    marginBottom: 8,
  },
  dangerButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  disconnectButton: {
    backgroundColor: '#FEF3C7',
    marginBottom: 0,
  },
  disconnectText: {
    color: '#92400E',
  },
})
