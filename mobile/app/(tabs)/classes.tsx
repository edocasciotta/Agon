import { View, Text, StyleSheet, FlatList, TouchableOpacity, SectionList } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { classesApi } from '../../src/api/classes'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import type { ScheduledClass } from '../../src/types'
import type { ApiError } from '../../src/api/client'
import {
  startOfWeek,
  endOfWeek,
  format,
  parseISO,
  differenceInMinutes,
  isSameDay,
} from 'date-fns'

function formatDuration(starts_at: string, ends_at: string): string {
  const mins = differenceInMinutes(parseISO(ends_at), parseISO(starts_at))
  return `${mins} min`
}

function groupByDay(classes: ScheduledClass[]): { title: string; data: ScheduledClass[] }[] {
  const map = new Map<string, ScheduledClass[]>()
  for (const cls of classes) {
    const day = format(parseISO(cls.starts_at), 'EEEE, MMM d')
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(cls)
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }))
}

export default function ClassesScreen() {
  const router = useRouter()
  const now = new Date()
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const { data: classes, isLoading, error } = useQuery({
    queryKey: ['classes', weekStart, weekEnd],
    queryFn: () => classesApi.list({ start_date: weekStart, end_date: weekEnd }),
  })

  if (isLoading) return <LoadingView message="Loading classes..." />
  if (error) return <ErrorView code={(error as unknown as ApiError).code} />

  const sections = groupByDay(
    (classes ?? []).filter((c: ScheduledClass) => c.status === 'scheduled')
  )

  if (sections.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No classes scheduled this week.</Text>
      </View>
    )
  }

  return (
    <SectionList
      style={styles.container}
      sections={sections}
      keyExtractor={(item) => String(item.id)}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.classCard}
          onPress={() => router.push(`/class/${item.id}`)}
        >
          <View style={styles.classTime}>
            <Text style={styles.timeText}>{format(parseISO(item.starts_at), 'HH:mm')}</Text>
            <Text style={styles.durationText}>{formatDuration(item.starts_at, item.ends_at)}</Text>
          </View>
          <View style={styles.classInfo}>
            <Text style={styles.classId}>{item.template_name ?? `Class #${item.id}`}</Text>
            {item.notes ? (
              <Text style={styles.classNotes} numberOfLines={1}>{item.notes}</Text>
            ) : null}
          </View>
          <View style={styles.capacityBadge}>
            <Text style={styles.capacityText}>{item.capacity} spots</Text>
          </View>
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.listContent}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  classCard: {
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
  classTime: {
    width: 64,
    alignItems: 'center',
    marginRight: 12,
  },
  timeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  durationText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  classInfo: {
    flex: 1,
  },
  classId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  classNotes: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  capacityBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  capacityText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '500',
  },
})
