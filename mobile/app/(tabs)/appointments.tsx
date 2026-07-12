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
import { format, parseISO } from 'date-fns'
import { appointmentsApi } from '../../src/api/appointments'
import { appointmentServicesApi } from '../../src/api/appointmentServices'
import { instructorsApi } from '../../src/api/instructors'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { getErrorMessage } from '../../src/lib/errorMessages'
import { useT } from '../../src/i18n'
import type { Appointment, AppointmentStatus } from '../../src/types'
import type { ApiError } from '../../src/api/client'

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  confirmed: '#4F46E5',
  cancelled: '#6B7280',
  completed: '#059669',
  no_show: '#DC2626',
}

export default function AppointmentsScreen() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const {
    data: appointments,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => appointmentsApi.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const { data: services } = useQuery({
    queryKey: ['appointment-services'],
    queryFn: () => appointmentServicesApi.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const { data: instructors } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => appointmentsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setCancellingId(null)
    },
    onError: (err: ApiError) => {
      Alert.alert(t('appointments.cancelTitle'), getErrorMessage(err.code) ?? t('appointments.cancelFailed'))
      setCancellingId(null)
    },
  })

  function handleCancel(id: number) {
    Alert.alert(t('appointments.cancelTitle'), t('appointments.cancelMessage'), [
      { text: t('appointments.cancelKeep'), style: 'cancel' },
      {
        text: t('appointments.cancelConfirm'),
        style: 'destructive',
        onPress: () => {
          setCancellingId(id)
          cancelMutation.mutate(id)
        },
      },
    ])
  }

  function serviceName(id: number): string {
    return services?.find((s) => s.id === id)?.name ?? `#${id}`
  }

  function instructorName(id: number): string {
    return instructors?.find((i) => i.id === id)?.full_name ?? `#${id}`
  }

  if (isLoading) return <LoadingView message={t('appointments.loading')} />
  if (error) return <ErrorView code={(error as unknown as ApiError).code} />

  const upcoming = (appointments ?? []).filter((a: Appointment) => a.status === 'confirmed')
  const past = (appointments ?? []).filter((a: Appointment) => a.status !== 'confirmed')

  const sections = [
    { title: t('appointments.upcoming'), data: upcoming },
    { title: t('appointments.past'), data: past },
  ].filter((s) => s.data.length > 0)

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('appointments.title')}</Text>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => router.push('/appointment/book')}
        >
          <Text style={styles.bookButtonText}>{t('appointments.bookNew')}</Text>
        </TouchableOpacity>
      </View>

      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('appointments.empty')}</Text>
          <Text style={styles.emptySubtext}>{t('appointments.emptySubtext')}</Text>
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
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.serviceName}>{serviceName(item.service_id)}</Text>
                <Text style={styles.withInstructor}>
                  {t('appointments.with')} {instructorName(item.instructor_id)}
                </Text>
                <Text style={styles.dateText}>
                  {format(parseISO(item.starts_at), 'EEE, MMM d · HH:mm')}
                </Text>
              </View>
              <View style={styles.rightColumn}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: STATUS_COLORS[item.status] + '22' },
                  ]}
                >
                  <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
                    {t(`appointments.status.${item.status}`)}
                  </Text>
                </View>
                {section.title === t('appointments.upcoming') && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => handleCancel(item.id)}
                    disabled={cancellingId === item.id}
                  >
                    {cancellingId === item.id ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <Text style={styles.cancelText}>{t('appointments.cancelConfirm')}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  bookButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
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
  card: {
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
  cardInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  withInstructor: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
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
    fontSize: 12,
    fontWeight: '500',
  },
})
