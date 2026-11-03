import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface TypewriterProps {
  text: string
  duration?: number
  enabled?: boolean
  className?: string
}

/**
 * Types text in character-by-character. Used only for the greeting on the
 * first load of a session; repeat visits render instantly.
 */
export function Typewriter({
  text,
  duration = 600,
  enabled = true,
  className,
}: TypewriterProps) {
  const reduced = useReducedMotion()
  const [length, setLength] = useState(enabled && !reduced ? 0 : text.length)

  useEffect(() => {
    if (!enabled || reduced) {
      setLength(text.length)
      return
    }

    setLength(0)
    const step = Math.max(24, duration / Math.max(text.length, 1))
    let index = 0
    const timer = window.setInterval(() => {
      index += 1
      setLength(index)
      if (index >= text.length) window.clearInterval(timer)
    }, step)
    return () => window.clearInterval(timer)
  }, [text, duration, enabled, reduced])

  return (
    <span className={className}>
      {text.slice(0, length)}
      {enabled && !reduced && length < text.length ? (
        <span className="type-caret text-primary">|</span>
      ) : null}
    </span>
  )
}
