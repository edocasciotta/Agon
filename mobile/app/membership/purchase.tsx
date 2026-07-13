import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react-native'
import { membershipTypesApi } from '../../src/api/memberships'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import type { MembershipType } from '../../src/types'
import type { ApiError } from '../../src/api/client'
import { useTheme } from '../../src/theme/ThemeContext'

export default function PurchaseScreen() {
  const router = useRouter()
  const { primary } = useTheme()

  const { data: types, isLoading, error } = useQuery({
    queryKey: ['membership-types'],
    queryFn: membershipTypesApi.list,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  if (isLoading) return <LoadingView message="Loading membership options..." />
  if (error) return <ErrorView code={(error as unknown as ApiError).code} />

  const activeTypes = (types ?? []).filter(
    (mt: MembershipType) => mt.is_active !== false && mt.sellable_online
  )

  return (
    <View style={styles.wrapper}>
      <Stack.Screen options={{ title: 'Membership Plans' }} />
      <OfflineBanner />
      <FlatList
        style={styles.container}
        data={activeTypes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<Text style={styles.header}>Choose a Membership</Text>}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No membership plans are currently available. Contact your studio.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const hasIntroPrice = item.is_intro_offer && item.intro_price != null
          const displayPrice = hasIntroPrice ? item.intro_price! : item.price
          const metaSummary = `${
            item.unlimited ? 'Unlimited classes' : `${item.credits_included ?? 0} credits`
          } · ${item.type}`

          return (
            <TouchableOpacity
              style={styles.typeCard}
              onPress={() => router.push(`/membership/checkout/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.typeMain}>
                <View style={styles.typeNameRow}>
                  <Text style={styles.typeName}>{item.name}</Text>
                  {item.is_intro_offer && (
                    <View style={styles.introBadge}>
                      <Text style={styles.introBadgeText}>Intro</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.typeMetaText}>{metaSummary}</Text>
              </View>
              <View style={styles.typeTrailing}>
                <View style={styles.typePriceContainer}>
                  {hasIntroPrice && (
                    <Text style={styles.typePriceOriginal}>
                      {item.currency.toUpperCase()} {item.price.toFixed(2)}
                    </Text>
                  )}
                  <Text style={[styles.typePrice, { color: primary }]}>
                    {item.currency.toUpperCase()} {displayPrice.toFixed(2)}
                  </Text>
                </View>
                <ChevronRight size={20} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          )
        }}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  typeMain: {
    flex: 1,
    marginRight: 12,
  },
  typeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  typeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
  },
  introBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  introBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
    textTransform: 'uppercase',
  },
  typeMetaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  typeTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typePriceContainer: {
    alignItems: 'flex-end',
  },
  typePriceOriginal: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  typePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4F46E5',
  },
})
