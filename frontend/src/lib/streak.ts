/**
 * Daily streak bookkeeping.
 *
 * `getStreak()` is memoised for the session so React StrictMode's double
 * mount cannot increment the counter twice.
 */

const STREAK_KEY = 'context:streak'
const LAST_KEY = 'context:last-opened'

export const STREAK_MILESTONES = [7, 30, 100, 365]

export interface StreakResult {
  streak: number
  increased: boolean
  firstEver: boolean
  milestone: number | null
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function daysBetween(a: Date, b: Date): number {
  const ms = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const other = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((other - ms) / 86_400_000)
}

function readNumber(key: string): number {
  try {
    const value = Number(localStorage.getItem(key))
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
  } catch {
    return 0
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable
  }
}

function compute(): StreakResult {
  const today = new Date()
  const todayKey = localDateKey(today)
  let lastOpened: string | null = null
  try {
    lastOpened = localStorage.getItem(LAST_KEY)
  } catch {
    lastOpened = null
  }

  const stored = readNumber(STREAK_KEY)

  // Already counted today.
  if (lastOpened === todayKey) {
    return {
      streak: Math.max(1, stored),
      increased: false,
      firstEver: stored === 0,
      milestone: null,
    }
  }

  const firstEver = !lastOpened && stored === 0
  let streak = 1
  const previous = parseDateKey(lastOpened)

  if (previous) {
    const gap = daysBetween(previous, today)
    if (gap === 1) streak = Math.max(1, stored) + 1
    else if (gap <= 0) streak = Math.max(1, stored)
    else streak = 1
  } else if (stored > 0) {
    streak = stored + 1
  }

  write(LAST_KEY, todayKey)
  write(STREAK_KEY, String(streak))

  const milestone = STREAK_MILESTONES.includes(streak) ? streak : null
  return { streak, increased: !firstEver, firstEver, milestone }
}

let cached: StreakResult | null = null

export function getStreak(): StreakResult {
  if (!cached) cached = compute()
  return cached
}

export function streakLabel(streak: number, firstEver: boolean): string {
  if (firstEver && streak <= 1) return 'Start'
  return String(streak)
}
