import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

/** A rotating open arc — used inside buttons while an action is pending. */
export function SpinnerArc({ className }: { className?: string }) {
  return (
    <motion.span
      aria-hidden
      className={cn(
        'inline-block h-3.5 w-3.5 rounded-full border-[1.5px] border-current border-r-transparent',
        className
      )}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.75, repeat: Infinity, ease: 'linear' }}
    />
  )
}
