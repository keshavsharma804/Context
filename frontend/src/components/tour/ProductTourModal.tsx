import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { SlideCapture } from './slides/SlideCapture'
import { SlideLocalVault } from './slides/SlideLocalVault'
import { SlideCircadianSky } from './slides/SlideCircadianSky'
import { SlidePersonalize } from './slides/SlidePersonalize'
import { playSound } from '@/hooks/useSound'

export interface ProductTourModalProps {
  open: boolean
  onClose: () => void
  initialStep?: number
}

const TOUR_SLIDES = [
  {
    id: 'capture',
    title: 'Type anything.\nContext keeps it.',
    description:
      'Write the way you think. Context reads your natural sentence and categorizes it in real time: expenses by day and month, debts, contacts, and journal memories. Press Ctrl J (or ⌘J) anywhere to begin.',
    highlight: 'Press Ctrl J anywhere to begin',
    component: SlideCapture,
  },
  {
    id: 'vault',
    title: 'Your data lives on\nyour device first.',
    description:
      'Everything is saved here the moment you write it. High-performance SQLite resides directly on your machine. Your personal notes, ID cards, and bank credentials are sealed in an AES-256 vault before anything ever leaves.',
    highlight: '100% Local Silicon · Zero Telemetry',
    component: SlideLocalVault,
  },
  {
    id: 'circadian',
    title: 'Harmonized to\nyour daylight.',
    description:
      'Context observes your local time to orchestrate a living atmosphere: the amber warmth of Dawn, crisp daylight rays, dusk sunsets, and quiet starry nights. You can customize auto-cycling intervals in Appearance settings.',
    highlight: 'Circadian Horizon & Live Scoreboard',
    component: SlideCircadianSky,
  },
  {
    id: 'personalize',
    title: 'Make it truly\nyours.',
    description:
      'In Settings, under Appearance: flip between Dark Obsidian and Light Paper, select from 10 balanced color palettes, customize page widths, or speed through your day with 15+ instant keyboard shortcuts.',
    highlight: '10 Curated Palettes & Fast Chords',
    component: SlidePersonalize,
  },
]

