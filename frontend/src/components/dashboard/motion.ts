import type { Variants } from 'motion/react'

/**
 * Parent grid variants — every direct motion child (card) animates in
 * 100ms after the one before it.
 */
export const gridVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.06,
    },
  },
}

/** Shared card entrance: fade up from 20px. */
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut' },
  },
}
