/**
 * Colour themes layered on top of the existing light/dark token system.
 *
 * The app's CSS tokens are HSL triplets consumed as `hsl(var(--primary))`,
 * so every hex from a theme is converted before it is written to the root.
 * `data-theme` still owns light/dark; a theme supplies a complete palette for
 * BOTH modes, so switching theme never leaves parts of the UI on the neutral
 * base palette.
 */

export type ThemeMode = 'light' | 'dark'

export interface ThemePalette {
  primary?: string
  primaryForeground?: string
  ring?: string
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  border: string
  input: string
  sidebar: string
}

export interface Theme {
  id: string
  name: string
  /** hex */
  primary: string
  /** hex, text on primary */
  primaryFg: string
  /** hex */
  accent: string
  /** hex */
  ring: string
  /** rgba() */
  glow: string
  /** Cream-style themes ignore the dark toggle. */
  lightOnly?: boolean
  custom?: boolean
  /** Explicit hex overrides, merged over the derived palette. */
  palette?: {
    light?: Partial<ThemePalette>
    dark?: Partial<ThemePalette>
  }
}

export const DEFAULT_THEME_ID = 'violet'

export const THEMES: Theme[] = [
  {
    id: 'violet',
    name: 'Violet',
    primary: '#8b5cf6',
    primaryFg: '#ffffff',
    accent: '#a78bfa',
    ring: '#8b5cf6',
    glow: 'rgba(139,92,246,0.4)',
  },
  {
    id: 'alabaster',
    name: 'Alabaster',
    primary: '#78350f',
    primaryFg: '#ffffff',
    accent: '#d97706',
    ring: '#78350f',
    glow: 'rgba(120,53,15,0.25)',
    palette: {
      light: {
        background: '#f3f0e8',
        foreground: '#292524',
        card: '#faf7f0',
        cardForeground: '#292524',
        popover: '#faf7f0',
        popoverForeground: '#292524',
        secondary: '#e9e4d7',
        secondaryForeground: '#292524',
        muted: '#e9e4d7',
        mutedForeground: '#78716c',
        accent: '#dfd8ca',
        accentForeground: '#1c1917',
        border: '#ded7c9',
        input: '#ded7c9',
        sidebar: '#eee9df',
      },
      dark: {
        background: '#191816',
        foreground: '#f5f5f4',
        card: '#262421',
        cardForeground: '#f5f5f4',
        popover: '#262421',
        popoverForeground: '#f5f5f4',
        secondary: '#322f2b',
        secondaryForeground: '#f5f5f4',
        muted: '#322f2b',
        mutedForeground: '#a8a29e',
        accent: '#3f3b36',
        accentForeground: '#f5f5f4',
        border: '#3d3934',
        input: '#3d3934',
        sidebar: '#141312',
      },
    },
  },
  {
    id: 'shiori',
    name: 'Shiori',
    primary: '#10b981',
    primaryFg: '#ffffff',
    accent: '#34d399',
    ring: '#10b981',
    glow: 'rgba(16,185,129,0.45)',
  },
  {
    id: 'almanac',
    name: 'Almanac',
    primary: '#6366f1',
    primaryFg: '#ffffff',
    accent: '#fbbf24',
    ring: '#6366f1',
    glow: 'rgba(99,102,241,0.45)',
  },
  {
    id: 'hedgerow',
    name: 'Hedgerow',
    primary: '#16a34a',
    primaryFg: '#ffffff',
    accent: '#a3e635',
    ring: '#16a34a',
    glow: 'rgba(22,163,74,0.45)',
  },
  {
    id: 'sport',
    name: 'Sport',
    primary: '#2563eb',
    primaryFg: '#ffffff',
    accent: '#f43f5e',
    ring: '#2563eb',
    glow: 'rgba(37,99,235,0.45)',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    primary: '#059669',
    primaryFg: '#ffffff',
    accent: '#10b981',
    ring: '#059669',
    glow: 'rgba(5,150,105,0.4)',
  },
  {
    id: 'rose',
    name: 'Rose',
    primary: '#f43f5e',
    primaryFg: '#ffffff',
    accent: '#fb7185',
    ring: '#f43f5e',
    glow: 'rgba(244,63,94,0.4)',
  },
  {
    id: 'pink',
    name: 'Light Pink',
    primary: '#f472b6',
    primaryFg: '#ffffff',
    accent: '#fbcfe8',
    ring: '#f472b6',
    glow: 'rgba(244,114,182,0.45)',
  },
  {
    id: 'amber',
    name: 'Amber',
    primary: '#f59e0b',
    primaryFg: '#000000',
    accent: '#fbbf24',
    ring: '#f59e0b',
    glow: 'rgba(245,158,11,0.4)',
  },
  {
    id: 'sky',
    name: 'Sky',
    primary: '#0ea5e9',
    primaryFg: '#ffffff',
    accent: '#38bdf8',
    ring: '#0ea5e9',
    glow: 'rgba(14,165,233,0.4)',
  },
  {
    id: 'crimson',
    name: 'Crimson',
    primary: '#dc2626',
    primaryFg: '#ffffff',
    accent: '#ef4444',
    ring: '#dc2626',
    glow: 'rgba(220,38,38,0.4)',
  },
  {
    id: 'slate',
    name: 'Slate',
    primary: '#64748b',
    primaryFg: '#ffffff',
    accent: '#94a3b8',
    ring: '#64748b',
    glow: 'rgba(100,116,139,0.4)',
  },
  {
    id: 'monochrome',
    name: 'Mono',
    primary: '#e5e5e5',
    primaryFg: '#0a0a0a',
    accent: '#d4d4d4',
    ring: '#e5e5e5',
    glow: 'rgba(229,229,229,0.3)',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    primary: '#eeeeee',
    primaryFg: '#0a0a0a',
    accent: '#a3a3a3',
    ring: '#d4d4d4',
    glow: 'rgba(163,163,163,0.06)',
    palette: {
      dark: {
        background: '#0a0a0a',
        foreground: '#f5f5f5',
        card: '#171717',
        cardForeground: '#f5f5f5',
        popover: '#171717',
        popoverForeground: '#f5f5f5',
        secondary: '#262626',
        secondaryForeground: '#f5f5f5',
        muted: '#202020',
        mutedForeground: '#a3a3a3',
        accent: '#262626',
        accentForeground: '#f5f5f5',
        border: '#303030',
        input: '#404040',
        sidebar: '#0a0a0a',
      },
      light: {
        primary: '#171717',
        primaryForeground: '#ffffff',
        ring: '#404040',
        background: '#fafafa',
        foreground: '#171717',
        card: '#ffffff',
        cardForeground: '#171717',
        popover: '#ffffff',
        popoverForeground: '#171717',
        secondary: '#ededed',
        secondaryForeground: '#171717',
        muted: '#f0f0f0',
        mutedForeground: '#666666',
        accent: '#e5e5e5',
        accentForeground: '#171717',
        border: '#dedede',
        input: '#b3b3b3',
        sidebar: '#f5f5f5',
      },
    },
  },
  {
    id: 'cream',
    name: 'Cream',
    primary: '#a67c52',
    primaryFg: '#ffffff',
    accent: '#d4a574',
    ring: '#a67c52',
    glow: 'rgba(166,124,82,0.28)',
    palette: {
      light: {
        background: '#fdfbf6',
        foreground: '#443d33',
        card: '#fcfaf4',
        cardForeground: '#443d33',
        popover: '#fcfaf4',
        popoverForeground: '#443d33',
        secondary: '#f8f2e8',
        secondaryForeground: '#443d33',
        muted: '#f8f2e8',
        mutedForeground: '#877c6b',
        accent: '#f4ecdd',
        accentForeground: '#443d33',
        border: '#f0e8da',
        input: '#f0e8da',
        sidebar: '#fdfbf5',
      },
      dark: {
        background: '#1c1917',
        foreground: '#f5f5f4',
        card: '#292524',
        cardForeground: '#f5f5f4',
        popover: '#292524',
        popoverForeground: '#f5f5f4',
        secondary: '#44403c',
        secondaryForeground: '#f5f5f4',
        muted: '#292524',
        mutedForeground: '#a8a29e',
        accent: '#57534e',
        accentForeground: '#f5f5f4',
        border: '#44403c',
        input: '#44403c',
        sidebar: '#1c1917',
      },
    },
  },
]

