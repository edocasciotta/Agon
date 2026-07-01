import { useEffect, useRef } from 'react'
import * as SecureStore from 'expo-secure-store'
import { STUDIO_URL_KEY } from '../api/client'
import { useConnectivityStore } from '../store/connectivityStore'

const POLL_INTERVAL_MS = 30_000
const HEALTH_PATH = '/health'
const TIMEOUT_MS = 5_000

async function pingStudio(): Promise<boolean> {
  try {
    const base = (await SecureStore.getItemAsync(STUDIO_URL_KEY)) ?? 'http://localhost:8000'
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(`${base}${HEALTH_PATH}`, { signal: controller.signal })
    clearTimeout(id)
    return res.ok
  } catch {
    return false
  }
}

export function useNetworkStatus() {
  const { isOnline, setOnline } = useConnectivityStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let mounted = true

    async function check() {
      const reachable = await pingStudio()
      if (mounted) setOnline(reachable)
    }

    check()
    intervalRef.current = setInterval(check, POLL_INTERVAL_MS)

    return () => {
      mounted = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [setOnline])

  return isOnline
}
