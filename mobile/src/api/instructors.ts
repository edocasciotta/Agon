import { apiClient, type ApiError } from './client'
import { useAuthStore } from '../store/authStore'
import type { Instructor } from '../types'

/** Minimal shape of a picked image asset needed to build the multipart upload body.
 * Matches the fields on `ImagePicker.ImagePickerAsset` we actually use, so this file
 * doesn't need to depend on `expo-image-picker`'s types. */
export interface PickedPhotoAsset {
  uri: string
  fileName?: string | null
  mimeType?: string | null
}

export interface InstructorPhotoUploadResponse {
  photo_url: string | null
}

export const instructorsApi = {
  list: async (): Promise<Instructor[]> => {
    const res = await apiClient.get('/api/v1/instructors')
    return res.data
  },
  get: async (id: number): Promise<Instructor> => {
    const res = await apiClient.get(`/api/v1/instructors/${id}`)
    return res.data
  },
  listAvailableForService: async (serviceId: number): Promise<Instructor[]> => {
    const res = await apiClient.get(
      `/api/v1/appointment-services/${serviceId}/available-instructors`
    )
    return res.data
  },
  /**
   * Resolves the authenticated instructor's own `Instructor` record.
   *
   * There is no `GET /api/v1/instructors/me` on the backend (verified against
   * `main` — the router only exposes list/get/create/update/photo/reactivate/
   * remove). We resolve "me" client-side instead: the auth store already holds
   * the caller's email (populated from `/auth/me` at login), and
   * `GET /instructors?search=` matches against `User.email` via ILIKE, so
   * searching by our own email returns exactly our own instructor row without
   * listing every instructor in the studio.
   */
  getMe: async (): Promise<Instructor> => {
    const email = useAuthStore.getState().user?.email
    if (!email) {
      const err: ApiError = { code: 'AUTH_TOKEN_INVALID', message: 'Not authenticated' }
      throw err
    }
    const res = await apiClient.get('/api/v1/instructors', { params: { search: email } })
    const list = res.data as Instructor[]
    const mine = list.find((i) => i.email.toLowerCase() === email.toLowerCase())
    if (!mine) {
      const err: ApiError = { code: 'NOT_FOUND', message: 'Instructor profile not found' }
      throw err
    }
    return mine
  },
  uploadPhoto: async (
    instructorId: number,
    asset: PickedPhotoAsset
  ): Promise<InstructorPhotoUploadResponse> => {
    const filename = asset.fileName ?? asset.uri.split('/').pop() ?? `photo_${Date.now()}.jpg`
    const mimeType = asset.mimeType ?? 'image/jpeg'

    // React Native's FormData accepts a { uri, name, type } object in place of a Blob
    // for file parts — this is the standard RN multipart-upload shape, not a real Blob.
    const formData = new FormData()
    formData.append('file', {
      uri: asset.uri,
      name: filename,
      type: mimeType,
    } as unknown as Blob)

    const res = await apiClient.post(`/api/v1/instructors/${instructorId}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}
