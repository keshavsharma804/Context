import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ShieldCheck, HardDrive, Lock, Play, Pause, Database, KeyRound } from 'lucide-react'
import { ContextSeal } from '@/components/ui/ContextLogo'

export function SlideLocalVault() {
  const [activeStep, setActiveStep] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const steps = [
    {
      title: 'Write',
      desc: 'You write. It is saved on this machine instantly. Context works 100% offline.',
    },
    {
      title: 'Seal',
      desc: 'Private notes and records are sealed with AES-256 hardware encryption.',
    },
    {
      title: 'Local',
      desc: 'High-speed SQLite database right on your SSD. Zero telemetry leaves your device.',
    },
    {
      title: 'Freedom',
      desc: 'Your data is yours forever. Export raw SQLite or JSON anytime in one click.',
    },
  ]

  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length)
    }, 3200)
    return () => clearInterval(timer)
  }, [isPaused, steps.length])

  return (
    <div className="flex flex-col select-none">
      {/* Visual Architecture Diagram */}
      <div className="relative rounded-2xl border border-white/10 bg-[#14161b] p-5 shadow-2xl overflow-hidden">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Diagram Flow */}
        <div className="relative grid grid-cols-12 gap-3 items-center">
          {/* Node 1: This Device */}
          <div
            className={`col-span-5 rounded-xl border p-3 transition-all duration-300 ${
              activeStep === 0
                ? 'border-orange-500/60 bg-[#1a1b22] shadow-lg shadow-orange-500/10'
                : 'border-white/10 bg-[#111317]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-white">This device</span>
              <span className="font-mono text-[9px] text-emerald-400">works offline</span>
            </div>
            <div className="space-y-1.5 font-mono text-[10px]">
              <div className="flex items-center justify-between rounded bg-white/5 px-2 py-1 text-emerald-300">
                <span>lunch ₹450</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex items-center justify-between rounded bg-white/5 px-2 py-1 text-stone-400">
                <span>PAN ABCPE1234F</span>
                <Lock className="h-2.5 w-2.5 text-orange-400" />
              </div>
            </div>
          </div>

          {/* Center Connection: Seal Emblem */}
          <div className="col-span-2 flex flex-col items-center justify-center">
            {/* Animated dotted line */}
            <div className="relative flex items-center justify-center w-full">
              <div className="h-px w-full border-t border-dashed border-orange-500/40 relative">
                <motion.div
                  className="absolute top-[-2px] h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_#f97316]"
                  animate={{ left: ['0%', '100%'] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            </div>

            {/* Seal Badge */}
            <div className="mt-1">
              <ContextSeal size={32} />
            </div>
          </div>

          {/* Node 2: SQLite Storage & Vault */}
          <div
            className={`col-span-5 rounded-xl border p-3 transition-all duration-300 ${
              activeStep === 2 || activeStep === 3
                ? 'border-orange-500/60 bg-[#1a1b22] shadow-lg shadow-orange-500/10'
                : 'border-white/10 bg-[#111317]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-white">Local Silicon</span>
              <span className="font-mono text-[9px] text-orange-400">AES-256</span>
            </div>
            <div className="space-y-1.5 font-mono text-[10px]">
              <div className="rounded border border-dashed border-white/10 bg-white/5 p-1.5">
                <div className="flex items-center gap-1.5 text-stone-300 font-semibold text-[9px]">
                  <Database className="h-2.5 w-2.5 text-emerald-400" />
                  <span>SQLite Database</span>
                </div>
                <div className="text-[9px] text-stone-500 mt-0.5">instant disk read/write</div>
              </div>
              <div className="rounded border border-dashed border-white/10 bg-white/5 p-1.5">
                <div className="flex items-center gap-1.5 text-orange-300 font-semibold text-[9px]">
                  <ShieldCheck className="h-2.5 w-2.5 text-orange-400" />
                  <span>Vault Storage</span>
                </div>
                <div className="text-[9px] text-stone-500 mt-0.5">hardware-sealed records</div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Interactive Micro-Steps Grid */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          {steps.map((st, idx) => (
            <button
              key={st.title}
              type="button"
              onClick={() => {
                setActiveStep(idx)
                setIsPaused(true)
              }}
              className={`text-left rounded-xl border p-2.5 transition-all ${
                activeStep === idx
                  ? 'border-orange-500/70 bg-orange-950/20 shadow-md ring-1 ring-orange-500/30'
                  : 'border-white/5 bg-[#0e1014] hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold font-mono ${
                    activeStep === idx
                      ? 'bg-orange-400 text-stone-950'
                      : 'bg-white/10 text-stone-400'
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="text-[11px] font-semibold text-stone-200">{st.title}</span>
              </div>
              <p className="text-[10px] text-stone-400 line-clamp-2 leading-tight">
                {st.desc}
              </p>
            </button>
          ))}
        </div>

        {/* Pause / Resume Controls */}
        <div className="mt-2.5 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="flex items-center gap-1 font-mono text-[10px] text-stone-500 hover:text-stone-300 transition-colors"
          >
            {isPaused ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
