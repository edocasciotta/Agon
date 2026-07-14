import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Stack, useLocalSearchParams } from 'expo-router'
import { format, parseISO } from 'date-fns'
import { classesApi } from '../../src/api/classes'
import { checkinsApi } from '../../src/api/checkins'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { useT } from '../../src/i18n'
import { getErrorMessage } from '../../src/lib/errorMessages'
import type { ApiError } from '../../src/api/client'
import { useTheme } from '../../src/theme/ThemeContext'

export default function InstructorClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const classId = Number(id)
  const t = useT()
  const queryClient = useQueryClient()
  const { primary } = useTheme()
  const [checkinErrorByClient, setCheckinErrorByClient] = useState<Record<number, string>>({})

  const {
    data: scheduledClass,
    isLoading: classLoading,
    error: classError,
  } = useQuery({
    queryKey: ['instructor-class', classId],
    queryFn: () => classesApi.get(classId),
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const {
    data: roster,
    isLoading: rosterLoading,
    error: rosterError,
  } = useQuery({
    queryKey: ['class-roster', classId],
    queryFn: () => classesApi.roster(classId),
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const { data: checkins, isLoading: checkinsLoading } = useQuery({
    queryKey: ['class-checkins', classId],
    queryFn: () => checkinsApi.listForClass(classId),
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const checkinMutation = useMutation({
    mutationFn: (clientId: number) => checkinsApi.manual(classId, clientId),
    onSuccess: (_data, clientId) => {
      setCheckinErrorByClient((prev) => {
        const next = { ...prev }
        delete next[clientId]
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['class-checkins', classId] })
    },
    onError: (err: ApiError, clientId) => {
      setCheckinErrorByClient((prev) => ({
        ...prev,
        [clientId]: getErrorMessage(err.code ?? 'SERVER_ERROR'),
      }))
    },
  })

  const completeMutation = useMutation({
    mutationFn: () => classesApi.complete(classId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['instructor-class', classId], updated)
      queryClient.invalidateQueries({ queryKey: ['instructor-schedule'] })
    },
    onError: (err: ApiError) => {
      Alert.alert(
        t('instructorClassDetail.markCompleteFailed'),
        err.message ?? getErrorMessage(err.code ?? 'SERVER_ERROR')
      )
    },
  })

  const handleComplete = () => {
    Alert.alert(
      t('instructorClassDetail.completeConfirmTitle'),
      t('instructorClassDetail.completeConfirmMessage'),
      [
        { text: t('instructorClassDetail.completeConfirmCancel'), style: 'cancel' },
        {
          text: t('instructorClassDetail.completeConfirmConfirm'),
          onPress: () => completeMutation.mutate(),
        },
      ]
    )
  }

  if (classLoading || rosterLoading || checkinsLoading) {
    return <LoadingView message={t('instructorClassDetail.loading')} />
  }
  if (classError) return <ErrorView code={(classError as unknown as ApiError).code} />
  if (!scheduledClass) return <ErrorView message={t('instructorClassDetail.notFound')} />
  if (rosterError) return <ErrorView code={(rosterError as unknown as ApiError).code} />

  const checkedInBookingIds = new Set((checkins ?? []).map((c) => c.booking_id))

  return (
    <View style={styles.wrapper}>
      <Stack.Screen options={{ title: t('instructorClassDetail.title') }} />
      <OfflineBanner />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.name}>
          {scheduledClass.template_name ?? `${t('bookings.classFallback')} #${scheduledClass.id}`}
        </Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('instructorClassDetail.dateTime')}</Text>
            <Text style={styles.infoValue}>
              {format(parseISO(scheduledClass.starts_at), 'EEE, MMM d · HH:mm')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('instructorClassDetail.capacity')}</Text>
            <Text style={styles.infoValue}>
              {scheduledClass.booking_count}/{scheduledClass.capacity}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('bookings.statusLabel')}</Text>
            <Text style={[styles.infoValue, styles.statusValue]}>{scheduledClass.status}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('instructorClassDetail.roster')}</Text>
        {(roster ?? []).length === 0 ? (
          <Text style={styles.emptyText}>{t('instructorClassDetail.noBookings')}</Text>
        ) : (
          (roster ?? []).map((entry) => {
            const isCheckedIn = checkedInBookingIds.has(entry.booking_id)
            const pending =
              checkinMutation.isPending && checkinMutation.variables === entry.client_id

            return (
              <View key={entry.booking_id} style={styles.rosterRow}>
                <View style={styles.rosterInfo}>
                  <Text style={styles.rosterName}>
                    {entry.full_name ?? entry.email ?? `#${entry.client_id}`}
                  </Text>
                  {checkinErrorByClient[entry.client_id] && (
                    <Text style={styles.rosterError}>{checkinErrorByClient[entry.client_id]}</Text>
                  )}
                </View>
                {isCheckedIn ? (
                  <View style={styles.checkedInBadge}>
                    <Text style={styles.checkedInText}>{t('instructorClassDetail.checkedIn')}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.checkInButton, { borderColor: primary }]}
                    onPress={() => checkinMutation.mutate(entry.client_id)}
                    disabled={pending}
                  >
                    {pending ? (
                      <ActivityIndicator size="small" color={primary} />
                    ) : (
                      <Text style={[styles.checkInText, { color: primary }]}>
                        {t('instructorClassDetail.checkIn')}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )
          })
        )}

        {scheduledClass.status === 'completed' ? (
          <Text style={styles.completedText}>{t('instructorClassDetail.completed')}</Text>
        ) : (
          <TouchableOpacity
            style={[styles.completeButton, { backgroundColor: primary }]}
            onPress={handleComplete}
            disabled={completeMutation.isPending}
          >
            {completeMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.completeButtonText}>{t('instructorClassDetail.markComplete')}</Text>
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
    paddingBottom: 40,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
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
  statusValue: {
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  rosterInfo: {
    flex: 1,
  },
  rosterName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  rosterError: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
  checkedInBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#D1FAE5',
  },
  checkedInText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  checkInButton: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    minWidth: 76,
    alignItems: 'center',
  },
  checkInText: {
    fontSize: 13,
    fontWeight: '600',
  },
  completeButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  completedText: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#059669',
  },
})
