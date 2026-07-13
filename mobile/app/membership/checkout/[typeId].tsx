import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  TextInput,
} from 'react-native'
import { useState } from 'react'
import { Stack, useRouter, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import {
  membershipTypesApi,
  billingApi,
  promoCodesApi,
  giftCardsApi,
  type CreateCheckoutSessionOptions,
} from '../../../src/api/memberships'
import { LoadingView } from '../../../src/components/LoadingView'
import { ErrorView } from '../../../src/components/ErrorView'
import { OfflineBanner } from '../../../src/components/OfflineBanner'
import { useAuthStore } from '../../../src/store/authStore'
import { useT } from '../../../src/i18n'
import { getErrorMessage } from '../../../src/lib/errorMessages'
import type { MembershipType, PromoCodeValidateResponse, GiftCardValidateResponse } from '../../../src/types'
import type { ApiError } from '../../../src/api/client'
import { useTheme } from '../../../src/theme/ThemeContext'

export default function MembershipCheckoutScreen() {
  const { typeId } = useLocalSearchParams<{ typeId: string }>()
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const t = useT()
  const { primary } = useTheme()

  const [purchasing, setPurchasing] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoValidating, setPromoValidating] = useState(false)
  const [promoResult, setPromoResult] = useState<PromoCodeValidateResponse | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [giftCardCode, setGiftCardCode] = useState('')
  const [giftCardValidating, setGiftCardValidating] = useState(false)
  const [giftCardResult, setGiftCardResult] = useState<GiftCardValidateResponse | null>(null)
  const [giftCardError, setGiftCardError] = useState<string | null>(null)

  const numericTypeId = Number(typeId)

  const { data: types, isLoading, error } = useQuery({
    queryKey: ['membership-types'],
    queryFn: membershipTypesApi.list,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const membershipType = types?.find((mt: MembershipType) => mt.id === numericTypeId)

  const handleValidatePromo = async () => {
    const trimmed = promoCode.trim()
    if (!trimmed || !membershipType) return
    try {
      setPromoValidating(true)
      setPromoError(null)
      setPromoResult(null)
      const result = await promoCodesApi.validate(trimmed, membershipType.id)
      setPromoResult(result)
    } catch (err) {
      const apiError = err as ApiError
      setPromoError(getErrorMessage(apiError.code))
      setPromoResult(null)
    } finally {
      setPromoValidating(false)
    }
  }

  const handleRemovePromo = () => {
    setPromoCode('')
    setPromoResult(null)
    setPromoError(null)
  }

  const handleValidateGiftCard = async () => {
    const trimmed = giftCardCode.trim()
    if (!trimmed) return
    try {
      setGiftCardValidating(true)
      setGiftCardError(null)
      setGiftCardResult(null)
      const result = await giftCardsApi.validate(trimmed)
      setGiftCardResult(result)
    } catch (err) {
      const apiError = err as ApiError
      setGiftCardError(getErrorMessage(apiError.code))
      setGiftCardResult(null)
    } finally {
      setGiftCardValidating(false)
    }
  }

  const handleRemoveGiftCard = () => {
    setGiftCardCode('')
    setGiftCardResult(null)
    setGiftCardError(null)
  }

  const handlePurchase = async () => {
    if (!user || !membershipType) return
    try {
      setPurchasing(true)
      const appliedPromoCode = promoResult ? promoCode.trim() : undefined
      const appliedGiftCardCode = giftCardResult ? giftCardCode.trim() : undefined

      const options: CreateCheckoutSessionOptions = {}
      if (appliedPromoCode) options.promoCode = appliedPromoCode
      if (appliedGiftCardCode) options.giftCardCode = appliedGiftCardCode
      const hasOptions = Object.keys(options).length > 0

      const result = hasOptions
        ? await billingApi.createCheckoutSession(user.id, membershipType.id, options)
        : await billingApi.createCheckoutSession(user.id, membershipType.id)

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
      setPurchasing(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t('membership.checkout') }} />
        <LoadingView message="Loading membership options..." />
      </>
    )
  }
  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: t('membership.checkout') }} />
        <ErrorView code={(error as unknown as ApiError).code} />
      </>
    )
  }
  if (!membershipType) {
    return (
      <>
        <Stack.Screen options={{ title: t('membership.checkout') }} />
        <ErrorView message={t('membership.typeNotFound')} />
      </>
    )
  }

  const hasIntroPrice = membershipType.is_intro_offer && membershipType.intro_price != null
  const displayPrice = hasIntroPrice ? membershipType.intro_price! : membershipType.price

  return (
    <View style={styles.wrapper}>
      <Stack.Screen options={{ title: membershipType.name }} />
      <OfflineBanner />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.typeCard}>
          <View style={styles.typeHeader}>
            <View style={styles.typeNameRow}>
              <Text style={styles.typeName}>{membershipType.name}</Text>
              {membershipType.is_intro_offer && (
                <View style={styles.introBadge}>
                  <Text style={styles.introBadgeText}>{t('membership.introOfferBadge')}</Text>
                </View>
              )}
            </View>
            <View style={styles.typePriceContainer}>
              {hasIntroPrice && (
                <Text style={styles.typePriceOriginal}>
                  {membershipType.currency.toUpperCase()} {membershipType.price.toFixed(2)}
                </Text>
              )}
              <Text style={[styles.typePrice, { color: primary }]}>
                {membershipType.currency.toUpperCase()} {displayPrice.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.typeMeta}>
            <Text style={styles.typeMetaText}>
              {membershipType.unlimited
                ? 'Unlimited classes'
                : `${membershipType.credits_included ?? 0} credits`}
            </Text>
            <Text style={styles.typeMetaText}>{membershipType.type}</Text>
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
                  }
                }}
                autoCapitalize="characters"
                editable={!promoValidating}
              />
              {promoResult ? (
                <TouchableOpacity style={styles.promoRemoveButton} onPress={handleRemovePromo}>
                  <Text style={styles.promoRemoveText}>{t('membership.removePromo')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.promoApplyButton,
                    { backgroundColor: primary },
                    (!promoCode.trim() || promoValidating) && styles.promoApplyDisabled,
                  ]}
                  onPress={handleValidatePromo}
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

            {promoError && !promoResult && <Text style={styles.promoErrorText}>{promoError}</Text>}

            {promoResult && (
              <View style={styles.discountBreakdown}>
                <Text style={styles.promoSuccessText}>{t('membership.promoApplied')}</Text>
                <View style={styles.discountRow}>
                  <Text style={styles.discountLabel}>{t('membership.originalPrice')}</Text>
                  <Text style={styles.discountValue}>
                    {membershipType.currency.toUpperCase()} {promoResult.original_price.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.discountRow}>
                  <Text style={styles.discountLabel}>{t('membership.discount')}</Text>
                  <Text style={styles.discountValueGreen}>
                    -{membershipType.currency.toUpperCase()} {promoResult.discount_amount.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.discountRow, styles.discountRowFinal]}>
                  <Text style={styles.discountLabelFinal}>{t('membership.finalPrice')}</Text>
                  <Text style={styles.discountValueFinal}>
                    {membershipType.currency.toUpperCase()} {promoResult.final_price.toFixed(2)}
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
                  }
                }}
                autoCapitalize="characters"
                editable={!giftCardValidating}
              />
              {giftCardResult ? (
                <TouchableOpacity style={styles.promoRemoveButton} onPress={handleRemoveGiftCard}>
                  <Text style={styles.promoRemoveText}>{t('membership.removeGiftCard')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.promoApplyButton,
                    { backgroundColor: primary },
                    (!giftCardCode.trim() || giftCardValidating) && styles.promoApplyDisabled,
                  ]}
                  onPress={handleValidateGiftCard}
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

            {giftCardError && !giftCardResult && (
              <Text style={styles.promoErrorText}>{giftCardError}</Text>
            )}

            {giftCardResult && (
              <View style={styles.discountBreakdown}>
                <Text style={styles.promoSuccessText}>{t('membership.giftCardApplied')}</Text>
                <View style={styles.discountRow}>
                  <Text style={styles.discountLabel}>{t('membership.giftCardBalance')}</Text>
                  <Text style={styles.discountValue}>
                    {giftCardResult.currency.toUpperCase()} {giftCardResult.remaining_balance.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.purchaseButton,
              { backgroundColor: primary },
              purchasing && styles.purchaseButtonDisabled,
            ]}
            onPress={handlePurchase}
            disabled={purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.purchaseButtonText}>Purchase</Text>
            )}
          </TouchableOpacity>
        </View>
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
