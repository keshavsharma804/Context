import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns'

export function parseLocalDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const day = new Date(`${value}T12:00:00`)
  return !Number.isNaN(day.getTime()) && format(day, 'yyyy-MM-dd') === value ? day : null
}

/** Safe relative time ("3 days ago") for API timestamps. */
export function relativeTime(value?: string | null): string {
  if (!value) return '—'
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true })
  } catch {
    return value
  }
}

/** "14:30" from an ISO-ish timestamp. */
export function clockTime(value?: string | null): string {
  if (!value) return '—'
  try {
    return format(new Date(value), 'HH:mm')
  } catch {
    return value
  }
}

/** "Fri 14 Nov" */
export function shortDate(value?: string | null): string {
  if (!value) return '—'
  try {
    return format(new Date(value), 'EEE d MMM')
  } catch {
    return value
  }
}

/** Friendly day label used by the Today card. */
export function dayLabel(value: Date = new Date()): string {
  if (isToday(value)) return 'Today'
  if (isTomorrow(value)) return 'Tomorrow'
  return format(value, 'EEE d MMM')
}

export function initials(name?: string | null): string {
  if (!name) return '?'
  const clean = name.replace(/["'<>]/g, '').trim()
  if (!clean) return '?'
  if (clean.includes('@')) {
    return clean.split('@')[0].slice(0, 2).toUpperCase()
  }
  const parts = clean.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Pretty money, Indian grouping when the currency is INR. */
export function money(value: number, symbol = '₹', compact = false): string {
  if (!Number.isFinite(value)) return `${symbol}0`
  if (compact && Math.abs(value) >= 1000) {
    return `${symbol}${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`
  }
  return `${symbol}${Math.round(value).toLocaleString('en-IN')}`
}

/** The API returns "?" when the ₹ glyph can't be decoded — fall back. */
export function currencySymbol(symbol?: string | null): string {
  if (!symbol || symbol === '?' || symbol === '??') return '₹'
  return symbol
}
