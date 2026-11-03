import { create } from 'zustand'
import { applyTheme as applyColorTheme, getCurrentTheme } from '@/lib/themes'

export type Theme = 'dark' | 'light'
export type NavStyle = 'sidebar' | 'topbar'
export type ContentWidth = 'standard' | 'wide' | 'fit'
export type InterfaceSize = 'fit' | 'compact' | 'default' | 'large'
export type OpensOn = 'last' | 'today'
export type AutoThemeMode = 'time-of-day' | 'interval'

export interface AutoThemeDayMapping {
  dawn: string
  day: string
  dusk: string
  night: string
}

const DEFAULT_THEME_POOL = [
  'shiori',
  'almanac',
  'hedgerow',
  'sport',
  'violet',
  'emerald',
  'rose',
  'pink',
  'amber',
  'sky',
]

const DEFAULT_DAY_MAPPING: AutoThemeDayMapping = {
  dawn: 'amber',
  day: 'sky',
  dusk: 'rose',
  night: 'almanac',
}

function getInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  try {
    const stored = localStorage.getItem('context-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {}
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function getStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  applyColorTheme(getCurrentTheme(), theme)
  try {
    localStorage.setItem('context-theme', theme)
  } catch {
    // storage can be unavailable
  }
}

interface UIState {
  interfaceSize: InterfaceSize
  setInterfaceSize: (size: InterfaceSize) => void
  opensOn: OpensOn
  setOpensOn: (value: OpensOn) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  soundEnabled: boolean
  toggleSound: () => void

  quickBarOpen: boolean
  setQuickBarOpen: (open: boolean) => void

  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void

  // Shiori-level layout & craft state
  navStyle: NavStyle
  setNavStyle: (style: NavStyle) => void

  scoreboardClock: boolean
  setScoreboardClock: (on: boolean) => void

  contentWidth: ContentWidth
  setContentWidth: (width: ContentWidth) => void

  autoRotateLook: boolean
  setAutoRotateLook: (on: boolean) => void

  autoThemeEnabled: boolean
  setAutoThemeEnabled: (on: boolean) => void

  autoThemeMode: AutoThemeMode
  setAutoThemeMode: (mode: AutoThemeMode) => void

  autoThemeIntervalMinutes: number
  setAutoThemeIntervalMinutes: (mins: number) => void

  autoThemePool: string[]
  toggleThemeInPool: (themeId: string) => void
  setAutoThemePool: (pool: string[]) => void

  autoThemeDayMapping: AutoThemeDayMapping
  setAutoThemeDayMapping: (mapping: Partial<AutoThemeDayMapping>) => void

  lastThemeChangeTimestamp: number
  setLastThemeChangeTimestamp: (ts: number) => void

  hiddenSections: string[]
  toggleSection: (path: string) => void

  privacyPin: string | null
  setPrivacyPin: (pin: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  interfaceSize: (['fit', 'compact', 'default', 'large'].includes(localStorage.getItem('context:interface-size') || '')
    ? localStorage.getItem('context:interface-size') : 'default') as InterfaceSize,
  setInterfaceSize: interfaceSize => {
    try { localStorage.setItem('context:interface-size', interfaceSize) } catch {}
    document.documentElement.dataset.interfaceSize = interfaceSize
    set({ interfaceSize })
  },
  opensOn: localStorage.getItem('context:opens-on') === 'last' ? 'last' : 'today',
  setOpensOn: opensOn => {
    try { localStorage.setItem('context:opens-on', opensOn) } catch {}
    set({ opensOn })
  },
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  soundEnabled: false,
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

  quickBarOpen: false,
  setQuickBarOpen: (open) => set({ quickBarOpen: open }),

  theme: getInitialTheme(),
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () =>
    set((s) => {
      const theme: Theme = s.theme === 'dark' ? 'light' : 'dark'
      applyTheme(theme)
      return { theme }
    }),

  navStyle: (localStorage.getItem('context:nav-style') as NavStyle) || 'sidebar',
  setNavStyle: (navStyle) => {
    try {
      localStorage.setItem('context:nav-style', navStyle)
    } catch {}
    set({ navStyle })
  },

  scoreboardClock: getStoredJson('context:scoreboard-clock', true),
  setScoreboardClock: (scoreboardClock) => {
    try {
      localStorage.setItem('context:scoreboard-clock', JSON.stringify(scoreboardClock))
    } catch {}
    set({ scoreboardClock })
  },

  contentWidth: (localStorage.getItem('context:content-width') as ContentWidth) || 'standard',
  setContentWidth: (contentWidth) => {
    try {
      localStorage.setItem('context:content-width', contentWidth)
    } catch {}
    set({ contentWidth })
  },

  autoRotateLook: getStoredJson('context:auto-theme-enabled', getStoredJson('context:auto-rotate-look', false)),
  setAutoRotateLook: (autoRotateLook) => {
    try {
      localStorage.setItem('context:auto-rotate-look', JSON.stringify(autoRotateLook))
      localStorage.setItem('context:auto-theme-enabled', JSON.stringify(autoRotateLook))
    } catch {}
    set({ autoRotateLook, autoThemeEnabled: autoRotateLook })
  },

  autoThemeEnabled: getStoredJson('context:auto-theme-enabled', getStoredJson('context:auto-rotate-look', false)),
  setAutoThemeEnabled: (autoThemeEnabled) => {
    try {
      localStorage.setItem('context:auto-theme-enabled', JSON.stringify(autoThemeEnabled))
      localStorage.setItem('context:auto-rotate-look', JSON.stringify(autoThemeEnabled))
    } catch {}
    set({ autoThemeEnabled, autoRotateLook: autoThemeEnabled })
  },

  autoThemeMode: (localStorage.getItem('context:auto-theme-mode') as AutoThemeMode) || 'time-of-day',
  setAutoThemeMode: (autoThemeMode) => {
    try {
      localStorage.setItem('context:auto-theme-mode', autoThemeMode)
    } catch {}
    set({ autoThemeMode })
  },

  autoThemeIntervalMinutes: getStoredJson('context:auto-theme-interval', 30),
  setAutoThemeIntervalMinutes: (autoThemeIntervalMinutes) => {
    try {
      localStorage.setItem('context:auto-theme-interval', JSON.stringify(autoThemeIntervalMinutes))
    } catch {}
    set({ autoThemeIntervalMinutes })
  },

  autoThemePool: getStoredJson('context:auto-theme-pool', DEFAULT_THEME_POOL),
  toggleThemeInPool: (themeId) =>
    set((s) => {
      const next = s.autoThemePool.includes(themeId)
        ? s.autoThemePool.filter((id) => id !== themeId)
        : [...s.autoThemePool, themeId]
      try {
        localStorage.setItem('context:auto-theme-pool', JSON.stringify(next))
      } catch {}
      return { autoThemePool: next }
    }),
  setAutoThemePool: (autoThemePool) => {
    try {
      localStorage.setItem('context:auto-theme-pool', JSON.stringify(autoThemePool))
    } catch {}
    set({ autoThemePool })
  },

  autoThemeDayMapping: getStoredJson('context:auto-theme-day-map', DEFAULT_DAY_MAPPING),
  setAutoThemeDayMapping: (mapping) =>
    set((s) => {
      const next = { ...s.autoThemeDayMapping, ...mapping }
      try {
        localStorage.setItem('context:auto-theme-day-map', JSON.stringify(next))
      } catch {}
      return { autoThemeDayMapping: next }
    }),

  lastThemeChangeTimestamp: getStoredJson('context:auto-theme-last-ts', Date.now()),
  setLastThemeChangeTimestamp: (lastThemeChangeTimestamp) => {
    try {
      localStorage.setItem('context:auto-theme-last-ts', JSON.stringify(lastThemeChangeTimestamp))
    } catch {}
    set({ lastThemeChangeTimestamp })
  },

  hiddenSections: getStoredJson('context:hidden-sections', []),
  toggleSection: (path) =>
    set((s) => {
      const next = s.hiddenSections.includes(path)
        ? s.hiddenSections.filter((p) => p !== path)
        : [...s.hiddenSections, path]
      try {
        localStorage.setItem('context:hidden-sections', JSON.stringify(next))
      } catch {}
      return { hiddenSections: next }
    }),

  privacyPin: localStorage.getItem('context:privacy-pin') || null,
  setPrivacyPin: (privacyPin) => {
    try {
      if (privacyPin) localStorage.setItem('context:privacy-pin', privacyPin)
      else localStorage.removeItem('context:privacy-pin')
    } catch {}
    set({ privacyPin })
  },
}))
