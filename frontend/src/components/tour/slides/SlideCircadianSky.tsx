import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sun, Moon, Sunrise, Sunset, Sparkles, Clock } from 'lucide-react'

type Phase = 'dawn' | 'day' | 'dusk' | 'night'

const PHASE_CONFIG: Record<
  Phase,
  {
    label: string
    greeting: string
    line: string
    bgGradient: string
    sunColor: string
    celestialIcon: typeof Sun
    textColor: string
  }
> = {
  dawn: {
    label: 'Dawn',
    greeting: 'Good morning',
    line: 'A blank page. Nothing is pressing.',
    bgGradient: 'linear-gradient(180deg, #4c1d95 0%, #a855f7 40%, #fb923c 85%, #f97316 100%)',
    sunColor: '#fbbf24',
    celestialIcon: Sunrise,
    textColor: '#ffffff',
  },
  day: {
    label: 'Day',
    greeting: 'Good afternoon',
    line: 'The light is steady. Make good things happen.',
    bgGradient: 'linear-gradient(180deg, #0284c7 0%, #38bdf8 50%, #bae6fd 85%, #059669 100%)',
    sunColor: '#ffffff',
    celestialIcon: Sun,
    textColor: '#0f172a',
  },
  dusk: {
    label: 'Dusk',
    greeting: 'Good evening',
    line: 'Long shadows and golden hues across your horizon.',
    bgGradient: 'linear-gradient(180deg, #1e1b4b 0%, #6b21a8 45%, #c026d3 75%, #f97316 100%)',
    sunColor: '#f43f5e',
    celestialIcon: Sunset,
    textColor: '#ffffff',
  },
  night: {
    label: 'Night',
    greeting: 'Good night',
    line: 'Quiet embers and quiet thoughts. Rest well.',
    bgGradient: 'linear-gradient(180deg, #090a10 0%, #0f172a 50%, #1e1b4b 90%, #090a10 100%)',
    sunColor: '#e0e7ff',
    celestialIcon: Moon,
    textColor: '#ffffff',
  },
}

export function SlideCircadianSky() {
  const [phase, setPhase] = useState<Phase>('dawn')
  const [time, setTime] = useState(new Date())
  const [mascotHappy, setMascotHappy] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const current = PHASE_CONFIG[phase]
  const CelestialIcon = current.celestialIcon

  const hours = String(time.getHours() % 12 || 12).padStart(2, '0')
  const minutes = String(time.getMinutes()).padStart(2, '0')
  const seconds = String(time.getSeconds()).padStart(2, '0')
  const ampm = time.getHours() >= 12 ? 'PM' : 'AM'

  return (
    <div className="flex flex-col select-none">
      {/* Miniature Interactive Aurora/Sky Box */}
      <div className="relative rounded-2xl border border-white/10 bg-[#12141a] p-4 shadow-2xl overflow-hidden">
        {/* Top Controls: Scoreboard Clock & Phase Switcher */}
        <div className="flex items-center justify-between mb-3 z-10 relative">
          {/* LED Digital Scoreboard Clock */}
          <div className="flex items-center gap-1 rounded-xl border border-emerald-500/30 bg-[#07130f] px-2.5 py-1 shadow-inner">
            <span className="font-mono text-xs font-bold text-emerald-400 tracking-wider">
              {hours}:{minutes}:{seconds}
            </span>
            <span className="font-mono text-[9px] text-emerald-600 font-semibold">{ampm}</span>
          </div>

          {/* Interactive Phase Toggle Pills */}
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-0.5 backdrop-blur-md">
            {(['dawn', 'day', 'dusk', 'night'] as Phase[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPhase(p)}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-all ${
                  phase === p
                    ? 'bg-white text-stone-950 font-bold shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Live Sky Canvas */}
        <motion.div
          animate={{ background: current.bgGradient }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="relative h-48 w-full rounded-xl overflow-hidden p-4 shadow-inner flex flex-col justify-between"
        >
          {/* Stars (visible in night / dusk) */}
          {phase === 'night' && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-3 left-8 h-1 w-1 rounded-full bg-white animate-ping" />
              <div className="absolute top-10 left-32 h-1 w-1 rounded-full bg-white/70" />
              <div className="absolute top-6 right-20 h-1.5 w-1.5 rounded-full bg-cyan-200/90 shadow-[0_0_6px_#fff]" />
              <div className="absolute top-14 right-40 h-1 w-1 rounded-full bg-amber-100/70" />
              <div className="absolute top-20 left-16 h-1 w-1 rounded-full bg-white/60" />
            </div>
          )}

          {/* Sun Rays (in day phase) */}
          {phase === 'day' && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-white/20 blur-2xl pointer-events-none" />
          )}

          {/* Celestial Body (Sun / Moon) */}
          <motion.div
            key={phase}
            initial={{ scale: 0.6, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.6, type: 'spring' }}
            className="absolute top-4 right-6 flex items-center justify-center h-10 w-10 rounded-full shadow-lg"
            style={{
              backgroundColor: current.sunColor,
              boxShadow: `0 0 24px ${current.sunColor}80`,
            }}
          >
            <CelestialIcon className="h-5 w-5 text-stone-900/80" />
          </motion.div>

          {/* Interactive Floating Mascot (Shani) */}
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            onClick={() => setMascotHappy(true)}
            onAnimationComplete={() => setTimeout(() => setMascotHappy(false), 1500)}
            className="absolute bottom-4 right-6 flex flex-col items-center cursor-pointer group"
            title="Click to greet Shani!"
          >
            {mascotHappy && (
              <motion.span
                initial={{ scale: 0, opacity: 0, y: 5 }}
                animate={{ scale: 1, opacity: 1, y: -4 }}
                exit={{ opacity: 0 }}
                className="text-xs font-bold text-amber-200 drop-shadow"
              >
                ✨ Hi friend!
              </motion.span>
            )}

            {/* Ghost / Mascot Vector */}
            <div className="relative flex h-9 w-8 flex-col items-center justify-between rounded-t-full bg-emerald-400 p-1 shadow-lg shadow-emerald-500/40 transition-transform group-hover:scale-110">
              {/* Eyes */}
              <div className="flex gap-1.5 mt-2">
                <span className="h-1 w-1 rounded-full bg-stone-900" />
                <span className="h-1 w-1 rounded-full bg-stone-900" />
              </div>
              {/* Smile */}
              <div className="h-0.5 w-2 rounded-full bg-stone-900/80 mb-1" />
              {/* Feet scallops */}
              <div className="absolute -bottom-1 inset-x-0 flex justify-between px-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
            </div>
          </motion.div>

          {/* Sky Greeting & Atmospheric Line */}
          <div className="relative z-10 max-w-[65%]">
            <span className="inline-block rounded-full bg-black/25 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/90 backdrop-blur-sm mb-1">
              {current.label} Atmosphere
            </span>
            <h4
              className="font-serif text-2xl font-light tracking-tight"
              style={{ color: current.textColor }}
            >
              {current.greeting}
            </h4>
            <p
              className="text-xs mt-1 font-sans line-clamp-2 leading-relaxed opacity-90"
              style={{ color: current.textColor }}
            >
              {current.line}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Caption footer */}
      <div className="mt-4 flex items-center gap-2 text-stone-400 text-xs">
        <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <span>Context can automatically shift themes as your daylight changes.</span>
      </div>
    </div>
  )
}
