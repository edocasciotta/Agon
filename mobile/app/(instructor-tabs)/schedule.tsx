import { useMemo } from 'react'
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { format, parseISO, subDays, addDays } from 'date-fns'
import { classesApi } from '../../src/api/classes'
import { instructorsApi } from '../../src/api/instructors'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { useT } from '../../src/i18n'
import type { ScheduledClass } from '../../src/types'
import type { ApiError } from '../../src/api/client'
import { useTheme } from '../../src/theme/ThemeContext'

export default function InstructorScheduleScreen() {
  const t = useT()
  const router = useRouter()
  const { primary } = useTheme()

  const STATUS_COLORS: Record<string, string> = {
    scheduled: primary,
    completed: '#059669',
    cancelled: '#DC2626',
  }

  // A 90-day window centred on today (30 days back, 60 forward) — wide enough
  // to cover the "Past" and "Upcoming" sections without refetching on every
  // scroll. Computed once per mount so the query key stays stable.
  const { startDate, endDate } = useMemo(() => {
    const now = new Date()
    return {
      startDate: format(subDays(now, 30), 'yyyy-MM-dd'),
      endDate: format(addDays(now, 60), 'yyyy-MM-dd'),
    }
  }, [])

  const {
    data: instructor,
    isLoading: meLoading,
    error: meError,
  } = useQuery({
    queryKey: ['instructor-me'],
    queryFn: instructorsApi.getMe,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const {
    data: classes,
    isLoading: classesLoading,
    error: classesError,
  } = useQuery({
    queryKey: ['instructor-schedule', instructor?.id, startDate, endDate],
    queryFn: () =>
      classesApi.list({ instructor_id: instructor!.id, start_date: startDate, end_date: endDate }),
    enabled: !!instructor,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  if (meLoading) return <LoadingView message={t('instructorSchedule.loading')} />
  if (meError) return <ErrorView code={(meError as unknown as ApiError).code} />
  if (classesLoading) return <LoadingView message={t('instructorSchedule.loading')} />
  if (classesError) return <ErrorView code={(classesError as unknown as ApiError).code} />

  const now = new Date()
  const upcoming = (classes ?? []).filter((c) => parseISO(c.starts_at) >= now)
  const past = (classes ?? [])
    .filter((c) => parseISO(c.starts_at) < now)
    .sort((a, b) => parseISO(b.starts_at).getTime() - parseISO(a.starts_at).getTime())

  const sections = [
    { title: t('instructorSchedule.upcoming'), data: upcoming },
    { title: t('instructorSchedule.past'), data: past },
  ].filter((s) => s.data.length > 0)

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('instructorSchedule.empty')}</Text>
        </View>
      ) : (
        <SectionList
          style={styles.list}
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }: { item: ScheduledClass }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/instructor-class/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>
                  {item.template_name ?? `${t('bookings.classFallback')} #${item.id}`}
                </Text>
                <Text style={styles.cardDate}>
                  {format(parseISO(item.starts_at), 'EEE, MMM d · HH:mm')}
                </Text>
                <Text style={styles.cardBooked}>
                  {item.booking_count}/{item.capacity} {t('instructorSchedule.booked')}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: (STATUS_COLORS[item.status] ?? primary) + '22' },
                ]}
              >
                <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? primary }]}>
                  {item.status}
                </Text>
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
    fontSize: 16,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  cardDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  cardBooked: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
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
})
