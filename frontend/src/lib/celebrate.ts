import confetti from 'canvas-confetti'
import { playSound } from '@/hooks/useSound'

const FALLBACK_THEME_COLORS = ['#8b5cf6', '#a78bfa', '#6366f1', '#c4b5fd', '#22d3ee', '#f0abfc']

function themeColors(): string[] {
  if (typeof document === 'undefined') return FALLBACK_THEME_COLORS
  const styles = getComputedStyle(document.documentElement)
  const primary = styles.getPropertyValue('--primary-hex').trim()
  const accent = styles.getPropertyValue('--theme-accent-hex').trim()
  return [
    primary || FALLBACK_THEME_COLORS[0],
    accent || FALLBACK_THEME_COLORS[1],
    primary || FALLBACK_THEME_COLORS[0],
    accent || FALLBACK_THEME_COLORS[1],
    '#22d3ee',
    '#f0abfc',
  ]
}

/** 60-particle burst from the top centre of the viewport. */
export function celebrateConnection() {
  playSound('chime')
  try {
    confetti({
      particleCount: 60,
      spread: 72,
      startVelocity: 42,
      origin: { x: 0.5, y: 0.08 },
      colors: themeColors(),
      scalar: 0.9,
      ticks: 180,
      disableForReducedMotion: true,
    })
  } catch {
    // canvas is unavailable in some embedded browsers
  }
}

/** Tiny gold coin puff used when a spend is added. */
export function celebrateSpend(origin?: { x: number; y: number }) {
  playSound('chime')
  try {
    confetti({
      particleCount: 18,
      spread: 55,
      startVelocity: 26,
      gravity: 1.1,
      scalar: 0.65,
      ticks: 120,
      origin: origin ?? { x: 0.5, y: 0.6 },
      colors: ['#fbbf24', '#f59e0b', '#fcd34d'],
      disableForReducedMotion: true,
    })
  } catch {
    // ignore
  }
}

/** Heart burst for marking someone contacted. */
export function celebrateContact() {
  playSound('chime')
  try {
    confetti({
      particleCount: 24,
      spread: 45,
      startVelocity: 32,
      origin: { x: 0.5, y: 0.7 },
      colors: ['#f472b6', '#ec4899', '#db2777'],
      scalar: 0.9,
      ticks: 160,
      disableForReducedMotion: true,
    })
  } catch {
    // ignore
  }
}

/** Checkmark float for pattern dismissal. */
export function celebrateDismiss() {
  playSound('swoosh')
  // No confetti needed for this
}

/** Red flash for budget hitting 100%. */
export function celebrateBudgetHit() {
  playSound('thud')
  try {
    confetti({
      particleCount: 12,
      spread: 25,
      startVelocity: 18,
      origin: { x: 0.5, y: 0.3 },
      colors: ['#ef4444', '#dc2626', '#991b1b'],
      scalar: 0.8,
      ticks: 90,
      disableForReducedMotion: true,
    })
  } catch {
    // ignore
  }
}

/** Star burst for adding a job application. */
export function celebrateJobAdd() {
  playSound('chime')
  try {
    confetti({
      particleCount: 32,
      spread: 62,
      startVelocity: 35,
      origin: { x: 0.5, y: 0.2 },
      colors: ['#38bdf8', '#0ea5e9', '#0284c7'],
      scalar: 0.85,
      ticks: 140,
      disableForReducedMotion: true,
    })
  } catch {
    // ignore
  }
}

/** Theme-coloured burst for streak milestones. */
export function celebrateStreak(_days: number) {
  playSound('chime')
  try {
    confetti({
      particleCount: 90,
      spread: 90,
      startVelocity: 46,
      origin: { x: 0.5, y: 0.12 },
      colors: themeColors(),
      scalar: 1,
      ticks: 220,
      disableForReducedMotion: true,
    })
  } catch {
    // ignore
  }
}

/** One-habit completion: tiny 3-particle puff from the habit card. */
export function celebrateHabitLog(
  origin?: { x: number; y: number },
  color?: string
) {
  playSound('chime')
  try {
    confetti({
      particleCount: 3,
      spread: 42,
      startVelocity: 22,
      gravity: 1.15,
      scalar: 0.7,
      ticks: 80,
      origin: origin ?? { x: 0.5, y: 0.6 },
      colors: [color || themeColors()[0], themeColors()[0], themeColors()[1]],
      disableForReducedMotion: true,
    })
  } catch {
    // ignore
  }
}

/** Milestone (7 / 30 / 100 days): bell plus a burst from the habit card. */
export function celebrateHabitMilestone(
  origin?: { x: number; y: number },
  color?: string
) {
  playSound('bell')
  try {
    confetti({
      particleCount: 64,
      spread: 78,
      startVelocity: 38,
      scalar: 0.95,
      ticks: 190,
      origin: origin ?? { x: 0.5, y: 0.5 },
      colors: [
        color || themeColors()[0],
        ...themeColors(),
        '#fbbf24',
      ],
      disableForReducedMotion: true,
    })
  } catch {
    // ignore
  }
}
