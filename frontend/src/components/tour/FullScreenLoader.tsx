import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ShieldCheck, Cpu } from 'lucide-react'
import { ContextLogo, ContextSeal } from '@/components/ui/ContextLogo'

interface FullScreenLoaderProps {
  onComplete: () => void
  durationMs?: number
}

export function FullScreenLoader({ onComplete, durationMs = 2000 }: FullScreenLoaderProps) {
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('Initializing local silicon...')

  // Format today's date dynamically (e.g. "3 NOVEMBER")
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
  })
    .format(new Date())
    .toUpperCase()

  useEffect(() => {
    const startTime = performance.now()
    let frameId: number

    const tick = (now: number) => {
      const elapsed = now - startTime
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100))
      setProgress(pct)

      if (pct < 35) {
        setStage('Initializing local silicon...')
      } else if (pct < 70) {
        setStage('Mounting encrypted SQLite database...')
      } else if (pct < 95) {
        setStage('Synchronizing circadian rhythms...')
      } else {
        setStage('Ready.')
      }

      if (elapsed < durationMs) {
        frameId = requestAnimationFrame(tick)
      } else {
        // Short pause at 100% before transition
        setTimeout(() => {
          onComplete()
        }, 220)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [durationMs, onComplete])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#090a0d] text-stone-100 select-none overflow-hidden"
    >
      {/* Background ambient radial gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-orange-500/5 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-[90px]" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Center Branding Cluster */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-md">
        {/* Animated Brand Emblem Icon */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-6"
        >
          {/* Authentic Tactile Squircle Body */}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-[#121418] shadow-2xl">
            <div className="absolute inset-x-2 top-0 h-px bg-white/20" />
            <ContextLogo size={52} />
          </div>
        </motion.div>

        {/* Brand Name in Serif Display */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif text-5xl md:text-6xl font-light tracking-tight text-white mb-2"
        >
          context
        </motion.h1>

        {/* Date / Subtitle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex items-center gap-2 font-mono text-xs tracking-widest text-stone-400/80 uppercase mb-8"
        >
          <span>{todayFormatted}</span>
        </motion.div>

        {/* Minimalist Progress Meter */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0.9 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="w-48 sm:w-56"
        >
          <div className="h-[2px] w-full rounded-full bg-stone-800 overflow-hidden">
            <motion.div
              className="h-full bg-stone-300 rounded-full"
              style={{ width: `${progress}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between font-mono text-[10px] text-stone-500">
            <span className="truncate pr-2">{stage}</span>
            <span className="tabular-nums font-semibold text-stone-300">{progress}%</span>
          </div>
        </motion.div>
      </div>

      {/* Bottom Corner Seals & Info */}
      <div className="absolute bottom-6 left-6 hidden sm:flex items-center gap-2 font-mono text-[10px] text-stone-500/70">
        <Cpu className="h-3.5 w-3.5 text-stone-600" />
        <span>LOCAL SILICON · ZERO TELEMETRY</span>
      </div>

      {/* Bottom Right Traditional Cryptographic Seal (Context Bespoke Seal) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="absolute bottom-6 right-6"
      >
        <ContextSeal size={40} />
      </motion.div>

      {/* Quick Skip Button */}
      <button
        type="button"
        onClick={onComplete}
        className="absolute top-6 right-6 font-mono text-xs text-stone-500 hover:text-stone-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-stone-800/40"
      >
        Skip intro
      </button>
    </motion.div>
  )
}
