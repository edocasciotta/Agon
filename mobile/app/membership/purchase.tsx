import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  TextInput,
} from 'react-native'
import { useState } from 'react'
import { Stack, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import {
  membershipTypesApi,
  billingApi,
  promoCodesApi,
  giftCardsApi,
  type CreateCheckoutSessionOptions,
} from '../../src/api/memberships'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { useAuthStore } from '../../src/store/authStore'
import { useT } from '../../src/i18n'
import { getErrorMessage } from '../../src/lib/errorMessages'
import type {
  MembershipType,
  PromoCodeValidateResponse,
  GiftCardValidateResponse,
} from '../../src/types'
import type { ApiError } from '../../src/api/client'

export default function PurchaseScreen() {
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const t = useT()
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoValidating, setPromoValidating] = useState(false)
  const [promoResult, setPromoResult] = useState<PromoCodeValidateResponse | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoAppliedForTypeId, setPromoAppliedForTypeId] = useState<number | null>(null)
  const [giftCardCode, setGiftCardCode] = useState('')
  const [giftCardValidating, setGiftCardValidating] = useState(false)
  const [giftCardResult, setGiftCardResult] = useState<GiftCardValidateResponse | null>(null)
  const [giftCardError, setGiftCardError] = useState<string | null>(null)
  const [giftCardAppliedForTypeId, setGiftCardAppliedForTypeId] = useState<number | null>(null)

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

  const handleValidatePromo = async (membershipTypeId: number) => {
    const trimmed = promoCode.trim()
    if (!trimmed) return
    try {
      setPromoValidating(true)
      setPromoError(null)
      setPromoResult(null)
      const result = await promoCodesApi.validate(trimmed, membershipTypeId)
      setPromoResult(result)
      setPromoAppliedForTypeId(membershipTypeId)
    } catch (err) {
      const apiError = err as ApiError
      setPromoError(getErrorMessage(apiError.code))
      setPromoResult(null)
      setPromoAppliedForTypeId(null)
    } finally {
      setPromoValidating(false)
    }
  }

  const handleRemovePromo = () => {
    setPromoCode('')
    setPromoResult(null)
    setPromoError(null)
    setPromoAppliedForTypeId(null)
  }

  const handleValidateGiftCard = async (membershipTypeId: number) => {
    const trimmed = giftCardCode.trim()
    if (!trimmed) return
    try {
      setGiftCardValidating(true)
      setGiftCardError(null)
      setGiftCardResult(null)
      const result = await giftCardsApi.validate(trimmed)
      setGiftCardResult(result)
      setGiftCardAppliedForTypeId(membershipTypeId)
    } catch (err) {
      const apiError = err as ApiError
      setGiftCardError(getErrorMessage(apiError.code))
      setGiftCardResult(null)
      setGiftCardAppliedForTypeId(null)
    } finally {
      setGiftCardValidating(false)
    }
  }

  const handleRemoveGiftCard = () => {
    setGiftCardCode('')
    setGiftCardResult(null)
    setGiftCardError(null)
    setGiftCardAppliedForTypeId(null)
  }

  const handlePurchase = async (type: MembershipType) => {
    if (!user) return
    try {
      setLoadingId(type.id)
      const appliedPromoCode =
        promoResult && promoAppliedForTypeId === type.id ? promoCode.trim() : undefined
      const appliedGiftCardCode =
        giftCardResult && giftCardAppliedForTypeId === type.id ? giftCardCode.trim() : undefined

      const options: CreateCheckoutSessionOptions = {}
      if (appliedPromoCode) options.promoCode = appliedPromoCode
      if (appliedGiftCardCode) options.giftCardCode = appliedGiftCardCode
      const hasOptions = Object.keys(options).length > 0

      const result = hasOptions
        ? await billingApi.createCheckoutSession(user.id, type.id, options)
        : await billingApi.createCheckoutSession(user.id, type.id)

      if (result.already_completed) {
        Alert.alert(t('membership.purchaseComplete'))
        router.replace('/(tabs)/membership')
        return
      }

      if (result.checkout_url) {
        await Linking.openURL(result.checkout_url)
      }
    } catch (err) {
      Alert.alert('Error', (err as ApiError).message ?? 'Could not start purchase.')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <View style={styles.wrapper}>
      <Stack.Screen options={{ title: 'Membership Plans' }} />
      <OfflineBanner />
      <FlatList
        style={styles.container}
        data={activeTypes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.header}>Choose a Membership</Text>
        }
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
          const hasPromoForThis = promoResult && promoAppliedForTypeId === item.id
          const hasGiftCardForThis = giftCardResult && giftCardAppliedForTypeId === item.id
          return (
          <View style={styles.typeCard}>
            <View style={styles.typeHeader}>
              <View style={styles.typeNameRow}>
                <Text style={styles.typeName}>{item.name}</Text>
                {item.is_intro_offer && (
                  <View style={styles.introBadge}>
                    <Text style={styles.introBadgeText}>{t('membership.introOfferBadge')}</Text>
                  </View>
                )}
              </View>
              <View style={styles.typePriceContainer}>
                {hasIntroPrice && (
                  <Text style={styles.typePriceOriginal}>
                    {item.currency.toUpperCase()} {item.price.toFixed(2)}
                  </Text>
                )}
                <Text style={styles.typePrice}>
                  {item.currency.toUpperCase()} {displayPrice.toFixed(2)}
                </Text>
              </View>
            </View>
            <View style={styles.typeMeta}>
              <Text style={styles.typeMetaText}>
                {item.unlimited ? 'Unlimited classes' : `${item.credits_included ?? 0} credits`}
              </Text>
              <Text style={styles.typeMetaText}>{item.type}</Text>
            </View>

            {/* Promo Code Section */}
            <View style={styles.promoSection}>
              <Text style={styles.promoLabel}>{t('membership.promoCode')}</Text>
              <View style={styles.promoRow}>
                <TextInput
                  style={styles.promoInput}
                  placeholder={t('membership.promoCodePlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  value={promoCode}
                  onChangeText={(text) => {
                    setPromoCode(text)
                    if (promoResult || promoError) {
                      setPromoResult(null)
                      setPromoError(null)
                      setPromoAppliedForTypeId(null)
                    }
                  }}
                  autoCapitalize="characters"
                  editable={!promoValidating}
                />
                {hasPromoForThis ? (
                  <TouchableOpacity
                    style={styles.promoRemoveButton}
                    onPress={handleRemovePromo}
                  >
                    <Text style={styles.promoRemoveText}>{t('membership.removePromo')}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.promoApplyButton,
                      (!promoCode.trim() || promoValidating) && styles.promoApplyDisabled,
                    ]}
                    onPress={() => handleValidatePromo(item.id)}
                    disabled={!promoCode.trim() || promoValidating}
                  >
                    {promoValidating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.promoApplyText}>{t('membership.validatePromo')}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {promoError && promoAppliedForTypeId === null && (
                <Text style={styles.promoErrorText}>{promoError}</Text>
              )}

              {hasPromoForThis && (
                <View style={styles.discountBreakdown}>
                  <Text style={styles.promoSuccessText}>{t('membership.promoApplied')}</Text>
                  <View style={styles.discountRow}>
                    <Text style={styles.discountLabel}>{t('membership.originalPrice')}</Text>
                    <Text style={styles.discountValue}>
                      {item.currency.toUpperCase()} {promoResult.original_price.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.discountRow}>
                    <Text style={styles.discountLabel}>{t('membership.discount')}</Text>
                    <Text style={styles.discountValueGreen}>
                      -{item.currency.toUpperCase()} {promoResult.discount_amount.toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.discountRow, styles.discountRowFinal]}>
                    <Text style={styles.discountLabelFinal}>{t('membership.finalPrice')}</Text>
                    <Text style={styles.discountValueFinal}>
                      {item.currency.toUpperCase()} {promoResult.final_price.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Gift Card Section */}
            <View style={styles.promoSection}>
              <Text style={styles.promoLabel}>{t('membership.giftCardCode')}</Text>
              <View style={styles.promoRow}>
                <TextInput
                  style={styles.promoInput}
                  placeholder={t('membership.giftCardCodePlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  value={giftCardCode}
                  onChangeText={(text) => {
                    setGiftCardCode(text)
                    if (giftCardResult || giftCardError) {
                      setGiftCardResult(null)
                      setGiftCardError(null)
                      setGiftCardAppliedForTypeId(null)
                    }
                  }}
                  autoCapitalize="characters"
                  editable={!giftCardValidating}
                />
                {hasGiftCardForThis ? (
                  <TouchableOpacity
                    style={styles.promoRemoveButton}
                    onPress={handleRemoveGiftCard}
                  >
                    <Text style={styles.promoRemoveText}>{t('membership.removeGiftCard')}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.promoApplyButton,
                      (!giftCardCode.trim() || giftCardValidating) && styles.promoApplyDisabled,
                    ]}
                    onPress={() => handleValidateGiftCard(item.id)}
                    disabled={!giftCardCode.trim() || giftCardValidating}
                  >
                    {giftCardValidating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.promoApplyText}>{t('membership.validateGiftCard')}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {giftCardError && giftCardAppliedForTypeId === null && (
                <Text style={styles.promoErrorText}>{giftCardError}</Text>
              )}

              {hasGiftCardForThis && (
                <View style={styles.discountBreakdown}>
                  <Text style={styles.promoSuccessText}>{t('membership.giftCardApplied')}</Text>
                  <View style={styles.discountRow}>
                    <Text style={styles.discountLabel}>{t('membership.giftCardBalance')}</Text>
                    <Text style={styles.discountValue}>
                      {giftCardResult.currency.toUpperCase()}{' '}
                      {giftCardResult.remaining_balance.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}
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
  typeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  typeName: {
    fontSize: 18,
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
  typePriceContainer: {
    alignItems: 'flex-end',
  },
  typePriceOriginal: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  typePrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4F46E5',
  },
  typeMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  typeMetaText: {
    fontSize: 13,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  promoSection: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  promoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  promoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  promoApplyButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoApplyDisabled: {
    opacity: 0.5,
  },
  promoApplyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  promoRemoveButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoRemoveText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  promoErrorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  promoSuccessText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  discountBreakdown: {
    marginTop: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 12,
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  discountLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  discountValue: {
    fontSize: 13,
    color: '#374151',
  },
  discountValueGreen: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  discountRowFinal: {
    borderTopWidth: 1,
    borderTopColor: '#D1FAE5',
    paddingTop: 6,
    marginTop: 4,
    marginBottom: 0,
  },
  discountLabelFinal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  discountValueFinal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
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
