import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { bookingsApi } from '../../src/api/bookings'
import { useAuthStore } from '../../src/store/authStore'
import { useStudioStore } from '../../src/store/studioStore'
import { LoadingView } from '../../src/components/LoadingView'
import { format, parseISO, differenceInMinutes, isAfter } from 'date-fns'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user)
  const studioName = useStudioStore((s) => s.studioName)
  const router = useRouter()

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: bookingsApi.list,
  })

  const now = new Date()
  const upcomingBookings = (bookings ?? [])
    .filter((b) => b.status === 'confirmed' && isAfter(parseISO(b.created_at), new Date(0)))
    .sort((a, b) => 0) // sorted by class time ideally but we only have booking created_at

  // For home screen we just show total upcoming count
  const confirmedCount = (bookings ?? []).filter((b) => b.status === 'confirmed').length

  if (isLoading) return <LoadingView message="Loading your schedule..." />

  const firstName = user?.full_name?.split(' ')[0] ?? 'there'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()}, {firstName}</Text>
        {studioName && <Text style={styles.studioName}>{studioName}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Bookings</Text>
        <Text style={styles.cardValue}>{confirmedCount}</Text>
        <Text style={styles.cardSubtitle}>upcoming {confirmedCount === 1 ? 'class' : 'classes'}</Text>
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/classes')}
        >
          <Text style={styles.actionButtonText}>Browse Classes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/(tabs)/bookings')}
        >
          <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
            View My Bookings
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
  header: {
    marginBottom: 24,
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
