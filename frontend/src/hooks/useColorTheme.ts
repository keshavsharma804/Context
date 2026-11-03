import { useEffect, useState } from 'react'
import { getCurrentTheme, resolveTheme, type Theme } from '@/lib/themes'

/** Reactive view of the saved colour theme (survives Settings changes). */
export function useColorTheme(): { id: string; theme: Theme; lightOnly: boolean } {
  const [id, setId] = useState(getCurrentTheme)

  useEffect(() => {
    const sync = () => setId(getCurrentTheme())
    window.addEventListener('context:theme-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('context:theme-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const theme = resolveTheme(id)
  return { id, theme, lightOnly: Boolean(theme.lightOnly) }
}