const STORAGE_KEY = 'context:theme'
const CUSTOM_KEY = 'context:custom-theme'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** #rrggbb (or #rgb) → { h, s, l } */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let value = hex.trim().replace('#', '')
  if (value.length === 3) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return { h: 262.1, s: 83.3, l: 57.8 }

  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2

  let h = 0
  let s = 0
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }

  return {
    h: Math.round(h * 10) / 10,
    s: Math.round(s * 1000) / 10,
    l: Math.round(l * 1000) / 10,
  }
}

/** HSL triplet string for the app's `hsl(var(--token))` system. */
export function hexToHslTriplet(hex: string): string {
  const { h, s, l } = hexToHsl(hex)
  return `${h} ${s}% ${l}%`
}

export function hslToHex(h: number, s: number, l: number): string {
  const saturation = clamp(s, 0, 100) / 100
  const lightness = clamp(l, 0, 100) / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lightness - chroma / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [chroma, x, 0]
  else if (h < 120) [r, g, b] = [x, chroma, 0]
  else if (h < 180) [r, g, b] = [0, chroma, x]
  else if (h < 240) [r, g, b] = [0, x, chroma]
  else if (h < 300) [r, g, b] = [x, 0, chroma]
  else [r, g, b] = [chroma, 0, x]
  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Derive a complete palette from the theme's primary colour.
 *
 * Only the hue/saturation are reused, so every preset (and every custom hex)
 * gets a cohesive background, card, border, muted and sidebar instead of the
 * neutral base palette.
 */
function derivePalette(theme: Theme, mode: ThemeMode): ThemePalette {
  const { h, s } = hexToHsl(theme.primary)

  if (mode === 'dark') {
    // Keep the dark canvas dark, but let the theme hue live in the surfaces.
    // The previous 22% cap made every dark theme look like the same mono
    // palette; 34% is enough to read as violet/emerald/rose without turning
    // the app into a neon wall.
    const surfaceSat = clamp(s * 0.38, 6, 34)
    const foreground = hslToHex(h, Math.min(s * 0.18, 16), 97)
    return {
      background: hslToHex(h, surfaceSat * 0.55, 8.6),
      foreground,
      card: hslToHex(h, surfaceSat * 0.72, 12.8),
      cardForeground: foreground,
      popover: hslToHex(h, surfaceSat * 0.72, 13.8),
      popoverForeground: foreground,
      secondary: hslToHex(h, surfaceSat * 0.9, 17.5),
      secondaryForeground: foreground,
      muted: hslToHex(h, surfaceSat * 0.9, 16.5),
      mutedForeground: hslToHex(h, Math.min(s * 0.14, 10), 68),
      accent: hslToHex(h, surfaceSat * 0.9, 20.0),
      accentForeground: foreground,
      border: hslToHex(h, surfaceSat * 0.9, 22.5),
      input: hslToHex(h, surfaceSat * 0.9, 22.5),
      sidebar: hslToHex(h, surfaceSat * 0.5, 7.8),
    }
  }

  const tintSat = clamp(s * 0.6, 8, 52)
  const foreground = hslToHex(h, Math.min(s * 0.4, 28), 10)
  const secondary = hslToHex(h, tintSat * 0.8, 93.5)
  const border = hslToHex(h, tintSat * 0.6, 86)
  return {
    background: hslToHex(h, tintSat * 0.9, 96.8),
    foreground,
    card: hslToHex(h, tintSat * 0.35, 99),
    cardForeground: foreground,
    popover: hslToHex(h, tintSat * 0.35, 99),
    popoverForeground: foreground,
    secondary,
    secondaryForeground: foreground,
    muted: secondary,
    mutedForeground: hslToHex(h, Math.min(s * 0.28, 14), 43),
    accent: hslToHex(h, tintSat * 0.85, 91),
    accentForeground: foreground,
    border,
    input: border,
    sidebar: hslToHex(h, tintSat * 0.9, 95.2),
  }
}

/** Complete palette for a theme in a given mode (explicit overrides win). */
export function paletteFor(theme: Theme, mode: ThemeMode): ThemePalette {
  return {
    ...derivePalette(theme, mode),
    ...(theme.palette?.[mode] ?? {}),
  }
}

/** Build a full custom theme from a single hex colour. */
export function customThemeFromHex(input: string): Theme {
  let hex = input.trim()
  if (!hex.startsWith('#')) hex = `#${hex}`
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) hex = '#8b5cf6'
  const { h, s, l } = hexToHsl(hex)
  // Dark text on light primaries; white everywhere else.
  const primaryFg = l > 62 ? '#0a0a0a' : '#ffffff'
  const accent = hslToHex(h, Math.min(100, s + 6), Math.min(92, l + 12))
  const ring = hex
  return {
    id: `custom-${hex.replace('#', '').toLowerCase()}`,
    name: 'Custom',
    primary: hex,
    primaryFg,
    accent,
    ring,
    glow: `hsla(${h}, ${clamp(s, 20, 100)}%, ${clamp(l, 30, 70)}%, 0.4)`,
    custom: true,
  }
}

