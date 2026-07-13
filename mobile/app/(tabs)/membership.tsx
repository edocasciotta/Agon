import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { clientMembershipsApi, billingApi } from '../../src/api/memberships'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { useAuthStore } from '../../src/store/authStore'
import { useT } from '../../src/i18n'
import type { ApiError } from '../../src/api/client'
import type { Membership } from '../../src/types'
import { format, parseISO } from 'date-fns'
import { useTheme } from '../../src/theme/ThemeContext'

export default function MembershipScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)
  const t = useT()
  const { primary } = useTheme()

  const { data: memberships, isLoading, error } = useQuery({
    queryKey: ['memberships'],
    queryFn: clientMembershipsApi.getOwn,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const { data: subscriptionData } = useQuery({
    queryKey: ['my-subscription', user?.id],
    queryFn: () => billingApi.getSubscription(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const cancelMutation = useMutation({
    mutationFn: () => billingApi.cancelSubscription(user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['memberships'] })
    },
  })

  if (isLoading) return <LoadingView message="Loading membership..." />
  if (error) return <ErrorView code={(error as unknown as ApiError).code} />

  const activeMembership = (memberships ?? []).find((m: Membership) => m.status === 'active')
  const subscription = subscriptionData?.subscription ?? null

  function handleCancelPress() {
    Alert.alert(
      'Cancel subscription?',
      'Your access continues until the end of the current period.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: () => cancelMutation.mutate(),
        },
      ]
    )
  }

  function getStatusBadgeStyle(status: string) {
    if (status === 'active') {
      return { bg: '#D1FAE5', text: '#065F46' }
    }
    if (status === 'past_due' || status === 'payment_overdue') {
      return { bg: '#FEF3C7', text: '#92400E' }
    }
    return { bg: '#F3F4F6', text: '#374151' }
  }

  function formatPeriodEnd(dateStr: string | null): string {
    if (!dateStr) return '—'
    return format(parseISO(dateStr), 'MMM d, yyyy')
  }

  if (!activeMembership && !subscription) {
    return (
      // edges excludes 'top': this screen already gets a native tab header (see
      // (tabs)/_layout.tsx — headerShown isn't disabled for the Membership tab), which
      // already accounts for the status bar/notch. Adding a top inset here would double it.
      <SafeAreaView style={styles.emptyContainer} edges={['left', 'right', 'bottom']}>
        <Text style={styles.emptyTitle}>No Active Membership</Text>
        <Text style={styles.emptySubtext}>
          You don't have an active membership. Contact your studio or purchase one below.
        </Text>
        <TouchableOpacity
          style={[styles.purchaseButton, { borderColor: primary }]}
          onPress={() => router.push('/membership/purchase')}
        >
          <Text style={[styles.purchaseButtonText, { color: primary }]}>View Membership Options</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.giftCardButton}
          onPress={() => router.push('/gift-card/purchase')}
        >
          <Text style={styles.giftCardButtonText}>{t('giftCard.giveAGiftCard')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const creditsLabel = activeMembership?.credits_remaining != null
    ? `${activeMembership.credits_remaining} credits remaining`
    : 'Unlimited'

  return (
    // edges excludes 'top': the Membership tab already renders a native header (see
    // (tabs)/_layout.tsx — headerShown isn't disabled), which already insets for the
    // status bar/notch. Adding a top inset here on top of that would double the padding.
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <OfflineBanner />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {activeMembership && (
          <View style={[styles.membershipCard, { backgroundColor: primary }]}>
            <Text style={styles.cardLabel}>Active Membership</Text>
            <Text style={styles.membershipId}>Membership #{activeMembership.id}</Text>

            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{activeMembership.status.toUpperCase()}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Credits</Text>
              <Text style={styles.infoValue}>{creditsLabel}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('membership.creditsUsed')}</Text>
              <Text style={styles.infoValue}>{activeMembership.credits_used}</Text>
            </View>

            {activeMembership.rollover_credits > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('membership.rolloverCredits')}</Text>
                <Text style={styles.infoValue}>{activeMembership.rollover_credits}</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('membership.started')}</Text>
              <Text style={styles.infoValue}>
                {format(parseISO(activeMembership.starts_at), 'MMM d, yyyy')}
              </Text>
            </View>

            {activeMembership.expires_at && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Expires</Text>
                <Text style={styles.infoValue}>
                  {format(parseISO(activeMembership.expires_at), 'MMM d, yyyy')}
                </Text>
              </View>
            )}
          </View>
        )}

        {subscription && (() => {
          const badgeStyle = getStatusBadgeStyle(subscription.status)
          return (
            <View style={styles.subscriptionCard}>
              <Text style={styles.subscriptionCardLabel}>STRIPE SUBSCRIPTION</Text>

              <View style={styles.subscriptionRow}>
                <Text style={styles.subscriptionInfoLabel}>Status</Text>
                <View style={[styles.subscriptionBadge, { backgroundColor: badgeStyle.bg }]}>
                  <Text style={[styles.subscriptionBadgeText, { color: badgeStyle.text }]}>
                    {subscription.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.subscriptionRow}>
                <Text style={styles.subscriptionInfoLabel}>Renews</Text>
                <Text style={styles.subscriptionInfoValue}>
                  {formatPeriodEnd(subscription.current_period_end)}
                </Text>
              </View>

              {subscription.status === 'active' && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelPress}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )
        })()}

        <TouchableOpacity
          style={[styles.purchaseButton, { borderColor: primary }]}
          onPress={() => router.push('/membership/purchase')}
        >
          <Text style={[styles.purchaseButtonText, { color: primary }]}>View Membership Options</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.giftCardButton}
          onPress={() => router.push('/gift-card/purchase')}
        >
          <Text style={styles.giftCardButtonText}>{t('giftCard.giveAGiftCard')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  membershipCard: {
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  cardLabel: {
    fontSize: 12,
    color: '#C7D2FE',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  membershipId: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#6EE7B7',
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#C7D2FE',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  subscriptionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subscriptionCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  subscriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subscriptionInfoLabel: {
    fontSize: 14,
    color: '#374151',
  },
  subscriptionInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  subscriptionBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  subscriptionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  purchaseButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  purchaseButtonText: {
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: '600',
  },
  giftCardButton: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  giftCardButtonText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
})
