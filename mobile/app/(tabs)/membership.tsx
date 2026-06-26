import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { clientMembershipsApi } from '../../src/api/memberships'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import type { ApiError } from '../../src/api/client'
import { format, parseISO } from 'date-fns'

export default function MembershipScreen() {
  const router = useRouter()

  const { data: memberships, isLoading, error } = useQuery({
    queryKey: ['memberships'],
    queryFn: clientMembershipsApi.getOwn,
  })

  if (isLoading) return <LoadingView message="Loading membership..." />
  if (error) return <ErrorView code={(error as ApiError).code} />

  const activeMembership = (memberships ?? []).find((m) => m.status === 'active')

  if (!activeMembership) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Active Membership</Text>
        <Text style={styles.emptySubtext}>
          You don't have an active membership. Contact your studio or purchase one below.
        </Text>
        <TouchableOpacity
          style={styles.purchaseButton}
          onPress={() => router.push('/membership/purchase')}
        >
          <Text style={styles.purchaseButtonText}>View Membership Options</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const creditsLabel = activeMembership.credits_remaining != null
    ? `${activeMembership.credits_remaining} credits remaining`
    : 'Unlimited'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.membershipCard}>
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
          <Text style={styles.infoLabel}>Credits Used</Text>
          <Text style={styles.infoValue}>{activeMembership.credits_used}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Started</Text>
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

      <TouchableOpacity
        style={styles.purchaseButton}
        onPress={() => router.push('/membership/purchase')}
      >
        <Text style={styles.purchaseButtonText}>View Membership Options</Text>
      </TouchableOpacity>
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
})