export function ProductTourModal({ open, onClose, initialStep = 0 }: ProductTourModalProps) {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [direction, setDirection] = useState(1)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    if (open) {
      setIsDismissed(false)
      setCurrentStep(initialStep)
    }
  }, [open, initialStep])

  // Explicit, fail-safe close & enter handler
  const handleCloseTour = (shouldNavigate = false) => {
    try {
      localStorage.setItem('context:tour_completed', 'true')
    } catch {
      // Ignore storage errors
    }

    // Immediately hide locally so UI closes with zero delay
    setIsDismissed(true)

    // Notify parent and any listeners
    onClose()
    window.dispatchEvent(new Event('context:tour-closed'))

    if (shouldNavigate) {
      try {
        playSound('chime')
      } catch {
        // audio fallback
      }
      navigate('/')
    }
  }

  const handleNext = (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    if (currentStep < TOUR_SLIDES.length - 1) {
      setDirection(1)
      setCurrentStep((prev) => prev + 1)
    } else {
      handleCloseTour(true)
    }
  }

  const handleBack = (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    if (currentStep > 0) {
      setDirection(-1)
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleJump = (index: number) => {
    setDirection(index > currentStep ? 1 : -1)
    setCurrentStep(index)
  }

  // Keyboard navigation: Left/Right arrows, Escape, Enter
  useEffect(() => {
    if (!open || isDismissed) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (currentStep === TOUR_SLIDES.length - 1) {
          handleCloseTour(true)
        } else {
          handleNext()
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleBack()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCloseTour(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, isDismissed, currentStep])

  if (!open || isDismissed) return null

  const activeSlide = TOUR_SLIDES[currentStep]
  const SlideComponent = activeSlide.component

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none pointer-events-auto">
      {/* Blurred Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => handleCloseTour(false)}
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity cursor-pointer z-0"
      />

      {/* Main Tour Card Container - Fixed Invariant Height (620px) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-5xl h-[620px] max-h-[88vh] overflow-hidden rounded-3xl border border-white/10 bg-[#0d0f14] text-stone-100 shadow-2xl flex flex-col justify-between pointer-events-auto"
      >
        {/* Subtle Top Inner Highlight */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        {/* Modal Top Bar: Step Counter & Skip */}
        <div className="h-14 shrink-0 flex items-center justify-between px-6 sm:px-8 border-b border-white/5 bg-[#0a0c10]/60">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs font-mono font-medium tracking-widest text-stone-400">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span>
              {currentStep + 1} OF {TOUR_SLIDES.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleCloseTour(false)}
            className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-stone-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
          >
            <span className="font-sans text-xs tracking-wide">Skip the tour</span>
            <X className="h-3.5 w-3.5 text-stone-400 group-hover:text-white transition-transform group-hover:rotate-90 duration-200" />
          </button>
        </div>

        {/* Content Area: Top-Aligned Invariant Showcase */}
        <div className="flex-1 min-h-0 px-6 py-6 sm:px-8 flex items-start overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start w-full">
            {/* Left Column: Live Interactive Mockup Graphic */}
            <div className="md:col-span-7 w-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSlide.id}
                  initial={{ opacity: 0, x: direction * 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -direction * 24 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="w-full"
                >
                  <SlideComponent />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right Column: Narrative Copy - Top-Aligned with the Card */}
            <div className="md:col-span-5 flex flex-col space-y-4 pl-0 md:pl-2 pt-1.5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSlide.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-3.5"
                >
                  <h2 className="font-serif text-3xl sm:text-4xl font-normal leading-tight tracking-tight text-white whitespace-pre-line">
                    {activeSlide.title}
                  </h2>

                  <p className="text-sm font-sans text-stone-300/90 leading-relaxed">
                    {activeSlide.description}
                  </p>

                  <div className="pt-1">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 font-mono text-[11px] text-stone-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                      {activeSlide.highlight}
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Stepper Indicators & Navigation Buttons */}
        <div className="h-16 shrink-0 border-t border-white/10 bg-[#08090d] px-6 sm:px-8 flex items-center justify-between z-20 relative">
          {/* Stepper Pills */}
          <div className="flex items-center gap-2.5">
            {TOUR_SLIDES.map((slide, idx) => {
              const isActive = idx === currentStep
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => handleJump(idx)}
                  title={`Go to step ${idx + 1}`}
                  className="relative p-1 focus:outline-none cursor-pointer"
                >
                  <motion.div
                    animate={{
                      width: isActive ? 32 : 8,
                      backgroundColor: isActive ? '#f97316' : 'rgba(255, 255, 255, 0.2)',
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="h-2 rounded-full shadow-sm"
                    style={{
                      boxShadow: isActive ? '0 0 12px rgba(249, 115, 22, 0.6)' : 'none',
                    }}
                  />
                </button>
              )
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="group flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/30 px-5 py-2 transition-all duration-200 cursor-pointer shadow-md active:scale-95"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-stone-400 group-hover:text-white group-hover:-translate-x-0.5 transition-transform duration-200" />
                <span className="font-sans text-xs font-semibold uppercase tracking-wider text-stone-300 group-hover:text-white">
                  Back
                </span>
              </button>
            )}

            {currentStep === TOUR_SLIDES.length - 1 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleCloseTour(true)
                }}
                className="group flex items-center gap-2.5 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 hover:from-orange-400 hover:to-amber-400 text-stone-950 px-7 py-2.5 transition-all duration-200 cursor-pointer shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-95 pointer-events-auto"
              >
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-stone-950">
                  Enter Context
                </span>
                <Check className="h-4 w-4 text-stone-950 stroke-[3]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="group flex items-center gap-2 rounded-full bg-white hover:bg-stone-100 text-stone-950 px-6 py-2 transition-all duration-200 cursor-pointer shadow-lg shadow-white/10 hover:shadow-white/25 active:scale-95"
              >
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-stone-950">
                  Next
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-stone-950 group-hover:translate-x-0.5 transition-transform duration-200" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
