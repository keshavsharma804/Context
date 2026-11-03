import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarDays,
  Check,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  HandCoins,
  KeyRound,
  Layout,
  LayoutDashboard,
  Lock,
  Mail,
  Moon,
  Palette,
  PiggyBank,
  RefreshCw,
  Repeat,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  fetchConfig,
  fetchDataExport,
  postCalendarClear,
  postCalendarUpload,
  postDataClear,
  postGmailConnect,
  postGmailDisconnect,
  postGmailFetch,
  postGroqConnect,
  postGroqDisconnect,
  postRescan,
  postVaultWipe,
} from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SpinnerArc } from '@/components/motion/SpinnerArc'
import { celebrateConnection } from '@/lib/celebrate'
import { isSoundEnabled, playSound, toggleSound, useSound } from '@/hooks/useSound'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useUIStore, type NavStyle, type ContentWidth, type AutoThemeMode, type AutoThemeDayMapping } from '@/store/ui'
import { useAutoThemeScheduler, getNextPhaseTime, type DayPhase } from '@/hooks/useAutoThemeScheduler'
import {
  THEMES,
  applyTheme,
  getCurrentTheme,
  type Theme as ColorTheme,
} from '@/lib/themes'
import {
  initialsFromName,
  readAvatarFile,
  setUserAvatar,
  setUserName,
} from '@/lib/profile'
import { useProfile } from '@/hooks/useProfile'
import { cn } from '@/lib/utils'
import { AuthSection } from '@/components/settings/AuthSection'

type SettingsTab = 'appearance' | 'account' | 'sections' | 'privacy' | 'integrations' | 'profile'

