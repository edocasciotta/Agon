import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { bookingsApi } from '../../src/api/bookings'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { useT } from '../../src/i18n'
import type { Booking } from '../../src/types'
import type { ApiError } from '../../src/api/client'
import { format, parseISO } from 'date-fns'
import { useTheme } from '../../src/theme/ThemeContext'

export default function BookingsScreen() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const { primary } = useTheme()
  const STATUS_COLORS: Record<string, string> = {
    confirmed: primary,
    cancelled: '#6B7280',
    no_show: '#DC2626',
  }

  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ['bookings'],
    queryFn: bookingsApi.list,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => bookingsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setCancellingId(null)
    },
    onError: (err: ApiError) => {
      Alert.alert('Error', err.message ?? 'Could not cancel booking.')
      setCancellingId(null)
    },
  })

  const handleCancel = (id: number) => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Booking',
        style: 'destructive',
        onPress: () => {
          setCancellingId(id)
          cancelMutation.mutate(id)
        },
      },
    ])
  }

  if (isLoading) return <LoadingView message="Loading bookings..." />
  if (error) return <ErrorView code={(error as unknown as ApiError).code} />

  const upcoming = (bookings ?? []).filter(
    (b: Booking) => b.status === 'confirmed'
  )
  const past = (bookings ?? []).filter(
    (b: Booking) => b.status !== 'confirmed'
  )

  const sections = [
    { title: 'Upcoming', data: upcoming },
    { title: 'Past', data: past },
  ].filter((s) => s.data.length > 0)

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No bookings yet.</Text>
          <Text style={styles.emptySubtext}>Browse classes to make your first booking.</Text>
        </View>
      ) : (
        <SectionList
          style={styles.list}
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item, section }) => (
            <TouchableOpacity
              style={styles.bookingCard}
              onPress={() => router.push(`/booking/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.bookingInfo}>
                <Text style={styles.bookingTitle}>
                  {item.class_type_name ?? `${t('bookings.classFallback')} #${item.scheduled_class_id}`}
                </Text>
                {item.class_starts_at && (
                  <Text style={styles.bookingDate}>
                    {format(parseISO(item.class_starts_at), 'EEE, MMM d · HH:mm')}
                  </Text>
                )}
                {item.instructor_name && (
                  <Text style={styles.bookingInstructor}>
                    {t('bookings.with')} {item.instructor_name}
                  </Text>
                )}
                {item.location_name && (
                  <Text style={styles.bookingLocation}>{item.location_name}</Text>
                )}
              </View>
              <View style={styles.rightColumn}>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '22' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
                    {item.status}
                  </Text>
                </View>
                {section.title === 'Upcoming' && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => handleCancel(item.id)}
                    disabled={cancellingId === item.id}
                  >
                    {cancellingId === item.id ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <Text style={styles.cancelText}>Cancel</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookingCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  bookingDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  bookingInstructor: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  bookingLocation: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  rightColumn: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  cancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DC2626',
    minWidth: 56,
    alignItems: 'center',
  },
  cancelText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },
})
