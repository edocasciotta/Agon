import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { classesApi } from '../../src/api/classes'
import { bookingsApi } from '../../src/api/bookings'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import type { ApiError } from '../../src/api/client'
import { format, parseISO, differenceInMinutes } from 'date-fns'

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [bookingState, setBookingState] = useState<'idle' | 'booked' | 'full' | 'duplicate'>('idle')

  const classId = Number(id)

  const { data: cls, isLoading, error } = useQuery({
    queryKey: ['class', classId],
    queryFn: () => classesApi.get(classId),
  })

  const bookMutation = useMutation({
    mutationFn: () => bookingsApi.create(classId),
    onSuccess: () => {
      setBookingState('booked')
      setTimeout(() => router.back(), 1500)
    },
    onError: (err: ApiError) => {
      if (err.code === 'BOOKING_CLASS_FULL') {
        setBookingState('full')
      } else if (err.code === 'BOOKING_DUPLICATE') {
        setBookingState('duplicate')
      } else {
        Alert.alert('Booking Error', err.message ?? 'Could not complete booking.')
      }
    },
  })

  const waitlistMutation = useMutation({
    mutationFn: () => bookingsApi.joinWaitlist(classId),
    onSuccess: () => {
      Alert.alert('Waitlist', 'You have been added to the waitlist.')
      router.back()
    },
    onError: (err: ApiError) => {
      Alert.alert('Error', err.message ?? 'Could not join waitlist.')
    },
  })

  if (isLoading) return <LoadingView message="Loading class..." />
  if (error) return <ErrorView code={(error as ApiError).code} />
  if (!cls) return <ErrorView message="Class not found." />

  const duration = differenceInMinutes(parseISO(cls.ends_at), parseISO(cls.starts_at))

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.classTitle}>Class #{cls.id}</Text>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Date</Text>
          <Text style={styles.infoValue}>{format(parseISO(cls.starts_at), 'EEEE, MMMM d, yyyy')}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Time</Text>
          <Text style={styles.infoValue}>
            {format(parseISO(cls.starts_at), 'HH:mm')} — {format(parseISO(cls.ends_at), 'HH:mm')}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Duration</Text>
          <Text style={styles.infoValue}>{duration} minutes</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Capacity</Text>
          <Text style={styles.infoValue}>{cls.capacity} spots</Text>
        </View>
        {cls.notes && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Notes</Text>
            <Text style={[styles.infoValue, styles.notesValue]}>{cls.notes}</Text>
          </View>
        )}
      </View>

      {bookingState === 'booked' && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>Booked! Redirecting...</Text>
        </View>
      )}

      {bookingState === 'duplicate' && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>Already booked</Text>
        </View>
      )}

      {bookingState === 'full' && (
        <View>
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>This class is full.</Text>
          </View>
          <TouchableOpacity
            style={styles.waitlistButton}
            onPress={() => waitlistMutation.mutate()}
            disabled={waitlistMutation.isPending}
          >
            {waitlistMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.waitlistButtonText}>Join Waitlist</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {bookingState === 'idle' && (
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => bookMutation.mutate()}
          disabled={bookMutation.isPending}
        >
          {bookMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookButtonText}>Book This Class</Text>
          )}
        </TouchableOpacity>
      )}
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
  classTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 2,
    textAlign: 'right',
  },
  notesValue: {
    textAlign: 'right',
  },
  bookButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  successBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  successText: {
    color: '#065F46',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBanner: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  infoBannerText: {
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: '600',
  },
  warningBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  warningText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  waitlistButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  waitlistButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
})