/* ─── Scoreboard Clock Component (Cricket Scoreboard Style) ─────────────────── */
function ScoreboardClock() {
  const [now, setNow] = useState(new Date())
  const [is24h, setIs24h] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const hours = is24h
    ? String(now.getHours()).padStart(2, '0')
    : String(now.getHours() % 12 || 12).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM'

  return (
    <div
      onClick={() => setIs24h(!is24h)}
      className="group relative cursor-pointer select-none rounded-2xl border border-border/70 bg-card/70 p-4 transition-all duration-200 hover:border-primary/40 hover:bg-card"
      title="Tap to toggle 12h / 24h format"
    >
      <div className="flex items-center justify-between text-muted-foreground mb-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          <Clock className="h-3.5 w-3.5 text-primary" />
          Scoreboard Clock · IST
        </span>
        <span className="text-[10px] text-muted-foreground/60 group-hover:text-primary transition-colors">
          {is24h ? '24-hour' : '12-hour (tap to flip)'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Hours Tile */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/80 bg-surface-2 px-3.5 py-2 shadow-inner">
          <span className="font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {hours}
          </span>
          <span className="text-[8px] uppercase font-semibold text-muted-foreground/60">Hours</span>
        </div>

        <span className="text-xl font-bold text-primary/70 animate-pulse">:</span>

        {/* Minutes Tile */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/80 bg-surface-2 px-3.5 py-2 shadow-inner">
          <span className="font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {minutes}
          </span>
          <span className="text-[8px] uppercase font-semibold text-muted-foreground/60">Mins</span>
        </div>

        <span className="text-xl font-bold text-primary/70 animate-pulse">:</span>

        {/* Seconds Tile */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2 shadow-inner">
          <span className="font-mono text-2xl font-bold tracking-tight text-primary tabular-nums">
            {seconds}
          </span>
          <span className="text-[8px] uppercase font-semibold text-primary/70">Secs</span>
        </div>

        {!is24h && (
          <div className="ml-1 rounded-lg border border-border/60 bg-surface-1 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
            {ampm}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Hold-to-Confirm Button ─────────────────────────────────────────────────── */
function HoldButton({
  label,
  holdLabel,
  onComplete,
  disabled,
}: {
  label: string
  holdLabel: string
  onComplete: () => void
  disabled?: boolean
}) {
  const [holding, setHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const timer = useRef<number | null>(null)

  const stop = () => {
    if (timer.current) window.clearInterval(timer.current)
    timer.current = null
    setHolding(false)
    setProgress(0)
  }

  useEffect(() => () => stop(), [])

  const start = () => {
    if (disabled || holding) return
    setHolding(true)
    const started = Date.now()
    timer.current = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - started) / 2000) * 100)
      setProgress(pct)
      if (pct >= 100) {
        stop()
        onComplete()
      }
    }, 20)
  }

  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      disabled={disabled}
      className={cn(
        'relative flex h-9 select-none items-center justify-center overflow-hidden rounded-xl border border-red-500/30 bg-red-500/[0.07] px-4 text-[12px] font-medium text-red-400 transition-colors hover:bg-red-500/[0.12] disabled:opacity-50 light:text-red-600'
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-red-500/25 transition-[width] duration-75"
        style={{ width: `${progress}%` }}
      />
      <span className="relative flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5" />
        {holding ? `${holdLabel}… ${Math.round(progress)}%` : label}
      </span>
    </button>
  )
}

/* ─── Wipe Vault Modal ──────────────────────────────────────────────────────── */
function WipeVaultDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const playThud = useSound('thud')
  const [text, setText] = useState('')

  const wipe = useMutation({
    mutationFn: () => postVaultWipe({ confirm: text }),
    onSuccess: () => {
      playThud()
      toast.success('Vault wiped and reset')
      queryClient.invalidateQueries({ queryKey: ['vault'] })
      onClose()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not wipe vault')
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <motion.button
        aria-label="Close"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.form
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        onSubmit={(event) => {
          event.preventDefault()
          if (text === 'DELETE VAULT') wipe.mutate()
        }}
        className="relative w-full max-w-sm rounded-2xl border border-red-500/25 bg-popover p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400 light:text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Wipe Secure Vault</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          This deletes ALL encrypted vault items AND the vault master salt. Your sensitive data
          cannot be recovered after wiping.
        </p>
        <p className="mt-3 text-[10px] text-muted-foreground/70">
          Type <span className="font-mono font-semibold text-foreground">DELETE VAULT</span> to confirm.
        </p>
        <Input
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="mt-1.5 font-mono"
          placeholder="DELETE VAULT"
          aria-label="Type DELETE VAULT to confirm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} sound={false}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            disabled={text !== 'DELETE VAULT' || wipe.isPending}
          >
            {wipe.isPending ? <SpinnerArc /> : <Trash2 className="h-3 w-3" />}
            Permanently wipe vault
          </Button>
        </div>
      </motion.form>
    </div>
  )
}

/* ─── Clear All Data Modal ─────────────────────────────────────────────────── */
function ClearDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const playThud = useSound('thud')
  const [text, setText] = useState('')

  const clear = useMutation({
    mutationFn: () => postDataClear('DELETE'),
    onSuccess: () => {
      playThud()
      toast.success('All indexed data cleared')
      queryClient.invalidateQueries()
      onClose()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not clear data')
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <motion.button
        aria-label="Close"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.form
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        onSubmit={(event) => {
          event.preventDefault()
          if (text === 'DELETE') clear.mutate()
        }}
        className="relative w-full max-w-sm rounded-2xl border border-red-500/25 bg-popover p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400 light:text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Clear all data</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          This removes indexed files, emails, events, people, applications, and spends. Your
          credentials are kept. This cannot be undone.
        </p>
        <p className="mt-3 text-[10px] text-muted-foreground/70">
          Type <span className="font-mono font-semibold text-foreground">DELETE</span> to confirm.
        </p>
        <Input
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="mt-1.5 font-mono"
          placeholder="DELETE"
          aria-label="Type DELETE to confirm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} sound={false}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            disabled={text !== 'DELETE' || clear.isPending}
          >
            {clear.isPending ? <SpinnerArc /> : <Trash2 className="h-3 w-3" />}
            Clear everything
          </Button>
        </div>
      </motion.form>
    </div>
  )
}

/* ─── Main Settings Component ───────────────────────────────────────────────── */
export default function SettingsPage() {
  const queryClient = useQueryClient()
  const playClick = useSound('click')
  const playChime = useSound('chime')
  const playThud = useSound('thud')
  const playPop = useSound('pop')
  const reduced = useReducedMotion()

  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const t = searchParams.get('tab') as SettingsTab
    return ['appearance', 'account', 'sections', 'privacy', 'integrations', 'profile'].includes(t)
      ? t
      : 'appearance'
  })

  const handleTabChange = (tabId: SettingsTab) => {
    setActiveTab(tabId)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', tabId)
      return next
    }, { replace: true })
  }

  const {
    theme: uiTheme,
    setTheme: setUiTheme,
    soundEnabled: soundOn,
    toggleSound: handleSoundToggle,
    navStyle,
    setNavStyle,
    scoreboardClock,
    setScoreboardClock,
    contentWidth,
    setContentWidth,
    autoRotateLook,
    setAutoRotateLook,
    autoThemeEnabled,
    setAutoThemeEnabled,
    autoThemeMode,
    setAutoThemeMode,
    autoThemeIntervalMinutes,
    setAutoThemeIntervalMinutes,
    autoThemePool,
    toggleThemeInPool,
    setAutoThemePool,
    autoThemeDayMapping,
    setAutoThemeDayMapping,
    hiddenSections,
    toggleSection,
    privacyPin,
    setPrivacyPin,
  } = useUIStore()

  const { currentPhase, secondsRemaining, rotateToNext } = useAutoThemeScheduler()

  const [activeTheme, setActiveTheme] = useState(getCurrentTheme)
  const { name: profileName, avatar: profileAvatar } = useProfile()
  const [nameDraft, setNameDraft] = useState(profileName)
  const [avatarDraft, setAvatarDraft] = useState<string | null>(profileAvatar)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  // PIN state
  const [pinDraft, setPinDraft] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')

  // Modals
  const [clearing, setClearing] = useState(false)
  const [wipeVaultOpen, setWipeVaultOpen] = useState(false)
  const [calendarConfirm, setCalendarConfirm] = useState(false)

  // Credentials
  const [gmailEmail, setGmailEmail] = useState('')
  const [gmailPassword, setGmailPassword] = useState('')
  const [groqKey, setGroqKey] = useState('')

  const { data: config, isLoading, isError, refetch } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
    staleTime: 60_000,
  })

  const gmailConnect = useMutation({
    mutationFn: () => postGmailConnect(gmailEmail.trim(), gmailPassword.trim()),
    onSuccess: (result: { message?: string }) => {
      celebrateConnection()
      toast.success(result.message || 'Gmail connected')
      setGmailPassword('')
      queryClient.invalidateQueries()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not connect Gmail')
    },
  })

  const gmailDisconnect = useMutation({
    mutationFn: postGmailDisconnect,
    onSuccess: () => {
      playChime()
      toast.success('Gmail disconnected')
      queryClient.invalidateQueries()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not disconnect')
    },
  })

  const gmailFetch = useMutation({
    mutationFn: postGmailFetch,
    onSuccess: (result: { message?: string }) => {
      playChime()
      toast.success(result.message || 'Inbox refreshed')
      queryClient.invalidateQueries()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not fetch mail')
    },
  })

  const groqConnect = useMutation({
    mutationFn: () => postGroqConnect(groqKey.trim()),
    onSuccess: (result: { message?: string }) => {
      celebrateConnection()
      toast.success(result.message || 'Groq connected')
      setGroqKey('')
      queryClient.invalidateQueries()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not connect Groq')
    },
  })

  const groqDisconnect = useMutation({
    mutationFn: postGroqDisconnect,
    onSuccess: () => {
      playChime()
      toast.success('Groq disconnected')
      queryClient.invalidateQueries()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not disconnect')
    },
  })

  const rescan = useMutation({
    mutationFn: postRescan,
    onSuccess: (result: { message?: string }) => {
      playChime()
      toast.success(result.message || 'Rescan complete')
      queryClient.invalidateQueries()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Rescan failed')
    },
  })

  const calendarUpload = useMutation({
    mutationFn: (file: File) => postCalendarUpload(file),
    onSuccess: (result) => {
      playChime()
      toast.success(result.message)
      queryClient.invalidateQueries()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    },
  })

  const calendarClear = useMutation({
    mutationFn: postCalendarClear,
    onSuccess: () => {
      playThud()
      toast.success('Calendar cleared')
      setCalendarConfirm(false)
      queryClient.invalidateQueries()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not clear calendar')
    },
  })

  const exportData = useMutation({
    mutationFn: fetchDataExport,
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `context-export-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      playChime()
      toast.success('Export downloaded')
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Export failed')
    },
  })

  const handleThemeApply = (next: ColorTheme) => {
    applyTheme(next.id, uiTheme)
    setActiveTheme(next.id)
    playSound('click')
    toast.success(`Atmosphere applied: ${next.name}`)
  }

  const handleSaveProfile = () => {
    setUserName(nameDraft)
    setUserAvatar(avatarDraft)
    playChime()
    toast.success('Profile updated')
  }

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUri = await readAvatarFile(file)
      setAvatarDraft(dataUri)
      setUserAvatar(dataUri)
      playChime()
      toast.success('Photo updated')
    } catch (error) {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not load image')
    }
  }

  const handleSetPin = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinDraft.length !== 4) {
      toast.error('PIN must be exactly 4 digits')
      return
    }
    if (pinDraft !== pinConfirm) {
      toast.error('PINs do not match')
      return
    }
    setPrivacyPin(pinDraft)
    playChime()
    toast.success('Privacy PIN activated')
    setPinDraft('')
    setPinConfirm('')
  }

  const handleRemovePin = () => {
    setPrivacyPin(null)
    playPop()
    toast.success('Privacy PIN removed')
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (isError || !config) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-red-400 mb-3" />
        <h2 className="text-base font-semibold">Settings Unavailable</h2>
        <p className="mt-1 text-xs text-muted-foreground">Make sure the backend server is running.</p>
        <Button onClick={() => refetch()} size="sm" className="mt-4">Retry</Button>
      </div>
    )
  }

  // All 13 modules for the sections curator
  const ALL_SECTIONS = [
    { id: '/', label: 'Dashboard', desc: 'Command center & daily briefing', icon: LayoutDashboard },
    { id: '/money', label: 'Money & Spends', desc: 'Weekly burn rate & categories', icon: Wallet },
    { id: '/subscriptions', label: 'Subscriptions', desc: 'Active services & renewal alerts', icon: Repeat },
    { id: '/debts', label: 'Debts & IOUs', desc: 'Borrowed & lent tracker', icon: HandCoins },
    { id: '/savings', label: 'Savings Goals', desc: 'Visual wealth target pots', icon: PiggyBank },
    { id: '/vault', label: 'Personal Vault', desc: 'Zero-knowledge client-side encrypted store', icon: Lock },
    { id: '/journal', label: 'Daily Journal & Mood', desc: '30-day reflection & emotional baseline', icon: BookOpen },
    { id: '/review', label: 'Weekly Review', desc: 'Retrospective cards & achievements', icon: Sparkles },
    { id: '/people', label: 'People', desc: 'Catch-up cadences & contact dots', icon: Users },
    { id: '/calendar', label: 'Calendar', desc: 'Schedule & time-block agenda', icon: Calendar },
    { id: '/email', label: 'Email', desc: 'Local Gmail IMAP inbox triage', icon: Mail },
    { id: '/jobs', label: 'Job Tracker', desc: 'Applications & interview pipeline', icon: Briefcase },
    { id: '/files', label: 'Files', desc: 'Local file indexing & search', icon: FileText },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-8">
      {/* ─── Header: Shiori Artisanal Touch ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/80">
          Make It Yours
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Settings
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground/80">
          This device and your personal operating system. Preferences stay local.
        </p>
      </motion.div>

      {/* ─── Segmented Tab Bar ──────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/70 bg-card/60 p-1.5 backdrop-blur-xl">
        {[
          { id: 'appearance', label: 'Appearance', icon: Palette },
          { id: 'account', label: 'Account & Auth', icon: ShieldCheck },
          { id: 'sections', label: 'Sections', icon: Sliders },
          { id: 'privacy', label: 'Privacy & Vault', icon: Lock },
          { id: 'integrations', label: 'Integrations & Data', icon: Zap },
          { id: 'profile', label: 'Profile', icon: UserRound },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => {
                playClick()
                handleTabChange(tab.id as SettingsTab)
              }}
              className={cn(
                'group relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 cursor-pointer',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ─── Tab 1: Appearance & Look ────────────────────────────────────────── */}
      {activeTab === 'appearance' && (
        <motion.div
          key="appearance"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Interactive Project Tour Card */}
          <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card/85 to-card/65 p-6 backdrop-blur-xl shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary border border-primary/30 shadow-inner">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Interactive Project Tour</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Replay the full-screen animated splash load and 4-step walkthrough of Context OS superpowers.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    playClick()
                    window.dispatchEvent(
                      new CustomEvent('context:open-tour', { detail: { withLoader: true } })
                    )
                  }}
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-primary/40 bg-primary/15 text-primary hover:bg-primary/25 font-mono text-xs cursor-pointer"
                >
                  Replay Tour & Intro
                </Button>
              </div>
            </div>
          </div>

          {/* Section: Navigation Style */}
          <div className="rounded-3xl border border-border/70 bg-card/75 p-6 backdrop-blur-xl shadow-[0_14px_36px_-26px_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <h2 className="text-base font-bold text-foreground">Navigation</h2>
            <p className="text-xs text-muted-foreground mt-0.5 mb-4">
              How Context presents your sections across laptop, tablet, and mobile displays.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Side Panel Option */}
              <div
                onClick={() => {
                  playClick()
                  setNavStyle('sidebar')
                }}
                className={cn(
                  'group cursor-pointer rounded-2xl border p-4 transition-all duration-200',
                  navStyle === 'sidebar'
                    ? 'border-primary bg-primary/[0.06] shadow-[0_0_20px_rgba(139,92,246,0.15)] ring-1 ring-primary/40'
                    : 'border-border/60 bg-surface-1 hover:border-border hover:bg-surface-2'
                )}
              >
                {/* Visual diagram */}
                <div className="flex h-16 w-full gap-1.5 rounded-xl border border-border/60 bg-surface-inset p-2 mb-3">
                  <div className="h-full w-8 rounded-lg bg-primary/40" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2 w-full rounded bg-surface-3" />
                    <div className="h-6 w-full rounded bg-surface-2" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Side Panel</span>
                  {navStyle === 'sidebar' && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Sections grouped down the left with icons, hotkeys, and stage lights. Folds on demand.
                </p>
              </div>

              {/* Top Bar Option */}
              <div
                onClick={() => {
                  playClick()
                  setNavStyle('topbar')
                }}
                className={cn(
                  'group cursor-pointer rounded-2xl border p-4 transition-all duration-200',
                  navStyle === 'topbar'
                    ? 'border-primary bg-primary/[0.06] shadow-[0_0_20px_rgba(139,92,246,0.15)] ring-1 ring-primary/40'
                    : 'border-border/60 bg-surface-1 hover:border-border hover:bg-surface-2'
                )}
              >
                {/* Visual diagram */}
                <div className="flex flex-col h-16 w-full gap-1.5 rounded-xl border border-border/60 bg-surface-inset p-2 mb-3">
                  <div className="h-3 w-full rounded-lg bg-primary/40" />
                  <div className="flex-1 rounded bg-surface-2" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Top Bar</span>
                  {navStyle === 'topbar' && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Every workspace section in a continuous ribbon across the top of your screen.
                </p>
              </div>
            </div>
          </div>

          {/* Section: Atmosphere & Look Presets */}
          <div className="rounded-3xl border border-border/70 bg-card/75 p-6 backdrop-blur-xl shadow-[0_14px_36px_-26px_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">Atmosphere & Look</h2>
                  {autoThemeEnabled && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Dynamic Auto-Change Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Colors, atmosphere, and look can change automatically based on the time of day or your custom interval.
                </p>
              </div>

              {/* Master Auto-Change Switch */}
              <div className="flex items-center gap-2.5">
                <span className="text-[12px] font-medium text-foreground/80">Auto-Change</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoThemeEnabled}
                  onClick={() => {
                    playPop()
                    setAutoThemeEnabled(!autoThemeEnabled)
                  }}
                  className={cn(
                    'relative h-6 w-11 shrink-0 rounded-full border transition-colors cursor-pointer',
                    autoThemeEnabled ? 'border-primary bg-primary' : 'border-border bg-surface-3'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform',
                      autoThemeEnabled ? 'right-0.5' : 'left-0.5'
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Expanded Dynamic Atmosphere Controls */}
            {autoThemeEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 space-y-4 rounded-2xl border border-primary/25 bg-primary/[0.03] p-4"
              >
                {/* Mode Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      playPop()
                      setAutoThemeMode('time-of-day')
                    }}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
                      autoThemeMode === 'time-of-day'
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border/60 bg-surface-1 hover:bg-surface-2'
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                      <Sun className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">Follow Time of Day</span>
                        {autoThemeMode === 'time-of-day' && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Colors and sky shift naturally through Dawn, Day, Dusk, and Night.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playPop()
                      setAutoThemeMode('interval')
                    }}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
                      autoThemeMode === 'interval'
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border/60 bg-surface-1 hover:bg-surface-2'
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">Periodic Interval Rotation</span>
                        {autoThemeMode === 'interval' && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Cycles through your selected themes after every set interval of time.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Sub-Panel: Time of Day Mapping */}
                {autoThemeMode === 'time-of-day' && (
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Time of Day Themes (Dawn · Day · Dusk · Night)
                      </span>
                      <span className="text-[11px]">
                        Current: <strong className="uppercase text-primary">{currentPhase}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { key: 'dawn' as const, label: 'Dawn', time: '5 AM – 9 AM', icon: Sun },
                        { key: 'day' as const, label: 'Day', time: '9 AM – 5 PM', icon: Zap },
                        { key: 'dusk' as const, label: 'Dusk', time: '5 PM – 8 PM', icon: Sparkles },
                        { key: 'night' as const, label: 'Night', time: '8 PM – 5 AM', icon: Moon },
                      ].map(({ key, label, time, icon: PhaseIcon }) => {
                        const assignedThemeId = autoThemeDayMapping[key]
                        const isCurrent = currentPhase === key
                        return (
                          <div
                            key={key}
                            className={cn(
                              'flex flex-col rounded-xl border p-2.5 transition-all',
                              isCurrent ? 'border-primary bg-primary/[0.08]' : 'border-border/60 bg-surface-2'
                            )}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="flex items-center gap-1 text-[11px] font-bold text-foreground">
                                <PhaseIcon className="h-3 w-3 text-primary" />
                                {label}
                              </span>
                              {isCurrent && (
                                <span className="text-[9px] uppercase font-bold text-primary">Now</span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground mb-2">{time}</span>
                            <select
                              value={assignedThemeId}
                              onChange={(e) => {
                                playPop()
                                setAutoThemeDayMapping({ [key]: e.target.value })
                              }}
                              className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium text-foreground outline-none focus:border-primary"
                            >
                              {THEMES.map((theme) => (
                                <option key={theme.id} value={theme.id}>
                                  {theme.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Sub-Panel: Interval Configuration */}
                {autoThemeMode === 'interval' && (
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-foreground">Rotation Interval</span>
                        <p className="text-[11px] text-muted-foreground">
                          Choose after how much time Context should automatically shift atmosphere.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-border/80 bg-surface-2 px-2.5 py-1 font-mono text-[11px] tabular-nums text-foreground">
                          Next in {Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2, '0')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            playPop()
                            rotateToNext()
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
                          title="Rotate now"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Rotate Now
                        </button>
                      </div>
                    </div>

                    {/* Interval Chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { mins: 1, label: '1 min (Fast Demo)' },
                        { mins: 5, label: '5 mins' },
                        { mins: 15, label: '15 mins' },
                        { mins: 30, label: '30 mins' },
                        { mins: 60, label: '1 hour' },
                        { mins: 120, label: '2 hours' },
                        { mins: 240, label: '4 hours' },
                      ].map(({ mins, label }) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            playPop()
                            setAutoThemeIntervalMinutes(mins)
                          }}
                          className={cn(
                            'rounded-xl border px-3 py-1.5 text-xs font-medium transition-all',
                            autoThemeIntervalMinutes === mins
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Which Ones to Include in Rotation (Pool Selector) */}
                <div className="border-t border-border/50 pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground">
                        Included Themes in Rotation ({autoThemePool.length} of {THEMES.length} selected)
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        Select which atmospheres you want to cycle through.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          playPop()
                          setAutoThemePool(THEMES.map((t) => t.id))
                        }}
                        className="rounded-lg border border-border/60 bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-surface-3"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playPop()
                          setAutoThemePool(['shiori', 'almanac', 'violet', 'sky', 'emerald', 'amber'])
                        }}
                        className="rounded-lg border border-border/60 bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface-3"
                      >
                        Reset Defaults
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Grid of All Themes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {THEMES.map((t) => {
                const isSelected = activeTheme === t.id
                const isInPool = autoThemePool.includes(t.id)
                return (
                  <div
                    key={t.id}
                    className={cn(
                      'group relative flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all duration-200',
                      isSelected
                        ? 'border-primary bg-primary/[0.08] shadow-[0_0_16px_rgba(139,92,246,0.18)] ring-1 ring-primary/40'
                        : 'border-border/60 bg-surface-1 hover:border-border hover:bg-surface-2'
                    )}
                  >
                    {/* Top Row: Color dots and Active check / In-Rotation toggle */}
                    <div className="flex items-center gap-2 mb-2 w-full justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-3.5 w-3.5 rounded-full shadow-sm"
                          style={{ backgroundColor: t.primary }}
                        />
                        <span
                          className="h-3 w-3 rounded-full opacity-60"
                          style={{ backgroundColor: t.accent }}
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {autoThemeEnabled && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              playPop()
                              toggleThemeInPool(t.id)
                            }}
                            title={isInPool ? 'Remove from auto-rotation' : 'Include in auto-rotation'}
                            className={cn(
                              'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold transition-colors',
                              isInPool
                                ? 'bg-primary/20 text-primary hover:bg-primary/30'
                                : 'bg-surface-3 text-muted-foreground/50 hover:text-muted-foreground'
                            )}
                          >
                            <Repeat className="h-2.5 w-2.5" />
                            {isInPool ? 'In Cycle' : 'Off'}
                          </button>
                        )}
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                    </div>

                    {/* Clickable Area to Apply Theme */}
                    <button
                      type="button"
                      onClick={() => handleThemeApply(t)}
                      className="w-full text-left cursor-pointer"
                    >
                      <span className="text-xs font-bold text-foreground block">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground/70 capitalize mt-0.5 block">
                        {t.id === 'shiori'
                          ? 'Moss & Linen'
                          : t.id === 'almanac'
                          ? 'Midnight Indigo'
                          : t.id === 'hedgerow'
                          ? 'Fern & Gold'
                          : t.id === 'sport'
                          ? 'Cobalt & Coral'
                          : t.id === 'rose'
                          ? 'Rose & Ruby'
                          : t.id === 'pink'
                          ? 'Sakura & Light Pink'
                          : 'Balanced Palette'}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Section: Live Scoreboard Clock & Theme Mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ScoreboardClock />

            <div className="rounded-2xl border border-border/70 bg-card/75 p-5 backdrop-blur-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-1">
                Display Theme Mode
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Toggle light and dark surfaces independently of the atmosphere.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setUiTheme('dark')
                    applyTheme(activeTheme, 'dark')
                  }}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold cursor-pointer transition-all',
                    uiTheme === 'dark'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2'
                  )}
                >
                  <Moon className="h-3.5 w-3.5" />
                  Dark Obsidian
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setUiTheme('light')
                    applyTheme(activeTheme, 'light')
                  }}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold cursor-pointer transition-all',
                    uiTheme === 'light'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2'
                  )}
                >
                  <Sun className="h-3.5 w-3.5" />
                  Light Paper
                </button>
              </div>
            </div>
          </div>

          {/* Section: Sound & Motion */}
          <div className="rounded-3xl border border-border/70 bg-card/75 p-6 backdrop-blur-xl shadow-sm">
            <h2 className="text-base font-bold text-foreground">Tactile Feedback & Motion</h2>
            <p className="text-xs text-muted-foreground mt-0.5 mb-4">
              Micro-chimes and fluid spring choreography for key interactions.
            </p>

            <div className="space-y-4 divide-y divide-hairline">
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Volume2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Tactile Audio Chimes</p>
                    <p className="text-[11px] text-muted-foreground">
                      Gentle sounds for completing habits, saving entries, and unlocking vault.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => playChime()}
                    className="text-[10px]"
                  >
                    Test Chime
                  </Button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={soundOn}
                    onClick={() => {
                      handleSoundToggle()
                      playPop()
                    }}
                    className={cn(
                      'relative h-5 w-9 shrink-0 rounded-full border transition-colors cursor-pointer',
                      soundOn ? 'border-primary bg-primary' : 'border-border bg-surface-3'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                        soundOn ? 'right-0.5' : 'left-0.5'
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Reduced Motion</p>
                    <p className="text-[11px] text-muted-foreground">
                      Follows your OS accessibility settings ({reduced ? 'Active' : 'Full motion enabled'}).
                    </p>
                  </div>
                </div>
                <Badge variant={reduced ? 'warning' : 'secondary'} className="text-[10px]">
                  {reduced ? 'Reduced' : 'Full Motion'}
                </Badge>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Tab: Account & User Auth (Supabase Ready) ────────────────────────── */}
      {activeTab === 'account' && (
        <motion.div
          key="account"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <AuthSection />
        </motion.div>
      )}

      {/* ─── Tab 2: Sections & Menu Manager ──────────────────────────────────── */}
      {activeTab === 'sections' && (
        <motion.div
          key="sections"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div className="rounded-3xl border border-border/70 bg-card/75 p-6 backdrop-blur-xl shadow-sm">
            <h2 className="text-base font-bold text-foreground">Curate Workspace Sections</h2>
            <p className="text-xs text-muted-foreground mt-0.5 mb-5">
              Hide modules you do not use to keep your sidebar minimal and focused. Changes apply instantly.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ALL_SECTIONS.map((sec) => {
                const isHidden = hiddenSections.includes(sec.id)
                const Icon = sec.icon
                return (
                  <div
                    key={sec.id}
                    onClick={() => {
                      playClick()
                      toggleSection(sec.id)
                    }}
                    className={cn(
                      'group flex items-center justify-between rounded-2xl border p-3.5 transition-all duration-200 cursor-pointer',
                      !isHidden
                        ? 'border-border/70 bg-surface-1/80 hover:border-primary/40 hover:bg-surface-2'
                        : 'border-border/40 bg-surface-inset/40 opacity-55'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                          !isHidden ? 'bg-primary/10 text-primary' : 'bg-surface-3 text-muted-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{sec.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{sec.desc}</p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
                        !isHidden ? 'bg-primary' : 'bg-surface-3'
                      )}
                    >
                      <motion.div
                        layout
                        className={cn(
                          'h-4 w-4 rounded-full bg-white shadow-sm',
                          !isHidden ? 'ml-auto' : 'mr-auto'
                        )}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Tab 3: Privacy & Vault ─────────────────────────────────────────── */}
      {activeTab === 'privacy' && (
        <motion.div
          key="privacy"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Quick PIN Screen */}
          <div className="rounded-3xl border border-border/70 bg-card/75 p-6 backdrop-blur-xl shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Device Privacy PIN</h2>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">
                  Set a 4-digit PIN for quick privacy protection against shoulder surfers when away from your screen.
                </p>
              </div>
              <Badge variant={privacyPin ? 'success' : 'secondary'} className="text-[10px]">
                {privacyPin ? 'PIN Active' : 'No PIN'}
              </Badge>
            </div>

            {privacyPin ? (
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold text-foreground">Device Privacy Lock Enabled</p>
                    <p className="text-[11px] text-muted-foreground">Your 4-digit PIN is active on this browser.</p>
                  </div>
                </div>
                <Button variant="outline" size="xs" onClick={handleRemovePin}>
                  Remove PIN
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSetPin} className="mt-4 flex flex-wrap items-center gap-3">
                <Input
                  type="password"
                  maxLength={4}
                  placeholder="New 4-digit PIN"
                  value={pinDraft}
                  onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ''))}
                  className="w-36 font-mono text-center tracking-widest text-sm"
                />
                <Input
                  type="password"
                  maxLength={4}
                  placeholder="Confirm PIN"
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                  className="w-36 font-mono text-center tracking-widest text-sm"
                />
                <Button type="submit" size="sm" disabled={pinDraft.length !== 4 || pinDraft !== pinConfirm}>
                  Set PIN
                </Button>
              </form>
            )}
          </div>

          {/* Secure Personal Vault Management */}
          <div className="rounded-3xl border border-border/70 bg-card/75 p-6 backdrop-blur-xl shadow-sm">
            <h2 className="text-base font-bold text-foreground">Secure Personal Vault</h2>
            <p className="text-xs text-muted-foreground mt-0.5 mb-4">
              Zero-knowledge client-side encryption using Web Crypto API. The server never sees plaintext sensitive data.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border/60 bg-surface-1 p-4 gap-3">
              <div>
                <p className="text-xs font-bold text-foreground">Permanent Master Wipe</p>
                <p className="text-[11px] text-muted-foreground">
                  Permanently destroys all encrypted records and deletes the master PBKDF2 salt.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setWipeVaultOpen(true)}
                className="gap-1.5 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Wipe Vault
              </Button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-3xl border border-red-500/25 bg-red-500/[0.03] p-6 backdrop-blur-xl shadow-sm">
            <div className="flex items-center gap-2 text-red-400 light:text-red-600 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <h2 className="text-base font-bold">Danger Zone</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Hold the button to clear all locally indexed files, emails, people, and spends.
            </p>

            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground max-w-sm">
                Clearing resets the local database index. Your app credentials stay intact.
              </p>
              <HoldButton
                label="Clear all data"
                holdLabel="Keep holding"
                onComplete={() => setClearing(true)}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Tab 4: Integrations & Data ─────────────────────────────────────── */}
      {activeTab === 'integrations' && (
        <motion.div
          key="integrations"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Gmail */}
          <div className="rounded-3xl border border-border/70 bg-card/75 p-6 backdrop-blur-xl shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Gmail IMAP</h3>
                  <p className="text-[11px] text-muted-foreground">Index emails locally over TLS.</p>
                </div>
              </div>
              <Badge variant={config.gmail_connected ? 'success' : 'secondary'} className="text-[10px]">
                {config.gmail_connected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>

            {config.gmail_connected ? (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => gmailFetch.mutate()}
                  disabled={gmailFetch.isPending}
                >
                  {gmailFetch.isPending ? <SpinnerArc /> : <RefreshCw className="h-3 w-3" />}
                  Fetch Now
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => gmailDisconnect.mutate()}
                  disabled={gmailDisconnect.isPending}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (gmailEmail && gmailPassword) gmailConnect.mutate()
                }}
                className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2"
              >
                <Input
                  type="email"
                  placeholder="you@gmail.com"
                  value={gmailEmail}
                  onChange={(e) => setGmailEmail(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Google App Password"
                  value={gmailPassword}
                  onChange={(e) => setGmailPassword(e.target.value)}
                />
                <Button type="submit" disabled={!gmailEmail || !gmailPassword || gmailConnect.isPending}>
                  {gmailConnect.isPending ? <SpinnerArc /> : <Check className="h-3.5 w-3.5" />}
                  Connect
                </Button>
              </form>
            )}
          </div>

          {/* Groq */}
          <div className="rounded-3xl border border-border/70 bg-card/75 p-6 backdrop-blur-xl shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Groq AI Engine</h3>
                  <p className="text-[11px] text-muted-foreground">Ultra-fast Llama-3 synthesis and answers.</p>
                </div>
              </div>
              <Badge variant={config.has_groq ? 'success' : 'secondary'} className="text-[10px]">
                {config.has_groq ? 'Active' : 'Unset'}
              </Badge>
            </div>

            {config.has_groq ? (
              <Button size="sm" variant="ghost" onClick={() => groqDisconnect.mutate()}>
                Disconnect Key
              </Button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (groqKey) groqConnect.mutate()
                }}
                className="mt-4 flex gap-2"
              >
                <Input
                  type="password"
                  placeholder="gsk_..."
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button type="submit" size="sm" disabled={!groqKey || groqConnect.isPending}>
                  Connect
                </Button>
              </form>
            )}
          </div>

          {/* Local Data Export & Rescan */}
          <div className="rounded-3xl border border-border/70 bg-card/75 p-6 backdrop-blur-xl shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-1">Local Data & Backups</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Your files and SQLite database live completely on this machine.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => rescan.mutate()} disabled={rescan.isPending}>
                {rescan.isPending ? <SpinnerArc /> : <RefreshCw className="h-3 w-3" />}
                Rescan Local Files
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportData.mutate()} disabled={exportData.isPending}>
                {exportData.isPending ? <SpinnerArc /> : <Download className="h-3 w-3" />}
                Export JSON Backup
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Tab 5: Profile ─────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <motion.div
          key="profile"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div className="rounded-3xl border border-border/70 bg-card/75 p-6 backdrop-blur-xl shadow-sm">
            <h2 className="text-base font-bold text-foreground">Personal Identity</h2>
            <p className="text-xs text-muted-foreground mt-0.5 mb-5">
              Customize how Context greets you on the command center.
            </p>

            <div className="flex items-center gap-5">
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="group relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-inner"
              >
                {avatarDraft ? (
                  <img src={avatarDraft} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-foreground">
                    {initialsFromName(nameDraft)}
                  </span>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Upload className="h-5 w-5 text-white" />
                </div>
              </div>

              <div className="flex-1 space-y-2">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Your display name"
                  className="max-w-md text-sm"
                />
                <div className="flex items-center gap-2">
                  <Button size="xs" onClick={handleSaveProfile}>
                    Save Profile
                  </Button>
                  {avatarDraft && (
                    <Button size="xs" variant="ghost" onClick={() => setAvatarDraft(null)}>
                      Remove Photo
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleAvatarFile(e.target.files?.[0])}
            />
          </div>
        </motion.div>
      )}

      {/* Modals */}
      <AnimatePresence>{clearing && <ClearDialog onClose={() => setClearing(false)} />}</AnimatePresence>
      <AnimatePresence>{wipeVaultOpen && <WipeVaultDialog onClose={() => setWipeVaultOpen(false)} />}</AnimatePresence>
    </div>
  )
}
