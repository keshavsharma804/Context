import { useEffect, useState } from 'react'
import { getUserAvatar, getUserName } from '@/lib/profile'

/** Reactive profile fields, kept in sync by `context:profile-changed`. */
export function useProfile() {
  const [name, setName] = useState(getUserName)
  const [avatar, setAvatar] = useState<string | null>(getUserAvatar)

  useEffect(() => {
    const sync = () => {
      setName(getUserName())
      setAvatar(getUserAvatar())
    }
    window.addEventListener('context:profile-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('context:profile-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return { name, avatar }
}
