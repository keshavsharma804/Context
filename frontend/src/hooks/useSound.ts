import { useCallback, useEffect, useRef } from 'react'
import { Howl, Howler } from 'howler'

export type SoundName = 'pop' | 'click' | 'chime' | 'thud' | 'bell' | 'swoosh'

const VOLUMES: Record<SoundName, number> = {
  pop: 0.38,
  click: 0.14,
  chime: 0.34,
  thud: 0.3,
  bell: 0.34,
  swoosh: 0.28,
}

/** Synth fallbacks, tuned close to the sound files, used if a file can't load. */
const SYNTH: Record<
  SoundName,
  { freq: number; duration: number; type: OscillatorType; volume: number; slide?: number }
> = {
  pop: { freq: 880, duration: 0.08, type: 'sine', volume: 0.12, slide: 440 },
  click: { freq: 1400, duration: 0.03, type: 'sine', volume: 0.05 },
  chime: { freq: 784, duration: 0.35, type: 'sine', volume: 0.1 },
  thud: { freq: 150, duration: 0.16, type: 'square', volume: 0.1, slide: 100 },
  bell: { freq: 1046, duration: 0.5, type: 'sine', volume: 0.1, slide: 523 },
  swoosh: { freq: 600, duration: 0.22, type: 'triangle', volume: 0.08, slide: 200 },
}

const sounds: Partial<Record<SoundName, Howl>> = {}
const failed = new Set<SoundName>()

if (typeof window !== 'undefined') {
  try {
    Howler.autoUnlock = true
    Howler.volume(1)
  } catch {
    // no audio context in this environment
  }
}

function ensureSound(name: SoundName): Howl | null {
  if (failed.has(name)) return null
  if (!sounds[name]) {
    try {
      sounds[name] = new Howl({
        src: [`/sounds/${name}.mp3`],
        volume: VOLUMES[name],
        preload: true,
        html5: false,
        onloaderror: () => {
          failed.add(name)
        },
        onplayerror: () => {
          // A suspended audio context on mobile — retry once after unlocking.
          try {
            Howler.ctx?.resume()
            sounds[name]?.play()
          } catch {
            failed.add(name)
          }
        },
      })
    } catch {
      failed.add(name)
      return null
    }
  }
  return sounds[name] ?? null
}

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

function playSynthetic(name: SoundName) {
  const config = SYNTH[name]
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = config.type
  osc.frequency.setValueAtTime(config.freq, now)
  if (config.slide) {
    osc.frequency.exponentialRampToValueAtTime(config.slide, now + config.duration)
  }
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(config.volume, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + config.duration + 0.05)
}

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem('context:sound-enabled') !== 'false'
  } catch {
    return true
  }
}

export function toggleSound(): boolean {
  const next = !isSoundEnabled()
  try {
    localStorage.setItem('context:sound-enabled', String(next))
  } catch {
    // storage may be unavailable
  }
  return next
}

/** Plays a sound once. Used outside hooks (celebrations, effects). */
export function playSound(name: SoundName) {
  if (!isSoundEnabled()) return
  const sound = ensureSound(name)
  if (!sound) {
    playSynthetic(name)
    return
  }
  try {
    sound.play()
  } catch {
    playSynthetic(name)
  }
}

/** Preload all six files once the app is idle. */
export function preloadSounds() {
  const names: SoundName[] = ['pop', 'click', 'chime', 'thud', 'bell', 'swoosh']
  names.forEach((name) => ensureSound(name))
}

export function useSound(name: SoundName) {
  const soundRef = useRef<Howl | null>(null)

  useEffect(() => {
    soundRef.current = ensureSound(name)
  }, [name])

  return useCallback(() => {
    if (!isSoundEnabled()) return
    if (!soundRef.current) {
      playSound(name)
      return
    }
    try {
      soundRef.current.play()
    } catch {
      playSynthetic(name)
    }
  }, [name])
}
