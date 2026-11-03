import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'motion/react'

/**
 * nprogress-style route indicator. It jumps to 8%, creeps to ~80%, then
 * completes and fades once the new route has painted.
 */
export function RouteProgress() {
  const location = useLocation()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timers = useRef<number[]>([])
  const first = useRef(true)

  useEffect(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []

    setVisible(true)
    setProgress(0.08)

    const start = window.setTimeout(() => setProgress(0.72), 40)
    const almost = window.setTimeout(() => setProgress(0.9), 260)
    const done = window.setTimeout(() => setProgress(1), 420)
    const hide = window.setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 760)
    timers.current = [start, almost, done, hide]

    if (first.current) first.current = false
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [location.pathname, location.key])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]"
    >
      <motion.div
        className="h-full origin-left shadow-[0_0_10px_hsl(var(--primary)/0.75)]"
        style={{
          width: '100%',
          background:
            'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--theme-accent)), hsl(var(--primary)))',
        }}
        animate={{ scaleX: progress, opacity: visible ? 1 : 0 }}
        initial={{ scaleX: 0, opacity: 0 }}
        transition={{
          scaleX: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
          opacity: { duration: 0.2 },
        }}
      />
    </div>
  )
}
