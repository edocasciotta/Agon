import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { bookingsApi } from '../../src/api/bookings'
import type { Booking } from '../../src/types'
import { useAuthStore } from '../../src/store/authStore'
import { useStudioStore } from '../../src/store/studioStore'
import { LoadingView } from '../../src/components/LoadingView'
import { LanguagePicker } from '../../src/components/LanguagePicker'
import { useT } from '../../src/i18n'

function useGreeting(t: (key: string) => string): string {
  const hour = new Date().getHours()
  if (hour < 12) return t('home.morning')
  if (hour < 18) return t('home.afternoon')
  return t('home.evening')
}

export default function HomeScreen() {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const studioName = useStudioStore((s) => s.studioName)
  const router = useRouter()
  const greeting = useGreeting(t)

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: bookingsApi.list,
  })

  const confirmedCount = (bookings ?? []).filter((b: Booking) => b.status === 'confirmed').length

  if (isLoading) return <LoadingView message={t('home.loading')} />

  const firstName = user?.full_name?.split(' ')[0] ?? 'there'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>{greeting}, {firstName}</Text>
          {studioName && <Text style={styles.studioName}>{studioName}</Text>}
        </View>
        <LanguagePicker />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('home.yourBookings')}</Text>
        <Text style={styles.cardValue}>{confirmedCount}</Text>
        <Text style={styles.cardSubtitle}>
          {confirmedCount === 1 ? t('home.upcomingClass') : t('home.upcomingClasses')}
        </Text>
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/classes')}
        >
          <Text style={styles.actionButtonText}>{t('home.browseClasses')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/(tabs)/bookings')}
        >
          <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
            {t('home.viewBookings')}
          </Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  greeting: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111827',
  },
  studioName: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 14,
    color: '#C7D2FE',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#C7D2FE',
    marginTop: 4,
  },
  quickActions: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  actionButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#4F46E5',
  },
})
