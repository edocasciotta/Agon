import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as SecureStore from 'expo-secure-store'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { Pencil } from 'lucide-react-native'
import {
  instructorsApi,
  type InstructorPhotoUploadResponse,
} from '../../src/api/instructors'
import { useAuthStore } from '../../src/store/authStore'
import { useStudioStore } from '../../src/store/studioStore'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { LoadingView } from '../../src/components/LoadingView'
import { ErrorView } from '../../src/components/ErrorView'
import { useT } from '../../src/i18n'
import { getErrorMessage } from '../../src/lib/errorMessages'
import { TOKEN_KEY, type ApiError } from '../../src/api/client'
import { useTheme } from '../../src/theme/ThemeContext'
import type { Instructor } from '../../src/types'

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024

export default function InstructorProfileScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const studioUrl = useStudioStore((s) => s.studioUrl)
  const t = useT()
  const { primary } = useTheme()
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Needed to attach the JWT as a header when displaying the (auth-protected) photo —
  // see `<Image source={{ uri, headers }} />` below.
  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY).then(setAuthToken)
  }, [])

  const {
    data: instructor,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['instructor-me'],
    queryFn: instructorsApi.getMe,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const uploadPhotoMutation = useMutation({
    mutationFn: (asset: ImagePicker.ImagePickerAsset) =>
      instructorsApi.uploadPhoto(instructor!.id, asset),
    onSuccess: (updated: InstructorPhotoUploadResponse) => {
      setPhotoError(null)
      queryClient.setQueryData(['instructor-me'], (prev: Instructor | undefined) =>
        prev ? { ...prev, photo_url: updated.photo_url } : prev
      )
    },
    onError: (err: ApiError) => {
      setPhotoError(getErrorMessage(err.code ?? 'SERVER_ERROR'))
    },
  })

  const handlePickPhoto = async () => {
    if (!instructor || uploadPhotoMutation.isPending) return
    setPhotoError(null)

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setPhotoError(t('profile.photoPermissionDenied'))
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    })
    if (result.canceled || result.assets.length === 0) return

    const asset = result.assets[0]
    if (asset.fileSize && asset.fileSize > MAX_PHOTO_SIZE_BYTES) {
      setPhotoError(t('profile.photoTooLarge'))
      return
    }

    uploadPhotoMutation.mutate(asset)
  }

  const handleSignOut = async () => {
    await useAuthStore.getState().logout()
    router.replace('/onboarding/login')
  }

  if (isLoading) return <LoadingView message={t('instructor.loading')} />
  if (error) return <ErrorView code={(error as unknown as ApiError).code} />
  if (!instructor) return <ErrorView message={t('instructor.notFound')} />

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <OfflineBanner />
      <View style={styles.avatarSection}>
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={handlePickPhoto}
          disabled={uploadPhotoMutation.isPending}
          accessibilityLabel={t('profile.changePhoto')}
        >
          {instructor.photo_url && studioUrl && authToken ? (
            <Image
              source={{
                uri: `${studioUrl}${instructor.photo_url}`,
                headers: { Authorization: `Bearer ${authToken}` },
              }}
              style={styles.avatarImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: primary }]}>
              <Text style={styles.avatarText}>
                {instructor.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          {uploadPhotoMutation.isPending ? (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : (
            <View style={[styles.editBadge, { backgroundColor: primary }]}>
              <Pencil size={14} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.name}>{instructor.full_name}</Text>
        <Text style={styles.email}>{instructor.email}</Text>
        {photoError && <Text style={styles.photoErrorText}>{photoError}</Text>}
      </View>

      {instructor.bio && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('instructor.bio')}</Text>
          <Text style={styles.bioText}>{instructor.bio}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.account')}</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={handleSignOut}>
          <Text style={styles.dangerButtonText}>{t('profile.signOut')}</Text>
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
  avatarWrapper: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F9FAFB',
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
  bioText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  dangerButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
  },
  dangerButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  photoErrorText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 8,
  },
})
