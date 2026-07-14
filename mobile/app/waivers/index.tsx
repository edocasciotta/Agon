import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Stack, useRouter } from 'expo-router'
import { FileText, ChevronRight, CheckCircle2 } from 'lucide-react-native'
import { format, parseISO } from 'date-fns'
import { waiversApi } from '../../src/api/waivers'
import { useAuthStore } from '../../src/store/authStore'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import { useT } from '../../src/i18n'
import { useTheme } from '../../src/theme/ThemeContext'
import type { ApiError } from '../../src/api/client'

export default function WaiversListScreen() {
  const t = useT()
  const router = useRouter()
  const { primary } = useTheme()
  const user = useAuthStore((s) => s.user)

  const { data: waivers, isLoading, error } = useQuery({
    queryKey: ['client-waivers', user?.id],
    queryFn: () => waiversApi.listForClient(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('waivers.title') }} />
      <OfflineBanner />

      {isLoading ? (
        <LoadingView message={t('waivers.loading')} />
      ) : error ? (
        <ErrorView code={(error as unknown as ApiError).code} />
      ) : !waivers || waivers.length === 0 ? (
        <View style={styles.emptyState}>
          <FileText size={32} color="#9CA3AF" />
          <Text style={styles.emptyText}>{t('waivers.empty')}</Text>
        </View>
      ) : (
        waivers.map((waiver) => (
          <TouchableOpacity
            key={waiver.id}
            style={styles.card}
            onPress={() => router.push(`/waivers/${waiver.id}` as never)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{waiver.title}</Text>
              <ChevronRight size={20} color="#9CA3AF" />
            </View>
            <View style={styles.badgeRow}>
              {waiver.is_signed ? (
                <View style={[styles.badge, styles.signedBadge]}>
                  <CheckCircle2 size={14} color="#059669" />
                  <Text style={styles.signedBadgeText}>
                    {waiver.signed_at
                      ? `${t('waivers.signed')} — ${format(parseISO(waiver.signed_at), 'MMM d, yyyy')}`
                      : t('waivers.signed')}
                  </Text>
                </View>
              ) : (
                <View style={[styles.badge, styles.unsignedBadge]}>
                  <Text style={styles.unsignedBadgeText}>{t('waivers.unsigned')}</Text>
                </View>
              )}
              {waiver.requires_before_booking && (
                <View style={[styles.badge, styles.requiredBadge, { borderColor: primary }]}>
                  <Text style={[styles.requiredBadgeText, { color: primary }]}>
                    {t('waivers.requiredBadge')}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  signedBadge: {
    backgroundColor: '#D1FAE5',
  },
  signedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  unsignedBadge: {
    backgroundColor: '#FEF2F2',
  },
  unsignedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  requiredBadge: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  requiredBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
})
