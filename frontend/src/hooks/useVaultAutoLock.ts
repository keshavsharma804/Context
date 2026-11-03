import { useEffect, useState, useRef } from 'react'
import { useVault } from '@/store/vault'
import { useSound } from '@/hooks/useSound'

export const AUTO_LOCK_MS = 5 * 60 * 1000 // 5 minutes

export function useVaultAutoLock() {
  const { unlocked, lock, lastActivity, touch } = useVault()
  const [secondsRemaining, setSecondsRemaining] = useState(300)
  const playSwoosh = useSound('swoosh')
  const playSwooshRef = useRef(playSwoosh)
  playSwooshRef.current = playSwoosh

  useEffect(() => {
    if (!unlocked) {
      setSecondsRemaining(300)
      return
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivity
      const remaining = Math.max(0, Math.ceil((AUTO_LOCK_MS - elapsed) / 1000))
      setSecondsRemaining(remaining)

      if (elapsed >= AUTO_LOCK_MS) {
        playSwooshRef.current()
        lock()
      }
    }, 1000)

    const handleActivity = () => touch()
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true })
    )

    let hideTimeout: number | null = null
    const handleVisibility = () => {
      if (document.hidden) {
        hideTimeout = window.setTimeout(() => {
          if (document.hidden) {
            playSwooshRef.current()
            lock()
          }
        }, 60000) // lock if hidden >1 min
      } else {
        if (hideTimeout) {
          clearTimeout(hideTimeout)
          hideTimeout = null
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      if (hideTimeout) clearTimeout(hideTimeout)
      events.forEach((evt) =>
        window.removeEventListener(evt, handleActivity)
      )
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [unlocked, lock, lastActivity, touch])

  const minutes = Math.floor(secondsRemaining / 60)
  const seconds = secondsRemaining % 60
  const formattedTime = `${minutes}:${String(seconds).padStart(2, '0')}`

  return {
    secondsRemaining,
    formattedTime,
    isExpiringSoon: secondsRemaining <= 60,
  }
}
