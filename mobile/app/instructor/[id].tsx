import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams } from 'expo-router'
import { instructorsApi } from '../../src/api/instructors'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { useT } from '../../src/i18n'
import type { ApiError } from '../../src/api/client'

export default function InstructorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const t = useT()

  const instructorId = Number(id)

  const {
    data: instructor,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['instructor', instructorId],
    queryFn: () => instructorsApi.get(instructorId),
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  if (isLoading) return <LoadingView message={t('instructor.loading')} />
  if (error) return <ErrorView code={(error as unknown as ApiError).code} />
  if (!instructor) return <ErrorView message={t('instructor.notFound')} />

  return (
    <View style={styles.wrapper}>
      <Stack.Screen options={{ title: t('instructor.detailTitle') }} />
      <OfflineBanner />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* No photo yet — Instructor.photo_path exists on the backend model but there is
            no upload/serving infrastructure for it (separate, not-yet-built feature). */}
        <Text style={styles.name}>{instructor.full_name}</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('instructor.email')}</Text>
            <Text style={styles.infoValue}>{instructor.email}</Text>
          </View>
        </View>

        {instructor.bio && (
          <View style={styles.bioCard}>
            <Text style={styles.bioLabel}>{t('instructor.bio')}</Text>
            <Text style={styles.bioText}>{instructor.bio}</Text>
          </View>
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
  name: {
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
  bioCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  bioLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
})
