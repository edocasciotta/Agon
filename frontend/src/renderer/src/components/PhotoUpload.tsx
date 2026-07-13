import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthenticatedImage } from './AuthenticatedImage'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export type PhotoValidationError = 'invalidType' | 'tooLarge'

/** Client-side mirror of the backend's file validation, to give fast feedback before upload. */
export function validatePhotoFile(file: File): PhotoValidationError | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'invalidType'
  if (file.size > MAX_SIZE_BYTES) return 'tooLarge'
  return null
}

interface PhotoUploadProps {
  /** Current photo API path (e.g. `/api/v1/photos/xyz.jpg`), or null/undefined if none set. */
  photoUrl?: string | null
  /** Rendered when there is no photo yet (e.g. an initials avatar or a generic icon). */
  fallback: ReactNode
  /** Called with the selected file once it has passed client-side validation. */
  onUpload: (file: File) => void
  isUploading?: boolean
  /** Avatar diameter in pixels. */
  size?: number
  /** Unique id for the underlying file input. */
  inputId: string
  /** Accessible name for the whole photo display (used as the <img> alt / fallback aria context). */
  name: string
}

export function PhotoUpload({
  photoUrl,
  fallback,
  onUpload,
  isUploading = false,
  size = 40,
  inputId,
  name,
}: PhotoUploadProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset the input so selecting the same file again still fires onChange.
    e.target.value = ''
    if (!file) return

    const error = validatePhotoFile(file)
    if (error) {
      setValidationError(t(`photoUpload.${error}`))
      return
    }
    setValidationError(null)
    onUpload(file)
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        {photoUrl ? (
          <AuthenticatedImage
            src={photoUrl}
            alt={t('photoUpload.altText', { name })}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          fallback
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          aria-label={t('photoUpload.changePhoto')}
          title={t('photoUpload.changePhoto')}
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
          aria-label={t('photoUpload.changePhoto')}
        />
      </div>
      {isUploading && <p className="text-xs text-gray-400">{t('photoUpload.uploading')}</p>}
      {validationError && <p className="text-xs text-red-500">{validationError}</p>}
    </div>
  )
}
