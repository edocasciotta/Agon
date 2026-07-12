import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'
import { useQuery } from '@tanstack/react-query'
import { studioApi } from '../api/studio'
import { darken, lighten, isValidHexColor } from '../lib/color'

// Fallback brand color — the indigo the app has always shipped with. Used whenever a
// studio hasn't set a custom color, the branding fetch fails, or we're offline with no
// cached color yet.
export const DEFAULT_PRIMARY = '#4F46E5'

// Not sensitive data (a hex string), but SecureStore is already the codebase's proven
// persistence mechanism (see STUDIO_NAME_KEY) and avoids pulling in a new dependency
// (AsyncStorage / RQ persister) just for this. Cache survives app restarts so a device
// that goes offline after fetching real branding doesn't flash back to default indigo.
const CACHED_PRIMARY_KEY = 'agon_cached_primary_color'
const CACHED_SECONDARY_KEY = 'agon_cached_secondary_color'

export interface Theme {
  primary: string
  primaryDark: string
  primaryLight: string
  secondary: string | null
}

const defaultTheme: Theme = {
  primary: DEFAULT_PRIMARY,
  primaryDark: darken(DEFAULT_PRIMARY),
  primaryLight: lighten(DEFAULT_PRIMARY),
  secondary: null,
}

function buildTheme(primary: string | null, secondary: string | null): Theme {
  if (!isValidHexColor(primary)) return defaultTheme
  return {
    primary,
    primaryDark: darken(primary),
    primaryLight: lighten(primary),
    secondary: isValidHexColor(secondary) ? secondary : null,
  }
}

const ThemeContext = createContext<Theme>(defaultTheme)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Last-known-good colors restored from SecureStore on cold start so an offline
  // launch (after previously fetching real branding) shows the studio's colors
  // immediately instead of flashing default indigo while the query resolves.
  const [cached, setCached] = useState<{ primary: string | null; secondary: string | null }>({
    primary: null,
    secondary: null,
  })

  useEffect(() => {
    let mounted = true
    Promise.all([
      SecureStore.getItemAsync(CACHED_PRIMARY_KEY),
      SecureStore.getItemAsync(CACHED_SECONDARY_KEY),
    ]).then(([primary, secondary]) => {
      if (mounted) setCached({ primary, secondary })
    })
    return () => {
      mounted = false
    }
  }, [])

  // Public, unauthenticated endpoint — works pre-login same as the desktop app.
  const { data, isError } = useQuery({
    queryKey: ['studio-branding'],
    queryFn: studioApi.getBranding,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  useEffect(() => {
    if (data?.primary_color && isValidHexColor(data.primary_color)) {
      SecureStore.setItemAsync(CACHED_PRIMARY_KEY, data.primary_color)
    }
    if (data?.secondary_color && isValidHexColor(data.secondary_color)) {
      SecureStore.setItemAsync(CACHED_SECONDARY_KEY, data.secondary_color)
    }
  }, [data])

  const theme = useMemo<Theme>(() => {
    // Fresh fetch succeeded and returned a color — use it (source of truth).
    if (data?.primary_color) {
      return buildTheme(data.primary_color, data.secondary_color)
    }
    // Fetch failed/offline or hasn't resolved yet, but we have a previously cached
    // color from a successful fetch — keep showing it instead of reverting to indigo.
    if ((isError || !data) && cached.primary) {
      return buildTheme(cached.primary, cached.secondary)
    }
    // No fetched color, no cache (e.g. studio never set a custom color, or first-ever
    // launch while offline) — fall back to the default hardcoded indigo.
    return defaultTheme
  }, [data, isError, cached])

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  return useContext(ThemeContext)
}
