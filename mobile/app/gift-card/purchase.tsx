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
import { Stack } from 'expo-router'
import { giftCardsApi } from '../../src/api/memberships'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { useT } from '../../src/i18n'
import type { ApiError } from '../../src/api/client'

export default function GiftCardPurchaseScreen() {
  const t = useT()
  const [amount, setAmount] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [message, setMessage] = useState('')
  const [purchasing, setPurchasing] = useState(false)

  const parsedAmount = Number(amount)
  const isAmountValid = amount.trim().length > 0 && !Number.isNaN(parsedAmount) && parsedAmount > 0

  const handlePurchase = async () => {
    if (!isAmountValid) return
    try {
      setPurchasing(true)
      const successUrl = 'agon://membership?status=success'
      const cancelUrl = 'agon://gift-card/purchase'
      const { checkout_url } = await giftCardsApi.purchase({
        amount: parsedAmount,
        ...(recipientName.trim() ? { recipient_name: recipientName.trim() } : {}),
        ...(recipientEmail.trim() ? { recipient_email: recipientEmail.trim() } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
        success_url: successUrl,
        cancel_url: cancelUrl,
      })
      await Linking.openURL(checkout_url)
    } catch (err) {
      Alert.alert('Error', (err as ApiError).message ?? 'Could not start purchase.')
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <View style={styles.wrapper}>
      <Stack.Screen options={{ title: t('giftCard.purchaseTitle') }} />
      <OfflineBanner />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.header}>{t('giftCard.purchaseTitle')}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>{t('giftCard.amount')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('giftCard.amountPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            editable={!purchasing}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('giftCard.recipientName')}</Text>
          <TextInput
            style={styles.input}
            value={recipientName}
            onChangeText={setRecipientName}
            editable={!purchasing}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('giftCard.recipientEmail')}</Text>
          <TextInput
            style={styles.input}
            value={recipientEmail}
            onChangeText={setRecipientEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!purchasing}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('giftCard.message')}</Text>
          <TextInput
            style={[styles.input, styles.messageInput]}
            placeholder={t('giftCard.messagePlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            editable={!purchasing}
          />
        </View>

        <TouchableOpacity
          style={[styles.purchaseButton, (!isAmountValid || purchasing) && styles.purchaseButtonDisabled]}
          onPress={handlePurchase}
          disabled={!isAmountValid || purchasing}
        >
          {purchasing ? (
            <View style={styles.purchasingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.purchaseButtonText}>{t('giftCard.purchasing')}</Text>
            </View>
          ) : (
            <Text style={styles.purchaseButtonText}>{t('giftCard.purchase')}</Text>
          )}
        </TouchableOpacity>
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
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
  },
  messageInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  purchaseButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  purchasingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
})
