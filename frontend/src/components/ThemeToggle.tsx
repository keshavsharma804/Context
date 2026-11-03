import { useRef } from 'react'
import { flushSync } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { useUIStore } from '@/store/ui'
import { cn } from '@/lib/utils'
import { useSound } from '@/hooks/useSound'
import { useColorTheme } from '@/hooks/useColorTheme'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> }
}

export default function ThemeToggle({ className }: { className?: string }) {
  const theme = useUIStore(s => s.theme)
  const setTheme = useUIStore(s => s.setTheme)
  const { lightOnly } = useColorTheme()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const isLight = theme === 'light'
  const playPop = useSound('pop')

  const toggle = () => {
    if (lightOnly) {
      toast.info('Cream is a light-only theme. Pick another colour for dark mode.')
      return
    }
    playPop()
    const next = isLight ? 'dark' : 'light'
    const node = buttonRef.current
    const doc = document as ViewTransitionDocument
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (!node || !doc.startViewTransition || reduceMotion) {
      setTheme(next)
      return
    }

    // Wave origin = centre of the toggle button (top-right of the topbar).
    const rect = node.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    // Radius reaches the furthest corner so the new theme fully covers the page.
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    const root = document.documentElement
    root.style.setProperty('--wave-x', `${x}px`)
    root.style.setProperty('--wave-y', `${y}px`)
    root.style.setProperty('--wave-radius', `${radius}px`)

    doc.startViewTransition(() => {
      flushSync(() => setTheme(next))
    })
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggle}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-pressed={isLight}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      className={cn(
        'group relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-surface-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40',
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 10, opacity: 0, rotate: -35, scale: 0.6 }}
          animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
          exit={{ y: -10, opacity: 0, rotate: 35, scale: 0.6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="flex"
        >
          {isLight ? (
            <Sun className="h-4 w-4 text-amber-500 light:text-amber-600" />
          ) : (
            <Moon className="h-4 w-4 text-primary" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
