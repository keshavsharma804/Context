import { useEffect, useState, useCallback } from 'react'
import { useUIStore, type AutoThemeDayMapping } from '@/store/ui'
import { applyTheme, getCurrentTheme } from '@/lib/themes'

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'

export function getDayPhase(date = new Date()): DayPhase {
  const hour = date.getHours()
  if (hour >= 5 && hour < 9) return 'dawn'
  if (hour >= 9 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'dusk'
  return 'night'
}

export function getNextPhaseTime(date = new Date()): { nextPhase: DayPhase; nextTime: Date } {
  const hour = date.getHours()
  const next = new Date(date)
  next.setMinutes(0, 0, 0)

  if (hour < 5) {
    next.setHours(5)
    return { nextPhase: 'dawn', nextTime: next }
  }
  if (hour < 9) {
    next.setHours(9)
    return { nextPhase: 'day', nextTime: next }
  }
  if (hour < 17) {
    next.setHours(17)
    return { nextPhase: 'dusk', nextTime: next }
  }
  if (hour < 20) {
    next.setHours(20)
    return { nextPhase: 'night', nextTime: next }
  }
  // past 20:00 -> next is dawn tomorrow at 5:00
  next.setDate(next.getDate() + 1)
  next.setHours(5)
  return { nextPhase: 'dawn', nextTime: next }
}

export function useAutoThemeScheduler() {
  const {
    autoThemeEnabled,
    autoThemeMode,
    autoThemeIntervalMinutes,
    autoThemePool,
    autoThemeDayMapping,
    lastThemeChangeTimestamp,
    setLastThemeChangeTimestamp,
  } = useUIStore()

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const elapsed = Math.floor((Date.now() - lastThemeChangeTimestamp) / 1000)
    const total = autoThemeIntervalMinutes * 60
    return Math.max(0, total - elapsed)
  })

  const [currentPhase, setCurrentPhase] = useState<DayPhase>(() => getDayPhase())

  const rotateToNext = useCallback(() => {
    if (autoThemeMode === 'time-of-day') {
      const phase = getDayPhase()
      const targetTheme = autoThemeDayMapping[phase]
      if (targetTheme && targetTheme !== getCurrentTheme()) {
        applyTheme(targetTheme)
      }
      setLastThemeChangeTimestamp(Date.now())
    } else {
      const pool = autoThemePool.length > 0 ? autoThemePool : ['shiori', 'almanac', 'violet', 'sky']
      const current = getCurrentTheme()
      const idx = pool.indexOf(current)
      const nextIdx = (idx + 1) % pool.length
      const nextTheme = pool[nextIdx]
      applyTheme(nextTheme)
      setLastThemeChangeTimestamp(Date.now())
    }
  }, [autoThemeMode, autoThemeDayMapping, autoThemePool, setLastThemeChangeTimestamp])

  useEffect(() => {
    if (!autoThemeEnabled) return

    const tick = () => {
      const now = Date.now()
      const phase = getDayPhase()
      setCurrentPhase(phase)

      if (autoThemeMode === 'time-of-day') {
        const targetTheme = autoThemeDayMapping[phase]
        const active = getCurrentTheme()
        if (targetTheme && active !== targetTheme) {
          applyTheme(targetTheme)
          setLastThemeChangeTimestamp(now)
        }
        // Calculate remaining seconds to next time-of-day phase
        const { nextTime } = getNextPhaseTime(new Date())
        const rem = Math.max(0, Math.floor((nextTime.getTime() - now) / 1000))
        setSecondsRemaining(rem)
      } else {
        const intervalSec = Math.max(1, autoThemeIntervalMinutes * 60)
        const elapsedSec = Math.floor((now - lastThemeChangeTimestamp) / 1000)
        const remaining = Math.max(0, intervalSec - elapsedSec)
        setSecondsRemaining(remaining)

        if (remaining <= 0) {
          rotateToNext()
        }
      }
    }

    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [
    autoThemeEnabled,
    autoThemeMode,
    autoThemeIntervalMinutes,
    autoThemePool,
    autoThemeDayMapping,
    lastThemeChangeTimestamp,
    rotateToNext,
    setLastThemeChangeTimestamp,
  ])

  return {
    autoThemeEnabled,
    autoThemeMode,
    currentPhase,
    secondsRemaining,
    rotateToNext,
  }
}
