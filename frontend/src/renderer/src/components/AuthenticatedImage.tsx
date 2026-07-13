import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'

interface AuthenticatedImageProps {
  /** API path (relative to apiClient's baseURL), e.g. `/api/v1/photos/xyz.jpg`. */
  src: string
  alt: string
  className?: string
}

/**
 * Renders an <img> for a backend resource that requires the manager's JWT to fetch.
 * A plain <img src="..."> can't carry an Authorization header, so this fetches the
 * image as a blob via the authenticated apiClient and renders it through an object URL.
 * The object URL is revoked on unmount / when `src` changes to avoid leaking memory.
 */
export function AuthenticatedImage({ src, alt, className }: AuthenticatedImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let createdUrl: string | null = null

    setObjectUrl(null)

    apiClient
      .get(src, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return
        createdUrl = URL.createObjectURL(res.data as Blob)
        setObjectUrl(createdUrl)
      })
      .catch(() => {
        if (!cancelled) setObjectUrl(null)
      })

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [src])

  if (!objectUrl) return null

  return <img src={objectUrl} alt={alt} className={className} />
}
