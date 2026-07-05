import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { membershipTypesApi, billingApi } from '../../src/api/memberships'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { useAuthStore } from '../../src/store/authStore'
import type { MembershipType } from '../../src/types'
import type { ApiError } from '../../src/api/client'

export default function PurchaseScreen() {
  const user = useAuthStore((s) => s.user)
  const [loadingId, setLoadingId] = useState<number | null>(null)

  const { data: types, isLoading, error } = useQuery({
    queryKey: ['membership-types'],
    queryFn: membershipTypesApi.list,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  if (isLoading) return <LoadingView message="Loading membership options..." />
  if (error) return <ErrorView code={(error as unknown as ApiError).code} />

  const onlineTypes = (types ?? []).filter((t: MembershipType) => t.sellable_online)

  const handlePurchase = async (type: MembershipType) => {
    if (!user) return
    try {
      setLoadingId(type.id)
      const { checkout_url } = await billingApi.createCheckoutSession(user.id, type.id)
      await Linking.openURL(checkout_url)
    } catch (err) {
      Alert.alert('Error', (err as ApiError).message ?? 'Could not start purchase.')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <View style={styles.wrapper}>
      <OfflineBanner />
      <FlatList
        style={styles.container}
        data={onlineTypes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.header}>Choose a Membership</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No membership options are available for online purchase.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.typeCard}>
            <View style={styles.typeHeader}>
              <Text style={styles.typeName}>{item.name}</Text>
              <Text style={styles.typePrice}>
                {item.currency.toUpperCase()} {item.price.toFixed(2)}
              </Text>
            </View>
            <View style={styles.typeMeta}>
              <Text style={styles.typeMetaText}>
                {item.unlimited ? 'Unlimited classes' : `${item.credits_included ?? 0} credits`}
              </Text>
              <Text style={styles.typeMetaText}>{item.type}</Text>
            </View>
            <TouchableOpacity
              style={[styles.purchaseButton, loadingId !== null && styles.purchaseButtonDisabled]}
              onPress={() => handlePurchase(item)}
              disabled={loadingId !== null}
            >
              {loadingId === item.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.purchaseButtonText}>Purchase</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      />
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
  listContent: {
    padding: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  typeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  typeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  typePrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4F46E5',
  },
  typeMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  typeMetaText: {
    fontSize: 13,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  purchaseButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
