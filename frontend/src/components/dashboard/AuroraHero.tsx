import { useState, useEffect, useRef, useMemo, type MouseEvent } from 'react'
import { motion } from 'motion/react'
import { useColorTheme } from '@/hooks/useColorTheme'
import { hexToHsl } from '@/lib/themes'
import { getDayPhase, type DayPhase } from '@/hooks/useAutoThemeScheduler'
import './aurora.css'

interface AuroraHeroProps {
  userName?: string
  className?: string
}

type PhaseSelection = 'live' | DayPhase

const SHANI_QUOTES = [
  'A brand new day, just for you ☀️',
  'Look at you, showing up today! ✨',
  'One small step is plenty 💫',
  'Tick one off and I will cheer! 🎉',
  'You have got this list 💪',
  'Money stuff is brave stuff 🌟',
  'Safe and sound, your space your style 🔒',
  'Every day counts 🌸',
]

const ATMOSPHERIC_LINES: Record<DayPhase, string> = {
  dawn: 'A blank page. Nothing is pressing.',
  day: 'The light is steady. Make good things happen.',
  dusk: 'Long shadows and golden hues across your horizon.',
  night: 'Quiet embers and quiet thoughts. Rest well.',
}

// Pre-computed stars to avoid re-renders
const STARS_DATA = Array.from({ length: 42 }, (_, i) => ({
  id: i,
  warm: i % 4 === 0,
  left: `${((i * 19.7) % 96) + 2}%`,
  top: `${((i * 13.3) % 68) + 2}%`,
  width: `${0.8 + ((i * 7) % 20) / 10}px`,
  delay: `${((i * 1.3) % 5).toFixed(2)}s`,
}))

// Floating dust motes
const DUST_MOTES = [
  { left: '8%', delay: '0s', duration: '7.5s' },
  { left: '26%', delay: '1.2s', duration: '8.5s' },
  { left: '48%', delay: '0.6s', duration: '9s' },
  { left: '68%', delay: '2.1s', duration: '7s' },
  { left: '86%', delay: '1.5s', duration: '8s' },
]

