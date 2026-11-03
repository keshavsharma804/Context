export const AVATAR_GRADIENTS = [
  'from-violet-500 to-indigo-600',
  'from-fuchsia-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-cyan-600',
  'from-rose-500 to-red-600',
]

export function avatarGradient(name: string) {
  let result = 0
  for (let index = 0; index < name.length; index += 1) {
    result = (result * 31 + name.charCodeAt(index)) % 997
  }
  return AVATAR_GRADIENTS[result % AVATAR_GRADIENTS.length]
}

/** True when a birthday (MM-DD or YYYY-MM-DD) falls in the next 30 days. */
export function isBirthdaySoon(birthday?: string | null) {
  if (!birthday) return false
  const parts = birthday.split('-').map(Number)
  const month = parts.length === 3 ? parts[1] : parts[0]
  const day = parts.length === 3 ? parts[2] : parts[1]
  if (!month || !day) return false
  const now = new Date()
  let date = new Date(now.getFullYear(), month - 1, day)
  if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    date = new Date(now.getFullYear() + 1, month - 1, day)
  }
  const days = Math.round((date.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  return days >= 0 && days <= 30
}