export function getCustomTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Theme
    if (!parsed || typeof parsed.primary !== 'string' || typeof parsed.id !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveCustomTheme(theme: Theme) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(theme))
  } catch {
    // storage unavailable
  }
}

/** All presets, plus the saved custom theme when present. */
export function getThemeList(): Theme[] {
  const custom = getCustomTheme()
  return custom ? [...THEMES, custom] : [...THEMES]
}

export function resolveTheme(themeId: string): Theme {
  return (
    getThemeList().find((theme) => theme.id === themeId) ??
    THEMES[0]
  )
}

export function getCurrentTheme(): string {
  try {
    const id = localStorage.getItem(STORAGE_KEY)
    if (!id) return THEMES[0].id
    const known = getThemeList().some((theme) => theme.id === id)
    return known ? id : THEMES[0].id
  } catch {
    return THEMES[0].id
  }
}

function setToken(root: HTMLElement, token: string, hex: string | undefined) {
  if (hex) root.style.setProperty(token, hexToHslTriplet(hex))
}

export function applyTheme(themeId: string, explicitMode?: ThemeMode) {
  if (typeof document === 'undefined') return
  const theme = resolveTheme(themeId)
  const root = document.documentElement
  const mode: ThemeMode = explicitMode ?? (root.dataset.theme === 'light' ? 'light' : 'dark')
  root.dataset.theme = mode
  root.style.colorScheme = mode
  const palette = paletteFor(theme, mode)
  const primary = palette.primary ?? theme.primary
  const primaryForeground = palette.primaryForeground ?? theme.primaryFg

  setToken(root, '--background', palette.background)
  setToken(root, '--foreground', palette.foreground)
  setToken(root, '--card', palette.card)
  setToken(root, '--card-foreground', palette.cardForeground)
  setToken(root, '--popover', palette.popover)
  setToken(root, '--popover-foreground', palette.popoverForeground)
  setToken(root, '--primary', primary)
  setToken(root, '--primary-foreground', primaryForeground)
  setToken(root, '--secondary', palette.secondary)
  setToken(root, '--secondary-foreground', palette.secondaryForeground)
  setToken(root, '--muted', palette.muted)
  setToken(root, '--muted-foreground', palette.mutedForeground)
  setToken(root, '--accent', palette.accent)
  setToken(root, '--accent-foreground', palette.accentForeground)
  setToken(root, '--border', palette.border)
  setToken(root, '--input', palette.input)
  setToken(root, '--ring', palette.ring ?? theme.ring)
  setToken(root, '--sidebar', palette.sidebar)

  // Brand colours used by gradients, glow and confetti.
  root.style.setProperty('--theme-accent', hexToHslTriplet(theme.accent))
  root.style.setProperty('--theme-glow', theme.glow)
  root.style.setProperty('--primary-hex', primary)
  root.style.setProperty('--theme-accent-hex', theme.accent)

  // Surfaces follow the mode so overlays stay legible on any background.
  if (mode === 'dark') {
    root.style.setProperty('--surface-1', 'rgba(255, 255, 255, 0.022)')
    root.style.setProperty('--surface-2', 'rgba(255, 255, 255, 0.045)')
    root.style.setProperty('--surface-3', 'rgba(255, 255, 255, 0.065)')
    root.style.setProperty('--surface-inset', 'rgba(0, 0, 0, 0.3)')
    root.style.setProperty('--hairline', 'rgba(255, 255, 255, 0.08)')
  } else {
    root.style.setProperty('--surface-1', 'rgba(15, 15, 20, 0.025)')
    root.style.setProperty('--surface-2', 'rgba(15, 15, 20, 0.045)')
    root.style.setProperty('--surface-3', 'rgba(15, 15, 20, 0.07)')
    root.style.setProperty('--surface-inset', 'rgba(15, 15, 20, 0.035)')
    root.style.setProperty('--hairline', 'rgba(15, 15, 20, 0.08)')
  }

  root.dataset.colorTheme = theme.id

  if (theme.lightOnly) {
    root.dataset.theme = 'light'
    root.style.colorScheme = 'light'
    try {
      localStorage.setItem('context-theme', 'light')
    } catch {
      // ignore
    }
  }

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', palette.background)

  try {
    localStorage.setItem(STORAGE_KEY, theme.id)
  } catch {
    // ignore
  }

  window.dispatchEvent(new CustomEvent('context:theme-changed', { detail: theme.id }))
}

export function isLightOnlyTheme(themeId: string): boolean {
  return Boolean(resolveTheme(themeId).lightOnly)
}
