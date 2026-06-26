import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { membershipTypesApi } from '../../src/api/memberships'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import type { MembershipType } from '../../src/types'
import type { ApiError } from '../../src/api/client'

export default function PurchaseScreen() {
  const { data: types, isLoading, error } = useQuery({
    queryKey: ['membership-types'],
    queryFn: membershipTypesApi.list,
  })

  if (isLoading) return <LoadingView message="Loading membership options..." />
  if (error) return <ErrorView code={(error as ApiError).code} />

  const handlePurchase = (type: MembershipType) => {
    Alert.alert(
      'Purchase Membership',
      'Please contact your studio to purchase this membership.',
      [{ text: 'OK' }]
    )
  }

  return (
    <FlatList
      style={styles.container}
      data={types ?? []}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <Text style={styles.header}>Choose a Membership</Text>
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No membership options available.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.typeCard}>
          <View style={styles.typeHeader}>
            <Text style={styles.typeName}>{item.name}</Text>
            <Text style={styles.typePrice}>
              {item.currency.toUpperCase()} {(item.price / 100).toFixed(2)}
            </Text>
          </View>
          <View style={styles.typeMeta}>
            <Text style={styles.typeMetaText}>
              {item.unlimited ? 'Unlimited classes' : `${item.credits_included ?? 0} credits`}
            </Text>
            <Text style={styles.typeMetaText}>{item.type}</Text>
          </View>
          <TouchableOpacity style={styles.purchaseButton} onPress={() => handlePurchase(item)}>
            <Text style={styles.purchaseButtonText}>Purchase</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
