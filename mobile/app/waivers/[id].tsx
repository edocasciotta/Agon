import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { CheckSquare, Square, CheckCircle2 } from 'lucide-react-native'
import { format, parseISO } from 'date-fns'
import { waiversApi } from '../../src/api/waivers'
import { useAuthStore } from '../../src/store/authStore'
import { useConnectivityStore } from '../../src/store/connectivityStore'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import { useT } from '../../src/i18n'
import { useTheme } from '../../src/theme/ThemeContext'
import { getErrorMessage } from '../../src/lib/errorMessages'
import type { ApiError } from '../../src/api/client'

export default function WaiverDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const waiverId = Number(id)
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { primary } = useTheme()
  const user = useAuthStore((s) => s.user)
  const { isOnline } = useConnectivityStore()

  const [signedName, setSignedName] = useState('')
  const [consent, setConsent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const { data: waivers, isLoading, error } = useQuery({
    queryKey: ['client-waivers', user?.id],
    queryFn: () => waiversApi.listForClient(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const waiver = waivers?.find((w) => w.id === waiverId)

  const signMutation = useMutation({
    mutationFn: () => waiversApi.sign(waiverId, signedName.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-waivers', user?.id] })
      setSuccess(true)
      setTimeout(() => router.back(), 1500)
    },
    onError: (err: ApiError) => {
      setFormError(err.message || getErrorMessage(err.code ?? 'SERVER_ERROR'))
    },
  })

  const handleSubmit = () => {
    setFormError(null)
    if (signedName.trim().length < 2) {
      setFormError(t('waivers.nameTooShort'))
      return
    }
    if (!consent) {
      setFormError(t('waivers.consentRequired'))
      return
    }
    signMutation.mutate()
  }

  if (isLoading) return <LoadingView message={t('waivers.loading')} />
  if (error) return <ErrorView code={(error as unknown as ApiError).code} />
  if (!waiver) return <ErrorView message={t('waivers.notFound')} />

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('waivers.detailTitle') }} />
      <OfflineBanner />

      <Text style={styles.title}>{waiver.title}</Text>
      <View style={styles.bodyCard}>
        <Text style={styles.bodyText}>{waiver.body}</Text>
      </View>

      {waiver.is_signed ? (
        <View style={styles.signedBanner}>
          <CheckCircle2 size={20} color="#059669" />
          <Text style={styles.signedBannerText}>
            {waiver.signed_at
              ? `${t('waivers.alreadySigned')} (${format(parseISO(waiver.signed_at), 'MMM d, yyyy')})`
              : t('waivers.alreadySigned')}
          </Text>
        </View>
      ) : success ? (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{t('waivers.signSuccess')}</Text>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>{t('waivers.nameLabel')}</Text>
          <TextInput
            style={styles.input}
            value={signedName}
            onChangeText={setSignedName}
            placeholder={t('waivers.namePlaceholder')}
            placeholderTextColor="#9CA3AF"
            editable={!signMutation.isPending}
            accessibilityLabel={t('waivers.nameLabel')}
          />

          <TouchableOpacity
            style={styles.consentRow}
            onPress={() => setConsent((c) => !c)}
            disabled={signMutation.isPending}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
          >
            {consent ? (
              <CheckSquare size={22} color={primary} />
            ) : (
              <Square size={22} color="#9CA3AF" />
            )}
            <Text style={styles.consentText}>{t('waivers.consentLabel')}</Text>
          </TouchableOpacity>

          {formError && <Text style={styles.errorText}>{formError}</Text>}

          {!isOnline && (
            <Text style={styles.offlineText}>{t('waivers.offlineCannotSign')}</Text>
          )}

          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: primary },
              (!isOnline || signMutation.isPending) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isOnline || signMutation.isPending}
          >
            {signMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {signMutation.isPending ? t('waivers.submitting') : t('waivers.submit')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  bodyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#374151',
  },
  signedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    padding: 16,
  },
  signedBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
    flex: 1,
  },
  successBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  successText: {
    color: '#065F46',
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  consentText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
    lineHeight: 19,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    marginBottom: 12,
  },
  offlineText: {
    fontSize: 13,
    color: '#92400E',
    marginBottom: 12,
  },
  submitButton: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
})
