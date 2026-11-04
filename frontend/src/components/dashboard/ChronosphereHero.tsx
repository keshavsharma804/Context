import { memo, useState, useEffect, useRef, useMemo, type MouseEvent } from 'react'
import { useColorTheme } from '@/hooks/useColorTheme'
import { hexToHsl } from '@/lib/themes'
import { getDayPhase, type DayPhase } from '@/hooks/useAutoThemeScheduler'
import './chronosphere.css'

interface ChronosphereHeroProps {
  userName?: string
  className?: string
}

type PhaseSelection = 'live' | DayPhase

const CHRONO_LINES: Record<DayPhase, string> = {
  dawn: 'First light breaks over the planetary horizon.',
  day: 'Steady orbit. The day is wide open.',
  dusk: 'The terminator line crosses the hemisphere.',
  night: 'The nocturnal hemisphere sleeps. Rest well.',
}

const SHANI_QUOTES = [
  'Steady orbit ahead! ✨',
  "You're doing amazing! 💫",
  'Your context, connected & ready.',
  'Atmosphere optimal for deep work. 🚀',
  'Take a mindful breath. 🌿',
  'Ready whenever you are! 🛸',
  'Planetary systems nominal. 🪐',
]

const SHANI_ACTIONS = ['giggle', 'spin', 'dance', 'hop'] as const

// Pre-computed stars across space
const STARS_DATA = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  warm: i % 5 === 0,
  left: `${((i * 19.3) % 96) + 2}%`,
  top: `${((i * 14.1) % 52) + 2}%`,
  size: 0.8 + ((i * 7) % 18) / 10,
  delay: `${((i * 1.1) % 4.5).toFixed(2)}s`,
}))

// Real-world city light clusters along continents for night view
const CITY_CLUSTERS_REAL = [
  { cx: 210, cy: 190, r: 2.2 },
  { cx: 235, cy: 175, r: 3.0 },
  { cx: 260, cy: 205, r: 2.5 },
  { cx: 290, cy: 180, r: 3.2 },
  { cx: 335, cy: 195, r: 2.4 },
  { cx: 780, cy: 150, r: 3.2 },
  { cx: 810, cy: 165, r: 3.5 },
  { cx: 835, cy: 145, r: 2.6 },
  { cx: 860, cy: 180, r: 3.0 },
  { cx: 885, cy: 210, r: 2.8 },
  { cx: 910, cy: 235, r: 3.2 },
  { cx: 1040, cy: 215, r: 3.4 },
  { cx: 1075, cy: 235, r: 2.8 },
  { cx: 1210, cy: 140, r: 3.5 },
  { cx: 1245, cy: 160, r: 3.8 },
  { cx: 1270, cy: 135, r: 2.5 },
  { cx: 1300, cy: 170, r: 3.0 },
]

