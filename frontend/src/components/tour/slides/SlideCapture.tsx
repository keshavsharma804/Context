import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Check, Sparkles, CornerDownLeft, RotateCcw } from 'lucide-react'

export function SlideCapture() {
  const fullText = 'spent 450 on lunch with Rahul'
  const [displayedText, setDisplayedText] = useState('')
  const [isDoneTyping, setIsDoneTyping] = useState(false)
  const [key, setKey] = useState(0)

  useEffect(() => {
    setDisplayedText('')
    setIsDoneTyping(false)
    let currentIdx = 0
    const interval = setInterval(() => {
      if (currentIdx < fullText.length) {
        setDisplayedText(fullText.slice(0, currentIdx + 1))
        currentIdx++
      } else {
        clearInterval(interval)
        setIsDoneTyping(true)
      }
    }, 55)

    return () => clearInterval(interval)
  }, [key])

  const restart = () => {
    setKey((prev) => prev + 1)
  }

  return (
    <div className="flex flex-col select-none">
      {/* Interactive Mock Input Container */}
      <div className="relative rounded-2xl border border-white/10 bg-[#16181d] p-5 shadow-2xl overflow-hidden">
        {/* Subtle top glare */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* Input Bar */}
        <div className="relative flex items-center justify-between rounded-xl border border-white/10 bg-[#0d0e12] px-4 py-3 shadow-inner">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="font-sans text-sm text-stone-200 truncate">
              {displayedText}
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-orange-400 align-middle animate-pulse" />
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pl-2">
            <kbd className="hidden sm:inline-flex items-center rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-stone-400">
              Ctrl J
            </kbd>
            <button
              onClick={restart}
              title="Replay typing animation"
              className="p-1 rounded text-stone-500 hover:text-stone-300 hover:bg-white/5 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Extracted Entity Tag Pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2 min-h-[32px]">
          <AnimatePresence>
            {isDoneTyping && (
              <>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-400 shadow-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Money
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.22, duration: 0.3 }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-950/40 px-3 py-1 text-xs font-medium text-amber-300 shadow-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Food & drinks
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.34, duration: 0.3 }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-950/40 px-3 py-1 text-xs font-medium text-orange-300 shadow-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                  Rahul
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Resolved Ledger Entry Card */}
        <AnimatePresence>
          {isDoneTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.48, duration: 0.4 }}
              className="mt-4 flex items-center justify-between rounded-xl border-l-2 border-l-emerald-400 border border-white/5 bg-[#101217] px-4 py-3 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-emerald-400">
                  ₹450
                </span>
                <span className="text-xs font-medium text-stone-200">
                  lunch with Rahul
                </span>
              </div>
              <span className="font-mono text-[11px] text-stone-500">today</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Subtle Caption Tip */}
      <div className="mt-4 flex items-center gap-2 text-stone-400 text-xs">
        <Sparkles className="h-3.5 w-3.5 text-orange-400 shrink-0" />
        <span>Context understands natural language, currencies, people & dates.</span>
      </div>
    </div>
  )
}
