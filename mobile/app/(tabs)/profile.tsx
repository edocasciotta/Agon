import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../src/store/authStore'
import { useStudioStore } from '../../src/store/studioStore'
import { tagsApi } from '../../src/api/tags'
import { calendarSyncApi } from '../../src/api/calendarSync'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { useT } from '../../src/i18n'
import * as Notifications from 'expo-notifications'
import * as Clipboard from 'expo-clipboard'
import { useState, useEffect } from 'react'
import type { ClientTag } from '../../src/types'
import type { ApiError } from '../../src/api/client'
import { useTheme } from '../../src/theme/ThemeContext'

export default function ProfileScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const t = useT()
  const { primary } = useTheme()
  const [notifStatus, setNotifStatus] = useState<string>('unknown')
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => setNotifStatus(status))
  }, [])

  const { data: tags, isLoading: tagsLoading } = useQuery({
    queryKey: ['client-tags', user?.id],
    queryFn: () => tagsApi.getClientTags(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const {
    data: calendarSync,
    isLoading: calendarSyncLoading,
    error: calendarSyncError,
  } = useQuery({
    queryKey: ['calendar-sync', user?.id],
    queryFn: () => calendarSyncApi.get(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const regenerateMutation = useMutation({
    mutationFn: () => calendarSyncApi.regenerate(user!.id),
    onSuccess: (data) => {
      queryClient.setQueryData(['calendar-sync', user?.id], data)
    },
    onError: (err: ApiError) => {
      Alert.alert(t('calendarSync.failedRegenerate'), err.message)
    },
  })

  const handleAddToCalendar = () => {
    if (!calendarSync) return
    // webcal:// is the standard cross-platform convention for "subscribe to
    // this calendar feed" — both iOS and Android calendar apps register as
    // handlers for it, triggering the native subscribe flow instead of a
    // one-time download. The backend correctly returns https:// (also a
    // valid, directly-fetchable URL) — this swap is a client-side UX choice.
    const webcalUrl = calendarSync.feed_url.replace(/^https?:\/\//, 'webcal://')
    Linking.openURL(webcalUrl)
  }

  const handleCopyLink = async () => {
    if (!calendarSync) return
    await Clipboard.setStringAsync(calendarSync.feed_url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleRegenerate = () => {
    Alert.alert(
      t('calendarSync.regenerateConfirmTitle'),
      t('calendarSync.regenerateConfirmMessage'),
      [
        { text: t('calendarSync.regenerateConfirmCancel'), style: 'cancel' },
        {
          text: t('calendarSync.regenerateConfirmConfirm'),
          onPress: () => regenerateMutation.mutate(),
        },
      ]
    )
  }

  const handleDisconnect = async () => {
    await useStudioStore.getState().clearStudio()
    router.replace('/onboarding/scan')
  }

  const handleSignOut = async () => {
    await useAuthStore.getState().logout()
    router.replace('/onboarding/login')
  }

  const handleToggleNotifications = async () => {
    if (notifStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      setNotifStatus(status)
    }
  }

  /**
   * Picks a contrasting text color (black or white) for the given hex background.
   */
  function getContrastColor(hex: string): string {
    const clean = hex.replace('#', '')
    const r = parseInt(clean.substring(0, 2), 16)
    const g = parseInt(clean.substring(2, 4), 16)
    const b = parseInt(clean.substring(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#111827' : '#FFFFFF'
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <OfflineBanner />
      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: primary }]}>
          <Text style={styles.avatarText}>
            {user?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.full_name ?? '—'}</Text>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>
      </View>

      {/* Tags Section */}
      {tagsLoading ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.tags')}</Text>
          <ActivityIndicator size="small" color={primary} />
        </View>
      ) : tags && tags.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.tags')}</Text>
          <View style={styles.tagsContainer}>
            {tags.map((tag: ClientTag) => (
              <View
                key={tag.id}
                style={[styles.tagBadge, { backgroundColor: tag.tag_color }]}
              >
                <Text style={[styles.tagText, { color: getContrastColor(tag.tag_color) }]}>
                  {tag.tag_name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Calendar Sync Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('calendarSync.title')}</Text>
        {calendarSyncLoading ? (
          <ActivityIndicator size="small" color={primary} />
        ) : calendarSyncError ? (
          <Text style={styles.errorText}>{t('calendarSync.failedLoad')}</Text>
        ) : calendarSync ? (
          <>
            <Text style={styles.sectionDescription}>{t('calendarSync.description')}</Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: primary }]} onPress={handleAddToCalendar}>
              <Text style={styles.primaryButtonText}>{t('calendarSync.addToCalendar')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, { borderColor: primary }]} onPress={handleCopyLink}>
              <Text style={[styles.secondaryButtonText, { color: primary }]}>
                {linkCopied ? t('calendarSync.linkCopied') : t('calendarSync.copyLink')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.regenerateLink}
              onPress={handleRegenerate}
              disabled={regenerateMutation.isPending}
            >
              {regenerateMutation.isPending ? (
                <ActivityIndicator size="small" color="#6B7280" />
              ) : (
                <Text style={styles.regenerateLinkText}>{t('calendarSync.regenerate')}</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.notifications')}</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('profile.pushNotifications')}</Text>
          <View style={styles.rowRight}>
            <Text style={[
              styles.notifStatus,
              { color: notifStatus === 'granted' ? '#059669' : '#DC2626' }
            ]}>
              {notifStatus === 'granted' ? t('profile.enabled') : t('profile.disabled')}
            </Text>
            {notifStatus !== 'granted' && (
              <TouchableOpacity onPress={handleToggleNotifications} style={[styles.enableButton, { backgroundColor: primary }]}>
                <Text style={styles.enableButtonText}>{t('profile.enable')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.account')}</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={handleSignOut}>
          <Text style={styles.dangerButtonText}>{t('profile.signOut')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dangerButton, styles.disconnectButton]} onPress={handleDisconnect}>
          <Text style={[styles.dangerButtonText, styles.disconnectText]}>{t('profile.disconnectStudio')}</Text>
        </TouchableOpacity>
      </View>
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 16,
    color: '#111827',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  enableButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  enableButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  dangerButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    marginBottom: 8,
  },
  dangerButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  disconnectButton: {
    backgroundColor: '#FEF3C7',
    marginBottom: 0,
  },
  disconnectText: {
    color: '#92400E',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 14,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4F46E5',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: '600',
  },
  regenerateLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  regenerateLinkText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
})