function ChronosphereHero({ userName, className = '' }: ChronosphereHeroProps) {
  const { theme } = useColorTheme()
  const [phaseMode, setPhaseMode] = useState<PhaseSelection>('live')
  const [livePhase, setLivePhase] = useState<DayPhase>(() => getDayPhase())
  const parallaxFrame = useRef<number | null>(null)
  const pointer = useRef({ px: 0, py: 0 })
  const parallaxEnabled = useRef(false)
  const [telemetryOpen, setTelemetryOpen] = useState(false)
  const [shaniAct, setShaniAct] = useState<string>('')
  const [shaniSay, setShaniSay] = useState<string>('')
  const [shaniHearts, setShaniHearts] = useState<Array<{ id: number; dx: number }>>([])
  const shaniTimerRef = useRef<number | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const media = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    const updatePointer = () => {
      parallaxEnabled.current = media.matches
      if (!media.matches) { card.style.setProperty('--px', '0'); card.style.setProperty('--py', '0') }
    }
    updatePointer()
    media.addEventListener('change', updatePointer)
    let visible = true
    const updateActivity = () => { card.dataset.active = String(visible && !document.hidden) }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; updateActivity() })
    observer.observe(card)
    document.addEventListener('visibilitychange', updateActivity)
    updateActivity()
    return () => {
      observer.disconnect()
      media.removeEventListener('change', updatePointer)
      document.removeEventListener('visibilitychange', updateActivity)
      if (parallaxFrame.current !== null) cancelAnimationFrame(parallaxFrame.current)
    }
  }, [])

  // Real-time clock phase ticker
  useEffect(() => {
    const updatePhase = () => setLivePhase(getDayPhase())
    updatePhase()
    const timer = window.setInterval(updatePhase, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    return () => {
      if (shaniTimerRef.current) window.clearTimeout(shaniTimerRef.current)
    }
  }, [])

  const currentPhase: DayPhase = phaseMode === 'live' ? livePhase : phaseMode

  // Subtle 3D perspective shift on mouse move
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !parallaxEnabled.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    pointer.current = {
      px: Math.max(-1, Math.min(1, x * 2 - 1)),
      py: Math.max(-1, Math.min(1, y * 2 - 1)),
    }
    if (parallaxFrame.current !== null) return
    parallaxFrame.current = requestAnimationFrame(() => {
      parallaxFrame.current = null
      cardRef.current?.style.setProperty('--px', String(pointer.current.px))
      cardRef.current?.style.setProperty('--py', String(pointer.current.py))
    })
  }

  const handleMouseLeave = () => {
    if (parallaxFrame.current !== null) cancelAnimationFrame(parallaxFrame.current)
    parallaxFrame.current = null
    cardRef.current?.style.setProperty('--px', '0')
    cardRef.current?.style.setProperty('--py', '0')
  }

  const handleShaniClick = () => {
    const nextAct = SHANI_ACTIONS[Math.floor(Math.random() * SHANI_ACTIONS.length)]
    const nextSay = SHANI_QUOTES[Math.floor(Math.random() * SHANI_QUOTES.length)]
    setShaniAct(nextAct)
    setShaniSay(nextSay)

    const now = Date.now()
    setShaniHearts([
      { id: now, dx: -12 },
      { id: now + 1, dx: 0 },
      { id: now + 2, dx: 14 },
    ])

    if (shaniTimerRef.current) window.clearTimeout(shaniTimerRef.current)
    shaniTimerRef.current = window.setTimeout(() => {
      setShaniAct('')
      setShaniSay('')
    }, 3200)
  }

  // Greeting headline
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

  // Formatted date string
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }, [])

  // Derive atmospheric & celestial colors (Natural, Realistic Earth & Space)
  const chronoStyles = useMemo(() => {
    let spaceTop = ''
    let spaceMid = ''
    let spaceBottom = ''
    let limbLight = '#38bdf8'
    let atmoGlow = 'rgba(56, 189, 248, 0.45)'
    let sunCore = '#ffffff'
    let sunGlow = 'rgba(255, 255, 255, 0.85)'
    const ink = '#ffffff'
    let sunPos = { left: '70%', top: '22%' }

    if (currentPhase === 'dawn') {
      // Natural dawn sunrise: deep cosmic indigo fading into warm apricot/coral sunrise
      spaceTop = '#060b18'
      spaceMid = '#1a183d'
      spaceBottom = '#562544'
      limbLight = '#f59e0b'
      atmoGlow = 'rgba(245, 158, 11, 0.5)'
      sunCore = '#fef3c7'
      sunGlow = 'rgba(251, 146, 60, 0.75)'
      sunPos = { left: '70%', top: '34%' }
    } else if (currentPhase === 'day') {
      // Real natural Earth daylight: cosmic space navy at zenith to brilliant atmospheric azure
      // Free of neon green wash!
      spaceTop = '#050d1a'
      spaceMid = '#0d284f'
      spaceBottom = '#1e558c'
      limbLight = '#38bdf8'
      atmoGlow = 'rgba(56, 189, 248, 0.55)'
      sunCore = '#ffffff'
      sunGlow = 'rgba(255, 255, 255, 0.95)'
      sunPos = { left: '70%', top: '22%' }
    } else if (currentPhase === 'dusk') {
      // Natural dusk terminator: violet cosmos through twilight crimson to sunset amber
      spaceTop = '#070716'
      spaceMid = '#260f38'
      spaceBottom = '#671937'
      limbLight = '#fb7185'
      atmoGlow = 'rgba(244, 63, 94, 0.5)'
      sunCore = '#fecdd3'
      sunGlow = 'rgba(244, 63, 94, 0.75)'
      sunPos = { left: '28%', top: '40%' }
    } else {
      // Deep interstellar Night
      spaceTop = '#020610'
      spaceMid = '#050c1c'
      spaceBottom = '#09152e'
      limbLight = '#38bdf8'
      atmoGlow = 'rgba(56, 189, 248, 0.3)'
      sunPos = { left: '76%', top: '18%' }
    }

    return {
      '--chrono-space-top': spaceTop,
      '--chrono-space-mid': spaceMid,
      '--chrono-space-bottom': spaceBottom,
      '--chrono-limb-light': limbLight,
      '--chrono-atmo-glow': atmoGlow,
      '--chrono-aurora-color': theme.accent,
      '--chrono-nebula-color': theme.glow,
      '--chrono-sun-core': sunCore,
      '--chrono-sun-glow': sunGlow,
      '--chrono-ink': ink,
      '--sun-left': sunPos.left,
      '--sun-top': sunPos.top,
    } as React.CSSProperties
  }, [theme, currentPhase])

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`chronosphere-container relative w-full select-none ${className}`}
    >
      <div className="chronosphere-card" data-phase={currentPhase} style={chronoStyles}>
        {/* Deep Space Layer with Nebula & Stars */}
        <div className="chrono-space" aria-hidden="true">
          <div className="chrono-nebula" />
          <div className="chrono-meteor" />

          {STARS_DATA.map((star) => (
            <span
              key={star.id}
              className="chrono-star"
              data-warm={star.warm}
              style={{
                left: star.left,
                top: star.top,
                width: `${star.size}px`,
                height: `${star.size}px`,
                animationDelay: star.delay,
              }}
            />
          ))}
        </div>

        {/* Celestial Luminary: Sun with Anamorphic Corona or Moon */}
        {currentPhase !== 'night' ? (
          <div
            className="chrono-luminary chrono-sun"
            style={{
              left: 'var(--sun-left)',
              top: 'var(--sun-top)',
            }}
          >
            <div className="chrono-sun-rays" />
            <div className="chrono-anamorphic-flare" />
          </div>
        ) : (
          <div
            className="chrono-luminary chrono-moon"
            style={{
              left: 'var(--sun-left)',
              top: 'var(--sun-top)',
            }}
          />
        )}

        {/* The Sweeping Planetary Horizon Curve (Realistic Living Earth) */}
        <div className="chrono-planet-wrap" aria-hidden="true">
          {/* Real Earth High-Fidelity SVG Horizon */}
          <svg
            className="chrono-earth-canvas"
            viewBox="0 0 1440 600"
            preserveAspectRatio="none"
          >
            <defs>
              {/* Deep Ocean Water Gradient */}
              <radialGradient id="earth-ocean-grad" cx="50%" cy="0%" r="90%">
                <stop offset="0%" stopColor="#124874" />
                <stop offset="30%" stopColor="#0a3257" />
                <stop offset="65%" stopColor="#06203d" />
                <stop offset="100%" stopColor="#021024" />
              </radialGradient>

              {/* Coastal Shallow Shelf Water Gradient (Cyan Coral Reefs) */}
              <linearGradient id="coastal-shelf-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.85" />
                <stop offset="60%" stopColor="#0284c7" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
              </linearGradient>

              {/* Real Earth Terrain Texture Biomes */}
              <linearGradient id="continent-west-grad" x1="10%" y1="0%" x2="90%" y2="100%">
                <stop offset="0%" stopColor="#1e4620" /> {/* Temperate & boreal forest */}
                <stop offset="25%" stopColor="#2d5a27" />
                <stop offset="45%" stopColor="#436b28" />
                <stop offset="65%" stopColor="#6c5825" /> {/* Highlands / Savanna */}
                <stop offset="85%" stopColor="#8a6833" /> {/* Mountain plateaus */}
                <stop offset="100%" stopColor="#4a3b1a" />
              </linearGradient>

              <linearGradient id="continent-east-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2d5a27" />
                <stop offset="20%" stopColor="#1e4620" />
                <stop offset="45%" stopColor="#b48238" /> {/* Arid desert / Sahara basin */}
                <stop offset="70%" stopColor="#8a6833" />
                <stop offset="90%" stopColor="#5a421b" /> {/* Himalayan/Alpine ridges */}
                <stop offset="100%" stopColor="#322410" />
              </linearGradient>

              {/* Specular Solar Glint on Water (Day & Dawn reflection) */}
              <radialGradient id="ocean-sun-glint" cx="50%" cy="30%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="30%" stopColor="#bae6fd" stopOpacity="0.55" />
                <stop offset="65%" stopColor="#38bdf8" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
              </radialGradient>

              {/* Soft Cloud Glow Filter */}
              <filter id="cloud-softness" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="2.2" />
              </filter>
              <filter id="cloud-wisp" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="4.5" />
              </filter>
            </defs>

            {/* Ocean Base */}
            <rect width="1440" height="600" fill="url(#earth-ocean-grad)" />

            {/* Continents & Landmasses */}
            <g className="chrono-earth-continents">
              {/* Western Hemisphere Continents & Coastal Reef Shelves */}
              <path
                d="M 40 148 C 90 128, 140 142, 185 130 C 230 118, 280 135, 320 125 C 370 148, 410 185, 385 245 C 365 295, 310 325, 275 365 C 240 405, 185 435, 145 475 L 0 510 L 0 170 Z"
                fill="url(#coastal-shelf-grad)"
                filter="url(#cloud-softness)"
              />
              <path
                d="M 45 152 C 92 133, 142 146, 182 134 C 228 122, 276 138, 315 128 C 362 152, 402 188, 378 246 C 358 294, 305 324, 270 364 C 236 404, 182 434, 142 474 L 0 505 L 0 174 Z"
                fill="url(#continent-west-grad)"
              />
              {/* Western Mountain Ridge Spines */}
              <path
                d="M 182 134 Q 240 210, 270 290 T 220 390"
                stroke="#6c5825"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
                opacity="0.75"
              />

              {/* Caribbean / Pacific Island Archipelago with Cyan Reefs */}
              <g fill="#2d5a27" stroke="#06b6d4" strokeWidth="2">
                <ellipse cx="430" cy="195" rx="12" ry="6" />
                <ellipse cx="465" cy="215" rx="14" ry="7" />
                <ellipse cx="495" cy="240" rx="9" ry="5" />
                <ellipse cx="518" cy="268" rx="15" ry="8" />
                <ellipse cx="538" cy="295" rx="10" ry="5" />
              </g>

              {/* Eastern Hemisphere Continents & Coastal Reef Shelves */}
              <path
                d="M 680 185 C 750 135, 820 145, 890 125 C 960 105, 1040 128, 1120 115 C 1200 95, 1290 120, 1370 108 L 1440 118 L 1440 520 L 780 520 C 730 460, 680 380, 650 310 C 630 250, 640 210, 680 185 Z"
                fill="url(#coastal-shelf-grad)"
                filter="url(#cloud-softness)"
              />
              <path
                d="M 688 190 C 755 140, 824 150, 892 130 C 962 110, 1042 132, 1118 120 C 1198 100, 1288 124, 1365 112 L 1440 122 L 1440 515 L 785 515 C 735 455, 685 378, 655 310 C 636 252, 646 214, 688 190 Z"
                fill="url(#continent-east-grad)"
              />
              {/* Eastern Mountain Relieves (Alps / Himalayas) */}
              <path
                d="M 892 130 Q 980 160, 1070 150 T 1240 170"
                stroke="#5a421b"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
                opacity="0.8"
              />
              {/* Arid desert basin shading (Sahara / Arabian desert) */}
              <ellipse cx="860" cy="230" rx="85" ry="38" fill="#b48238" opacity="0.65" />
              <ellipse cx="940" cy="250" rx="60" ry="30" fill="#c6954b" opacity="0.55" />
            </g>

            {/* Specular Sunlight Glint on Ocean (Visible in Day & Dawn) */}
            {currentPhase !== 'night' && (
              <ellipse
                cx="1010"
                cy="70"
                rx="160"
                ry="36"
                fill="url(#ocean-sun-glint)"
                className="chrono-earth-glint"
              />
            )}

            {/* Photorealistic Satellite Cloud Formations */}
            <g className="chrono-earth-clouds">
              {/* Soft Wispy Background Clouds */}
              <path
                d="M 0 150 Q 240 120, 500 145 T 1000 130 T 1440 135"
                stroke="#ffffff"
                strokeWidth="32"
                strokeLinecap="round"
                fill="none"
                opacity="0.35"
                filter="url(#cloud-wisp)"
              />
              <path
                d="M 60 220 Q 380 180, 680 205 T 1200 195 T 1440 210"
                stroke="#ffffff"
                strokeWidth="28"
                strokeLinecap="round"
                fill="none"
                opacity="0.4"
                filter="url(#cloud-wisp)"
              />

              {/* Crisp Wispy Cyclone Spiral over Pacific */}
              <path
                d="M 440 115 C 475 95, 535 105, 560 130 C 580 150, 570 175, 535 185 C 500 195, 465 170, 480 150 C 495 138, 515 142, 520 155"
                stroke="#ffffff"
                strokeWidth="11"
                strokeLinecap="round"
                fill="none"
                opacity="0.75"
                filter="url(#cloud-softness)"
              />
              {/* Mid-Latitude Cyclonic Storm over Atlantic */}
              <path
                d="M 1160 135 C 1195 115, 1260 120, 1285 145 C 1305 165, 1295 190, 1260 200 C 1225 210, 1190 185, 1205 165 C 1220 152, 1245 155, 1250 168"
                stroke="#ffffff"
                strokeWidth="13"
                strokeLinecap="round"
                fill="none"
                opacity="0.7"
                filter="url(#cloud-softness)"
              />

              {/* Dynamic Trade-Wind Cloud Ribbons */}
              <path
                d="M 20 165 Q 260 135, 520 160 T 1040 145 T 1420 155"
                stroke="#ffffff"
                strokeWidth="16"
                strokeLinecap="round"
                fill="none"
                opacity="0.55"
                filter="url(#cloud-softness)"
              />
              <path
                d="M 120 285 Q 460 250, 800 270 T 1360 260"
                stroke="#ffffff"
                strokeWidth="18"
                strokeLinecap="round"
                fill="none"
                opacity="0.48"
                filter="url(#cloud-softness)"
              />
            </g>

            {/* Nocturnal Golden City Lights (Twinkling networks at Night & Dusk) */}
            <g className="chrono-earth-city-lights">
              {CITY_CLUSTERS_REAL.map((city, i) => (
                <g key={i}>
                  <circle cx={city.cx} cy={city.cy} r={city.r} fill="#fde68a" opacity="0.95" />
                  <circle cx={city.cx} cy={city.cy} r={city.r * 2.8} fill="#f59e0b" opacity="0.38" />
                </g>
              ))}
              <path
                d="M 182 134 Q 240 210, 270 290"
                stroke="#fbbf24"
                strokeWidth="1.2"
                strokeDasharray="2 4"
                fill="none"
                opacity="0.65"
              />
              <path
                d="M 892 130 Q 980 160, 1070 150"
                stroke="#fbbf24"
                strokeWidth="1.2"
                strokeDasharray="2 4"
                fill="none"
                opacity="0.7"
              />
            </g>
          </svg>

          {/* Night Shadow Overlay */}
          <div className="chrono-earth-night-shadow" />

          {/* Glowing Atmospheric Rim (Rayleigh Scattering) */}
          <div className="chrono-atmosphere-rim" />

          {/* Curved Polar Magnetosphere Ribbon (Active in Night/Dusk) */}
          <div className="chrono-aurora-ribbon" />
        </div>

        {/* Orbital Telemetry Satellite Beacon */}
        <div className="chrono-satellite-wrap">
          <button
            type="button"
            onClick={() => setTelemetryOpen(!telemetryOpen)}
            className="chrono-satellite-beacon"
            data-ui-tooltip="Orbital telemetry tracking"
            aria-label="Orbital telemetry beacon"
          >
            <div className="chrono-beacon-dot">
              <span className="chrono-beacon-ping" />
            </div>
            <span className="chrono-telemetry-chip">
              {telemetryOpen ? 'SUPABASE · CONNECTED' : 'ORBITAL SYNC'}
            </span>
          </button>
        </div>

        {/* Shani Companion Spirit Mascot */}
        <div className="chrono-shani-wrap">
          <button
            type="button"
            className="shani-character"
            data-act={shaniAct}
            onClick={handleShaniClick}
            data-ui-tooltip="Shani · Atmospheric Companion"
            aria-label="Interact with Shani"
          >
            <div className="shani-aura" />
            <svg
              viewBox="0 0 64 72"
              className="w-full h-full"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="shani-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--chrono-aurora-color, #38bdf8)" />
                  <stop offset="60%" stopColor="var(--chrono-sun-glow, #0284c7)" />
                  <stop offset="100%" stopColor="var(--chrono-atmo-glow, #0369a1)" />
                </linearGradient>
                <radialGradient id="shani-shine-grad" cx="30%" cy="25%" r="60%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#ffffff" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Little nub arms */}
              <ellipse cx="9" cy="38" rx="4.5" ry="5.5" fill="url(#shani-body-grad)" />
              <ellipse cx="55" cy="38" rx="4.5" ry="5.5" fill="url(#shani-body-grad)" />

              {/* Main rounded dome body with scalloped ghost bottom */}
              <path
                d="M 14 36 C 14 16, 50 16, 50 36 L 50 50 Q 45 44 41 50 Q 37 44 32 50 Q 27 44 23 50 Q 18 44 14 50 Z"
                fill="url(#shani-body-grad)"
              />

              {/* 3D sphere volume shine */}
              <path
                d="M 14 36 C 14 16, 50 16, 50 36 L 50 50 Q 45 44 41 50 Q 37 44 32 50 Q 27 44 23 50 Q 18 44 14 50 Z"
                fill="url(#shani-shine-grad)"
                opacity="0.65"
              />

              {/* Cute little rounded feet */}
              <ellipse cx="23" cy="56" rx="4.5" ry="3.5" fill="url(#shani-body-grad)" />
              <ellipse cx="41" cy="56" rx="4.5" ry="3.5" fill="url(#shani-body-grad)" />

              {/* Head glossy highlight pill */}
              <ellipse
                cx="23"
                cy="21"
                rx="7"
                ry="4"
                transform="rotate(-25 23 21)"
                fill="#ffffff"
                opacity="0.65"
              />

              {/* Rosy blush cheeks */}
              <ellipse cx="19" cy="37" rx="4" ry="2.2" fill="#fb7185" opacity="0.75" />
              <ellipse cx="45" cy="37" rx="4" ry="2.2" fill="#fb7185" opacity="0.75" />

              {/* Adorable shiny eyes */}
              <g className="shani-eyes">
                <circle cx="25" cy="33" r="3.2" fill="#0f172a" />
                <circle cx="26" cy="32" r="1.1" fill="#ffffff" />
              </g>
              <g className="shani-eyes">
                <circle cx="39" cy="33" r="3.2" fill="#0f172a" />
                <circle cx="40" cy="32" r="1.1" fill="#ffffff" />
              </g>

              {/* Joyful smile */}
              <path
                d="M 29 37 Q 32 40 35 37"
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>

            {/* Micro heart bursts on click */}
            <div className="shani-hearts" aria-hidden="true">
              {shaniHearts.map((h) => (
                <i key={h.id} style={{ '--dx': `${h.dx}px` } as React.CSSProperties}>
                  ♥
                </i>
              ))}
            </div>

            {/* Speech bubble */}
            {shaniSay && (
              <div className="shani-bubble" role="status">
                {shaniSay}
              </div>
            )}
          </button>
        </div>

        {/* Headline Typography & Daily Atmosphere Context */}
        <div className="chrono-copy">
          <div className="chrono-eyebrow">
            <span>{formattedDate}</span>
            <span className="h-1 w-1 rounded-full bg-current opacity-40" />
            <span className="font-mono text-[9.5px] uppercase opacity-75">
              {currentPhase.toUpperCase()} HORIZON
            </span>
          </div>

          <h1 className="chrono-hello">
            <span style={{ animationDelay: '80ms' }}>
              {greetingText}{userName ? `, ${userName}` : ''}
            </span>
          </h1>

          <p className="chrono-line">{CHRONO_LINES[currentPhase]}</p>
        </div>

        {/* Atmosphere Phase Picker Controls */}
        <fieldset className="chrono-phase-pick" aria-label="Daytime Atmosphere Mode">
          <legend className="sr-only">Atmosphere Phase</legend>
          <button
            type="button"
            aria-pressed={phaseMode === 'live'}
            onClick={() => setPhaseMode('live')}
            data-ui-tooltip="Real-time wall clock tracking"
          >
            Live
          </button>
          <button
            type="button"
            aria-pressed={phaseMode === 'dawn'}
            onClick={() => setPhaseMode('dawn')}
            data-ui-tooltip="Dawn planetary sunrise"
          >
            Dawn
          </button>
          <button
            type="button"
            aria-pressed={phaseMode === 'day'}
            onClick={() => setPhaseMode('day')}
            data-ui-tooltip="Daylight solar zenith"
          >
            Day
          </button>
          <button
            type="button"
            aria-pressed={phaseMode === 'dusk'}
            onClick={() => setPhaseMode('dusk')}
            data-ui-tooltip="Dusk terminator twilight"
          >
            Dusk
          </button>
          <button
            type="button"
            aria-pressed={phaseMode === 'night'}
            onClick={() => setPhaseMode('night')}
            data-ui-tooltip="Midnight deep cosmos & city lights"
          >
            Night
          </button>
        </fieldset>
      </div>
    </div>
  )
}

export default memo(ChronosphereHero)

