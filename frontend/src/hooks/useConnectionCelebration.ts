import { useEffect, useRef } from 'react'
import type { Config } from '@/lib/api'
import { celebrateConnection } from '@/lib/celebrate'

/**
 * Fires a one-time confetti burst when Gmail flips from disconnected to
 * connected while the app is open (e.g. after connecting in Settings).
 */
export function useConnectionCelebration(config?: Config) {
  const previous = useRef<boolean | null>(null)

  useEffect(() => {
    if (!config) return
    const connected = Boolean(config.gmail_connected)

    if (previous.current === false && connected) {
      const key = `context:gmail-celebrated:${config.gmail_email ?? 'unknown'}`
      try {
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1')
          celebrateConnection()
        }
      } catch {
        celebrateConnection()
      }
    }

    previous.current = connected
  }, [config])
}
