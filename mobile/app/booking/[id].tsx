import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { bookingsApi } from '../../src/api/bookings'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { useT } from '../../src/i18n'
import type { ApiError } from '../../src/api/client'
import { format, parseISO } from 'date-fns'
import { useTheme } from '../../src/theme/ThemeContext'

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const t = useT()
  const queryClient = useQueryClient()
  const { primary } = useTheme()
  const [cancelling, setCancelling] = useState(false)

  const bookingId = Number(id)

  // completed/no_show/cancelled stay hardcoded — semantic status colors, not brand accents.
  const STATUS_COLORS: Record<string, string> = {
    confirmed: primary,
    cancelled: '#6B7280',
    no_show: '#DC2626',
  }

  const {
    data: booking,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => bookingsApi.get(bookingId),
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const cancelMutation = useMutation({
    mutationFn: () => bookingsApi.cancel(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setCancelling(false)
      router.back()
    },
    onError: (err: ApiError) => {
      Alert.alert(t('bookings.cancelTitle'), err.message ?? t('bookings.cancelFailed'))
      setCancelling(false)
    },
  })

  function handleCancel() {
    Alert.alert(t('bookings.cancelTitle'), t('bookings.cancelMessage'), [
      { text: t('bookings.cancelKeep'), style: 'cancel' },
      {
        text: t('bookings.cancelConfirm'),
        style: 'destructive',
        onPress: () => {
          setCancelling(true)
          cancelMutation.mutate()
        },
      },
    ])
  }

  if (isLoading) return <LoadingView message={t('bookings.loading')} />
  if (error) return <ErrorView code={(error as unknown as ApiError).code} />
  if (!booking) return <ErrorView message={t('bookings.notFound')} />

  const title =
    booking.class_type_name ?? `${t('bookings.classFallback')} #${booking.scheduled_class_id}`

  return (
    <View style={styles.wrapper}>
      <Stack.Screen options={{ title: t('bookings.detailTitle') }} />
      <OfflineBanner />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.classTitle}>{title}</Text>

        <View style={styles.infoCard}>
          {booking.class_starts_at && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('bookings.date')}</Text>
              <Text style={styles.infoValue}>
                {format(parseISO(booking.class_starts_at), 'EEEE, MMMM d, yyyy')}
              </Text>
            </View>
          )}
          {booking.class_starts_at && booking.class_ends_at && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('bookings.time')}</Text>
              <Text style={styles.infoValue}>
                {format(parseISO(booking.class_starts_at), 'HH:mm')} —{' '}
                {format(parseISO(booking.class_ends_at), 'HH:mm')}
              </Text>
            </View>
          )}
          {booking.location_name && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('bookings.location')}</Text>
              <Text style={styles.infoValue}>{booking.location_name}</Text>
            </View>
          )}
          {booking.instructor_name && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('bookings.instructor')}</Text>
              {/* Plain text, not tappable: the enriched booking response only exposes
                  instructor_name (a string), not a numeric instructor id to link to. */}
              <Text style={styles.infoValue}>{booking.instructor_name}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('bookings.statusLabel')}</Text>
            <Text style={[styles.infoValue, { color: STATUS_COLORS[booking.status] }]}>
              {t(`bookings.status.${booking.status}`)}
            </Text>
          </View>
        </View>

        {booking.status === 'confirmed' && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={cancelling}>
            {cancelling ? (
              <ActivityIndicator color="#DC2626" />
            ) : (
              <Text style={styles.cancelButtonText}>{t('bookings.cancelConfirm')}</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  container: {
    flex: 1,
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
  cancelButton: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  cancelButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '700',
  },
})
