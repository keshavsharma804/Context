import { useState } from 'react'
import { motion } from 'motion/react'
import { Moon, Sun, Palette, Keyboard, Sliders, Check } from 'lucide-react'

const THEME_PREVIEWS = [
  { id: 'sky', name: 'Sky', hex: '#0284c7', glow: 'rgba(2, 132, 199, 0.4)' },
  { id: 'cream', name: 'Cream', hex: '#d97706', glow: 'rgba(217, 119, 6, 0.4)' },
  { id: 'crimson', name: 'Crimson', hex: '#e11d48', glow: 'rgba(225, 29, 72, 0.4)' },
  { id: 'rose', name: 'Rose', hex: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)' },
  { id: 'emerald', name: 'Emerald', hex: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
  { id: 'mono', name: 'Mono', hex: '#71717a', glow: 'rgba(113, 113, 122, 0.4)' },
]

export function SlidePersonalize() {
  const [isDark, setIsDark] = useState(true)
  const [selectedTheme, setSelectedTheme] = useState(THEME_PREVIEWS[0])

  return (
    <div className="flex flex-col select-none">
      {/* Interactive Mock Customizer Card */}
      <div className="relative rounded-2xl border border-white/10 bg-[#121419] p-4 shadow-2xl overflow-hidden">
        {/* Miniature Mock App Window */}
        <motion.div
          animate={{
            backgroundColor: isDark ? '#14171d' : '#f8f6f0',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
          transition={{ duration: 0.3 }}
          className="rounded-xl border p-3 shadow-inner"
        >
          {/* Mock Window Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-black/10 dark:border-white/10 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500/80" />
              <span className="h-2 w-2 rounded-full bg-amber-500/80" />
              <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
              <span
                className={`ml-2 font-mono text-[9px] ${
                  isDark ? 'text-stone-400' : 'text-stone-600'
                }`}
              >
                In {selectedTheme.name}
              </span>
            </div>

            {/* Mode Switcher Pill */}
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold transition-all ${
                isDark
                  ? 'bg-white/10 text-stone-200 hover:bg-white/20'
                  : 'bg-stone-200 text-stone-900 hover:bg-stone-300'
              }`}
            >
              {isDark ? <Moon className="h-2.5 w-2.5 text-cyan-400" /> : <Sun className="h-2.5 w-2.5 text-amber-500" />}
              <span>{isDark ? 'Dark Obsidian' : 'Light Paper'}</span>
            </button>
          </div>

          {/* Mock Layout Grid: Miniature Sidebar + Cards */}
          <div className="grid grid-cols-12 gap-2">
            {/* Mini Rail */}
            <div className="col-span-3 space-y-1.5">
              <div
                className="h-2.5 rounded transition-all"
                style={{ backgroundColor: selectedTheme.hex, opacity: 0.9 }}
              />
              <div
                className={`h-2 rounded ${isDark ? 'bg-white/10' : 'bg-black/10'}`}
              />
              <div
                className={`h-2 rounded ${isDark ? 'bg-white/10' : 'bg-black/10'}`}
              />
              <div
                className={`h-2 rounded ${isDark ? 'bg-white/10' : 'bg-black/10'}`}
              />
            </div>

            {/* Mini Main Cards */}
            <div className="col-span-9 space-y-2">
              <div
                className="h-6 rounded-lg p-1.5 flex items-center justify-between border transition-all"
                style={{
                  backgroundColor: isDark ? '#1a1e26' : '#ffffff',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                }}
              >
                <div
                  className="h-2 w-16 rounded"
                  style={{ backgroundColor: selectedTheme.hex, opacity: 0.8 }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: selectedTheme.hex }}
                />
              </div>

              <div
                className="h-10 rounded-lg p-2 border flex flex-col justify-between"
                style={{
                  backgroundColor: isDark ? '#1a1e26' : '#ffffff',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                }}
              >
                <div
                  className={`h-1.5 w-24 rounded ${isDark ? 'bg-white/20' : 'bg-black/20'}`}
                />
                <div
                  className={`h-1.5 w-16 rounded ${isDark ? 'bg-white/10' : 'bg-black/10'}`}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Theme Swatch Selector */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 mb-1.5">
            <span>CHOOSE PALETTE</span>
            <span className="text-stone-500">Tap to preview</span>
          </div>

          <div className="flex items-center justify-between gap-1">
            {THEME_PREVIEWS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTheme(t)}
                className={`group relative flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium transition-all ${
                  selectedTheme.id === t.id
                    ? 'border-white/40 bg-white/10 text-white shadow'
                    : 'border-white/5 bg-[#0e1014] text-stone-400 hover:border-white/20'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shadow-sm"
                  style={{ backgroundColor: t.hex }}
                />
                <span className="hidden sm:inline">{t.name}</span>
                {selectedTheme.id === t.id && (
                  <Check className="h-2.5 w-2.5 text-stone-200 ml-0.5" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Global Chord Shortcuts Row */}
        <div className="mt-3 border-t border-white/5 pt-2.5">
          <div className="flex items-center justify-between text-[9px] font-mono text-stone-500 mb-1.5">
            <span>KEYBOARD ACCELERATION</span>
          </div>
          <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-stone-300 border border-white/5">
              <kbd className="text-orange-400">G then D</kbd> Dashboard
            </span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-stone-300 border border-white/5">
              <kbd className="text-cyan-400">⌘K</kbd> Palette
            </span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-stone-300 border border-white/5">
              <kbd className="text-emerald-400">⌘J</kbd> Capture
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
