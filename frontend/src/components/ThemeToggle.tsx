import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { useUIStore } from '@/store/ui'
import { cn } from '@/lib/utils'
import { useSound } from '@/hooks/useSound'
import { useColorTheme } from '@/hooks/useColorTheme'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const SPARKS = Array.from({ length: 12 }, (_, index) => {
  const angle = (index / 12) * Math.PI * 2
  const distance = 30 + (index % 3) * 9
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    rotate: (index / 12) * 360 + 90,
    delay: (index % 3) * 0.025,
  }
})

export default function ThemeToggle({ className }: { className?: string }) {
  const theme = useUIStore(s => s.theme)
  const setTheme = useUIStore(s => s.setTheme)
  const { lightOnly } = useColorTheme()
  const [burst, setBurst] = useState(0)
  const burstSequence = useRef(0)
  const reducedMotion = useReducedMotion()
  const isLight = theme === 'light'
  const playPop = useSound('pop')

  const toggle = () => {
    if (lightOnly) {
      toast.info('Cream is a light-only theme. Pick another colour for dark mode.')
      return
    }
    playPop()
    const next = useUIStore.getState().theme === 'light' ? 'dark' : 'light'
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    setTheme(next)
    if (!reduceMotion) setBurst(++burstSequence.current)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-pressed={isLight}
      data-ui-tooltip={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      className={cn(
        'relative isolate inline-flex h-8 w-14 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isLight
          ? 'border-orange-300/80 bg-[#ffd1a3]'
          : 'border-indigo-300/20 bg-[#24213f]',
        className
      )}
    >
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ x: isLight ? 0 : 24 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 26 }}
        className={cn(
          'relative flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-300 motion-reduce:transition-none',
          isLight
            ? 'bg-[#fffaf0] text-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
            : 'bg-[#aaa2df] text-[#24203e] shadow-[0_0_10px_rgba(196,181,253,0.3)]'
        )}
      >
        <motion.span className="absolute flex" initial={false}
          animate={{ opacity: isLight ? 1 : 0, rotate: isLight ? 0 : -90, scale: isLight ? 1 : 0.5 }}
          transition={{ duration: reducedMotion ? 0 : 0.25 }}>
          <Sun className="h-[18px] w-[18px]" strokeWidth={2.3} />
        </motion.span>
        <motion.span className="absolute flex" initial={false}
          animate={{ opacity: isLight ? 0 : 1, rotate: isLight ? 75 : -12, scale: isLight ? 0.5 : 1 }}
          transition={{ duration: reducedMotion ? 0 : 0.25 }}>
          <Moon className="h-4 w-4" fill="currentColor" />
        </motion.span>
      </motion.span>
      {burst > 0 && !reducedMotion && (
        <motion.span
          key={burst}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeIn' }}
          onAnimationComplete={() => setBurst(current => current === burst ? 0 : current)}
        >
          {SPARKS.map((particle, index) => (
            <motion.span
              key={index}
              className="absolute left-1/2 top-1/2 -ml-0.5 -mt-1.5 h-3 w-1 rounded-full"
              style={{
                backgroundColor: isLight ? ['#ffb347', '#ffcf60', '#ff9966'][index % 3] : ['#c4b5fd', '#a5b4fc', '#e0d7ff'][index % 3],
                boxShadow: isLight ? '0 0 7px #ffbd59' : '0 0 7px #b8a7ff',
              }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: particle.rotate }}
              animate={{ x: particle.x, y: particle.y, opacity: [0, 1, 1, 0], scale: [0.4, 1, 0.6] }}
              transition={{ duration: 0.6, delay: particle.delay, ease: 'easeOut' }}
            />
          ))}
        </motion.span>
      )}
    </button>
  )
}