export default function AuroraHero({ userName, className = '' }: AuroraHeroProps) {
  const { theme } = useColorTheme()
  const [phaseMode, setPhaseMode] = useState<PhaseSelection>('live')
  const [livePhase, setLivePhase] = useState<DayPhase>(() => getDayPhase())
  const [mousePx, setMousePx] = useState(0)
  const [shaniAct, setShaniAct] = useState<'roam' | 'giggle' | 'spin' | 'dance' | 'hop'>('roam')
  const [shaniSay, setShaniSay] = useState<string | null>(null)
  const [shaniHearts, setShaniHearts] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const sayTimerRef = useRef<number | null>(null)

  // Clock ticker for LIVE mode
  useEffect(() => {
    const updatePhase = () => setLivePhase(getDayPhase())
    updatePhase()
    const timer = window.setInterval(updatePhase, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const currentPhase: DayPhase = phaseMode === 'live' ? livePhase : phaseMode

  // Subtle parallax effect on mouse move
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const normalized = (x / rect.width) * 2 - 1 // -1 to 1
    setMousePx(Math.max(-1, Math.min(1, normalized)))
  }

  const handleMouseLeave = () => {
    setMousePx(0)
  }

  // Interactive Shani mascot reaction
  const handleShaniClick = () => {
    const acts: Array<'giggle' | 'spin' | 'dance' | 'hop'> = ['giggle', 'spin', 'dance', 'hop']
    const nextAct = acts[Math.floor(Math.random() * acts.length)]
    setShaniAct(nextAct)
    setShaniHearts(true)

    const randomQuote = SHANI_QUOTES[Math.floor(Math.random() * SHANI_QUOTES.length)]
    setShaniSay(randomQuote)

    if (sayTimerRef.current) window.clearTimeout(sayTimerRef.current)
    sayTimerRef.current = window.setTimeout(() => {
      setShaniSay(null)
      setShaniAct('roam')
      setShaniHearts(false)
    }, 2800)
  }

  // Current dynamic greeting based on phase
  const greetingText = useMemo(() => {
    switch (currentPhase) {
      case 'dawn':
        return 'Good morning'
      case 'day':
        return 'Good day'
      case 'dusk':
        return 'Good evening'
      case 'night':
        return 'Good night'
    }
  }, [currentPhase])

  // Current date formatted
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }, [])

  // Derive atmospheric colors that mould cleanly to the applied theme
  const skyStyles = useMemo(() => {
    const { h } = hexToHsl(theme.primary)
    const isMoon = currentPhase === 'night'

    let skTop = ''
    let skMid = ''
    let skLow = ''
    let skInk = 'oklch(98% 0.02 80)'
    let skBody = 'oklch(97% 0.08 82)'
    let sunX = 50
    let lift = '0px'

    if (currentPhase === 'dawn') {
      skTop = `oklch(36% 0.14 ${(h + 100) % 360})`
      skMid = `oklch(64% 0.18 ${(h + 40) % 360})`
      skLow = `oklch(88% 0.13 78)`
      skInk = 'oklch(98% 0.02 80)'
      skBody = 'oklch(97% 0.08 82)'
      sunX = 64
      lift = '-10px'
    } else if (currentPhase === 'day') {
      skTop = `oklch(60% 0.17 ${h})`
      skMid = `oklch(79% 0.11 ${(h + 340) % 360})`
      skLow = `oklch(96% 0.05 ${(h + 320) % 360})`
      skInk = 'oklch(22% 0.05 255)'
      skBody = 'oklch(99% 0.06 95)'
      sunX = 52
      lift = '-40px'
    } else if (currentPhase === 'dusk') {
      skTop = `oklch(26% 0.14 ${(h + 80) % 360})`
      skMid = `oklch(50% 0.24 ${(h + 20) % 360})`
      skLow = `oklch(82% 0.17 62)`
      skInk = 'oklch(98% 0.02 70)'
      skBody = 'oklch(94% 0.12 72)'
      sunX = 36
      lift = '2px'
    } else {
      // Night
      skTop = `oklch(12% 0.07 ${h})`
      skMid = `oklch(21% 0.11 ${(h + 15) % 360})`
      skLow = `oklch(32% 0.12 ${(h + 30) % 360})`
      skInk = 'oklch(97% 0.02 250)'
      skBody = 'oklch(96% 0.04 95)'
      sunX = 72
      lift = '-25px'
    }

    return {
      '--sk-top': skTop,
      '--sk-mid': skMid,
      '--sk-low': skLow,
      '--sk-ink': skInk,
      '--sk-body': skBody,
      '--a1-accent': theme.accent,
      '--aurora-c1': theme.primary,
      '--aurora-c2': theme.accent,
      '--aurora-c3': theme.ring,
      '--sunx': sunX,
      '--lift': lift,
      '--px': mousePx,
      '--shani-glow': theme.glow,
    } as React.CSSProperties
  }, [theme, currentPhase, mousePx])

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full select-none ${className}`}
    >
      <div className="a1-sky" data-phase={currentPhase} style={skyStyles}>
        {/* Stars and Shooting Star Layer */}
        <div className="a1-stars" aria-hidden="true">
          <i className="a1-milky" />
          {STARS_DATA.map((star) => (
            <i
              key={star.id}
              data-warm={star.warm}
              style={{
                left: star.left,
                top: star.top,
                width: star.width,
                height: star.width,
                animationDelay: star.delay,
              }}
            />
          ))}
        </div>

        <i className="a1-shoot" aria-hidden="true" />

        {/* Northern Lights / Aurora Swaying Curtains */}
        <div className="a1-curtains" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        {/* Horizon Glow */}
        <i className="a1-horizon" aria-hidden="true" />

        {/* Celestial Body: Sun or Cratered Moon */}
        <span
          className="a1-body"
          aria-hidden="true"
          data-moon={currentPhase === 'night'}
          style={{ left: `calc(var(--sunx, 50) * 1%)` }}
        >
          <b className="a1-rays" />
        </span>

        {/* Drifting Clouds */}
        <i className="a1-cloud a1-c1" aria-hidden="true" />
        <i className="a1-cloud a1-c2" aria-hidden="true" />
        <i className="a1-cloud a1-c3" aria-hidden="true" />
        <i className="a1-cloud a1-c4" aria-hidden="true" />

        {/* Flying Birds (Day & Dawn) */}
        <div className="a1-birds" aria-hidden="true">
          {[0, 1, 2, 3].map((n) => (
            <svg
              key={n}
              viewBox="0 0 24 10"
              aria-hidden="true"
              style={{ ['--n' as string]: n }}
            >
              <path d="M1 8 Q6 1 12 7 Q18 1 23 8" />
            </svg>
          ))}
        </div>

        {/* Mountain Ridges Layered with Mist */}
        <div className="a1-land" aria-hidden="true">
          <svg className="a1-ridge a1-r1" viewBox="0 0 1440 300" preserveAspectRatio="none">
            <path d="M0.0 121.6 L12.0 119.1 L24.0 118.5 L36.0 122.4 L48.0 119.7 L60.0 122.4 L72.0 121.5 L84.0 115.9 L96.0 114.0 L108.0 109.8 L120.0 105.1 L132.0 104.5 L144.0 103.0 L156.0 101.4 L168.0 104.1 L180.0 101.5 L192.0 105.5 L204.0 107.6 L216.0 110.8 L228.0 109.4 L240.0 113.0 L252.0 116.9 L264.0 120.1 L276.0 123.7 L288.0 125.6 L300.0 121.3 L312.0 119.6 L324.0 118.2 L336.0 121.3 L348.0 120.5 L360.0 121.0 L372.0 118.7 L384.0 114.0 L396.0 113.4 L408.0 116.2 L420.0 114.5 L432.0 110.8 L444.0 117.0 L456.0 121.7 L468.0 123.5 L480.0 124.4 L492.0 126.5 L504.0 122.6 L516.0 122.1 L528.0 121.7 L540.0 118.3 L552.0 121.0 L564.0 122.1 L576.0 120.0 L588.0 118.7 L600.0 122.7 L612.0 126.7 L624.0 131.1 L636.0 133.2 L648.0 132.7 L660.0 131.9 L672.0 126.3 L684.0 117.9 L696.0 118.3 L708.0 113.1 L720.0 114.8 L732.0 118.2 L744.0 120.0 L756.0 121.6 L768.0 122.8 L780.0 124.8 L792.0 125.7 L804.0 123.7 L816.0 119.2 L828.0 120.8 L840.0 119.8 L852.0 117.6 L864.0 119.0 L876.0 116.0 L888.0 111.4 L900.0 115.0 L912.0 121.7 L924.0 124.2 L936.0 126.2 L948.0 123.1 L960.0 114.0 L972.0 110.9 L984.0 114.3 L996.0 119.9 L1008.0 124.3 L1020.0 124.1 L1032.0 117.3 L1044.0 122.4 L1056.0 122.6 L1068.0 119.9 L1080.0 117.3 L1092.0 115.8 L1104.0 116.5 L1116.0 112.6 L1128.0 106.2 L1140.0 109.0 L1152.0 106.4 L1164.0 107.5 L1176.0 109.4 L1188.0 110.5 L1200.0 107.6 L1212.0 104.3 L1224.0 101.6 L1236.0 99.7 L1248.0 105.6 L1260.0 108.3 L1272.0 104.7 L1284.0 108.3 L1296.0 108.1 L1308.0 103.8 L1320.0 99.5 L1332.0 97.4 L1344.0 99.1 L1356.0 104.6 L1368.0 105.3 L1380.0 109.0 L1392.0 115.5 L1404.0 116.2 L1416.0 119.1 L1428.0 124.7 L1440.0 122.2 V300 H0Z" />
          </svg>
          <svg className="a1-ridge a1-r2" viewBox="0 0 1440 300" preserveAspectRatio="none">
            <path d="M0.0 172.3 L12.0 170.0 L24.0 167.3 L36.0 170.3 L48.0 172.2 L60.0 174.7 L72.0 175.5 L84.0 175.2 L96.0 173.0 L108.0 172.3 L120.0 172.3 L132.0 171.3 L144.0 171.4 L156.0 171.5 L168.0 178.0 L180.0 181.8 L192.0 185.1 L204.0 189.4 L216.0 191.9 L228.0 191.3 L240.0 194.9 L252.0 194.9 L264.0 194.7 L276.0 197.3 L288.0 196.2 L300.0 194.2 L312.0 193.6 L324.0 195.8 L336.0 197.7 L348.0 197.5 L360.0 196.6 L372.0 192.2 L384.0 187.4 L396.0 181.2 L408.0 180.3 L420.0 180.5 L432.0 176.5 L444.0 178.0 L456.0 176.7 L468.0 173.9 L480.0 171.2 L492.0 168.6 L504.0 166.2 L516.0 163.2 L528.0 159.6 L540.0 152.0 L552.0 151.7 L564.0 150.2 L576.0 149.8 L588.0 147.7 L600.0 147.6 L612.0 147.3 L624.0 149.9 L636.0 152.5 L648.0 156.0 L660.0 158.9 L672.0 163.5 L684.0 168.6 L696.0 173.0 L708.0 174.8 L720.0 180.2 L732.0 184.2 L744.0 183.5 L756.0 181.0 L768.0 180.8 L780.0 180.4 L792.0 178.1 L804.0 178.6 L816.0 179.5 L828.0 179.1 L840.0 179.6 L852.0 178.0 L864.0 179.3 L876.0 179.2 L888.0 178.8 L900.0 181.6 L912.0 185.5 L924.0 186.6 L936.0 187.1 L948.0 185.9 L960.0 186.2 L972.0 189.8 L984.0 192.4 L996.0 192.3 L1008.0 194.1 L1020.0 190.9 L1032.0 187.1 L1044.0 183.9 L1056.0 181.5 L1068.0 179.7 L1080.0 177.8 L1092.0 173.9 L1104.0 173.1 L1116.0 173.1 L1128.0 168.5 L1140.0 167.2 L1152.0 166.9 L1164.0 164.5 L1176.0 164.5 L1188.0 165.2 L1200.0 162.6 L1212.0 165.0 L1224.0 165.2 L1236.0 161.6 L1248.0 158.0 L1260.0 156.9 L1272.0 155.5 L1284.0 155.0 L1296.0 155.4 L1308.0 155.3 L1320.0 159.0 L1332.0 163.4 L1344.0 167.9 L1356.0 171.9 L1368.0 173.0 L1380.0 176.3 L1392.0 179.5 L1404.0 181.3 L1416.0 182.9 L1428.0 185.4 L1440.0 188.8 V300 H0Z" />
          </svg>
          <svg className="a1-ridge a1-r3" viewBox="0 0 1440 300" preserveAspectRatio="none">
            <path d="M0.0 227.2 L12.0 227.1 L24.0 226.4 L36.0 226.4 L48.0 226.2 L60.0 225.3 L72.0 224.2 L84.0 222.8 L96.0 222.6 L108.0 221.3 L120.0 218.9 L132.0 217.5 L144.0 216.9 L156.0 216.8 L168.0 216.4 L180.0 217.2 L192.0 218.5 L204.0 219.8 L216.0 220.7 L228.0 220.9 L240.0 221.8 L252.0 222.6 L264.0 223.0 L276.0 223.8 L288.0 223.7 L300.0 223.1 L312.0 222.9 L324.0 221.9 L336.0 221.8 L348.0 221.3 L360.0 219.6 L372.0 218.3 L384.0 216.4 L396.0 214.7 L408.0 214.1 L420.0 214.1 L432.0 213.8 L444.0 213.6 L456.0 212.4 L468.0 211.6 L480.0 212.4 L492.0 212.7 L504.0 212.0 L516.0 212.4 L528.0 212.1 L540.0 210.7 L552.0 212.1 L564.0 212.8 L576.0 213.0 L588.0 212.9 L600.0 212.0 L612.0 211.4 L624.0 211.5 L636.0 211.7 L648.0 211.5 L660.0 212.0 L672.0 211.2 L684.0 211.6 L696.0 213.1 L708.0 213.4 L720.0 214.2 L732.0 215.4 L744.0 216.4 L756.0 217.7 L768.0 218.5 L780.0 218.6 L792.0 218.2 L804.0 217.9 L816.0 217.9 L828.0 217.4 L840.0 217.1 L852.0 217.5 L864.0 217.6 L876.0 217.1 L888.0 216.8 L900.0 216.5 L912.0 218.1 L924.0 218.8 L936.0 220.6 L948.0 220.7 L960.0 221.0 L972.0 224.0 L984.0 225.3 L996.0 225.5 L1008.0 225.8 L1020.0 225.9 L1032.0 225.2 L1044.0 224.7 L1056.0 224.1 L1068.0 223.5 L1080.0 222.9 L1092.0 222.9 L1104.0 223.4 L1116.0 223.1 L1128.0 223.0 L1140.0 222.9 L1152.0 222.0 L1164.0 220.6 L1176.0 219.7 L1188.0 220.3 L1200.0 220.7 L1212.0 221.5 L1224.0 221.1 L1236.0 218.6 L1248.0 218.1 L1260.0 217.3 L1272.0 215.1 L1284.0 215.4 L1296.0 214.4 L1308.0 212.3 L1320.0 209.4 L1332.0 208.4 L1344.0 208.7 L1356.0 208.5 L1368.0 207.7 L1380.0 207.1 L1392.0 206.9 L1404.0 206.2 L1416.0 206.4 L1428.0 206.9 L1440.0 205.8 V300 H0Z" />
          </svg>
          <i className="a1-mist a1-m1" />
          <i className="a1-mist a1-m2" />
        </div>

        {/* Calming Water & Reflection */}
        <div className="a1-water" aria-hidden="true">
          <div className="a1-mirror">
            <svg className="a1-ridge a1-r1" viewBox="0 0 1440 300" preserveAspectRatio="none">
              <path d="M0.0 121.6 L12.0 119.1 L24.0 118.5 L36.0 122.4 L48.0 119.7 L60.0 122.4 L72.0 121.5 L84.0 115.9 L96.0 114.0 L108.0 109.8 L120.0 105.1 L132.0 104.5 L144.0 103.0 L156.0 101.4 L168.0 104.1 L180.0 101.5 L192.0 105.5 L204.0 107.6 L216.0 110.8 L228.0 109.4 L240.0 113.0 L252.0 116.9 L264.0 120.1 L276.0 123.7 L288.0 125.6 L300.0 121.3 L312.0 119.6 L324.0 118.2 L336.0 121.3 L348.0 120.5 L360.0 121.0 L372.0 118.7 L384.0 114.0 L396.0 113.4 L408.0 116.2 L420.0 114.5 L432.0 110.8 L444.0 117.0 L456.0 121.7 L468.0 123.5 L480.0 124.4 L492.0 126.5 L504.0 122.6 L516.0 122.1 L528.0 121.7 L540.0 118.3 L552.0 121.0 L564.0 122.1 L576.0 120.0 L588.0 118.7 L600.0 122.7 L612.0 126.7 L624.0 131.1 L636.0 133.2 L648.0 132.7 L660.0 131.9 L672.0 126.3 L684.0 117.9 L696.0 118.3 L708.0 113.1 L720.0 114.8 L732.0 118.2 L744.0 120.0 L756.0 121.6 L768.0 122.8 L780.0 124.8 L792.0 125.7 L804.0 123.7 L816.0 119.2 L828.0 120.8 L840.0 119.8 L852.0 117.6 L864.0 119.0 L876.0 116.0 L888.0 111.4 L900.0 115.0 L912.0 121.7 L924.0 124.2 L936.0 126.2 L948.0 123.1 L960.0 114.0 L972.0 110.9 L984.0 114.3 L996.0 119.9 L1008.0 124.3 L1020.0 124.1 L1032.0 117.3 L1044.0 122.4 L1056.0 122.6 L1068.0 119.9 L1080.0 117.3 L1092.0 115.8 L1104.0 116.5 L1116.0 112.6 L1128.0 106.2 L1140.0 109.0 L1152.0 106.4 L1164.0 107.5 L1176.0 109.4 L1188.0 110.5 L1200.0 107.6 L1212.0 104.3 L1224.0 101.6 L1236.0 99.7 L1248.0 105.6 L1260.0 108.3 L1272.0 104.7 L1284.0 108.3 L1296.0 108.1 L1308.0 103.8 L1320.0 99.5 L1332.0 97.4 L1344.0 99.1 L1356.0 104.6 L1368.0 105.3 L1380.0 109.0 L1392.0 115.5 L1404.0 116.2 L1416.0 119.1 L1428.0 124.7 L1440.0 122.2 V300 H0Z" />
            </svg>
          </div>
          <i
            className="a1-glint"
            style={{ left: `calc(var(--sunx, 50) * 1%)` }}
          />
          <div className="a1-ripples" />
        </div>

        {/* Floating Glowing Firefly Dust */}
        <div className="a1-dust" aria-hidden="true">
          {DUST_MOTES.map((mote, i) => (
            <i
              key={i}
              style={{
                left: mote.left,
                animationDelay: mote.delay,
                animationDuration: mote.duration,
              }}
            />
          ))}
        </div>

        {/* Elegant Headline and Atmospheric Copy */}
        <div className="a1-copy">
          <p className="eyebrow">{formattedDate}</p>
          <h1 className="a1-hello" aria-label={greetingText}>
            {greetingText.split(' ').map((word, i) => (
              <span key={i} style={{ animationDelay: `${i * 120 + 80}ms` }}>
                {word}
              </span>
            ))}
            {userName && (
              <span style={{ animationDelay: '300ms', opacity: 0.85 }}>
                , {userName}
              </span>
            )}
          </h1>
          <p className="a1-line">{ATMOSPHERIC_LINES[currentPhase]}</p>
        </div>

        {/* Atmospheric Phase Picker Pill */}
        <fieldset className="a1-sky-pick" aria-label="Sky Time Phase">
          <legend className="sr-only">Sky Atmosphere</legend>
          <button
            type="button"
            aria-pressed={phaseMode === 'live'}
            onClick={() => setPhaseMode('live')}
            data-ui-tooltip="Real-time clock tracking"
          >
            Live
          </button>
          <button
            type="button"
            aria-pressed={phaseMode === 'dawn'}
            onClick={() => setPhaseMode('dawn')}
            data-ui-tooltip="Dawn sunrise atmosphere"
          >
            Dawn
          </button>
          <button
            type="button"
            aria-pressed={phaseMode === 'day'}
            onClick={() => setPhaseMode('day')}
            data-ui-tooltip="Daylight atmosphere"
          >
            Day
          </button>
          <button
            type="button"
            aria-pressed={phaseMode === 'dusk'}
            onClick={() => setPhaseMode('dusk')}
            data-ui-tooltip="Dusk golden sunset atmosphere"
          >
            Dusk
          </button>
          <button
            type="button"
            aria-pressed={phaseMode === 'night'}
            onClick={() => setPhaseMode('night')}
            data-ui-tooltip="Midnight Borealis atmosphere"
          >
            Night
          </button>
        </fieldset>

        {/* Interactive Floating Shani Mascot */}
        <div className="a1-shani-wrap">
          {shaniSay && <div className="shani-bubble">{shaniSay}</div>}

          <button
            type="button"
            className="shani-character"
            data-act={shaniAct}
            onClick={handleShaniClick}
            data-ui-tooltip="Click me for good vibes!"
            aria-label="Interactive Spirit Companion"
          >
            <span className="shani-aura" />
            <svg viewBox="0 0 64 64" width="54" height="54" role="presentation">
              <defs>
                <radialGradient id="shani-glow-grad" cx="50%" cy="42%" r="60%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="55%" stopColor={theme.accent} />
                  <stop offset="100%" stopColor={theme.primary} />
                </radialGradient>
              </defs>

              {/* Little feet */}
              <ellipse cx="24" cy="58" rx="5" ry="3.4" fill={theme.primary} />
              <ellipse cx="40" cy="58" rx="5" ry="3.4" fill={theme.primary} />

              {/* Arms */}
              <ellipse cx="11" cy="37" rx="3.8" ry="5" fill="url(#shani-glow-grad)" />
              <ellipse cx="53" cy="37" rx="3.8" ry="5" fill="url(#shani-glow-grad)" />

              {/* Ghost / Spirit Body */}
              <path
                d="M32 6c13 0 21 10 21 24v22c0 3-2 4-4 2l-3-3-4 4c-1.5 1.5-3 1.5-4.5 0L33 50.5 28.5 55c-1.5 1.5-3 1.5-4.5 0l-4-4-3 3c-2 2-4 1-4-2V30C13 16 19 6 32 6z"
                fill="url(#shani-glow-grad)"
              />

              {/* Forehead light highlight */}
              <ellipse cx="25" cy="16" rx="6" ry="3.5" fill="#ffffff" opacity="0.65" />

              {/* Smiling eyes */}
              <g className="shani-eyes">
                <ellipse cx="25" cy="30" rx="2.6" ry="3.4" fill="#0f172a" />
                <ellipse cx="39" cy="30" rx="2.6" ry="3.4" fill="#0f172a" />
                <circle cx="26" cy="29" r="0.9" fill="#ffffff" />
                <circle cx="40" cy="29" r="0.9" fill="#ffffff" />
              </g>

              {/* Rosy blush cheeks */}
              <ellipse cx="20" cy="36" rx="3.4" ry="2" fill="#fb7185" opacity="0.75" />
              <ellipse cx="44" cy="36" rx="3.4" ry="2" fill="#fb7185" opacity="0.75" />

              {/* Smile */}
              <path
                d="M28.5 36.5q3.5 3.2 7 0"
                stroke="#0f172a"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
            </svg>

            {/* Floating hearts reaction */}
            {shaniHearts && (
              <span className="shani-hearts">
                <i style={{ ['--dx' as string]: '-12px' }}>♥</i>
                <i style={{ ['--dx' as string]: '0px', animationDelay: '0.12s' }}>♥</i>
                <i style={{ ['--dx' as string]: '14px', animationDelay: '0.24s' }}>♥</i>
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
