import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  Command,
  Flame,
  Info,
  LogOut,
  Mail,
  Menu,
  Search,
  Settings,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  X,
  Zap,
  Plus,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchConfig,
  postGmailDisconnect,
  postGroqDisconnect,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/format'
import ThemeToggle from '@/components/ThemeToggle'
import { isSoundEnabled, toggleSound, useSound } from '@/hooks/useSound'
import { useProfile } from '@/hooks/useProfile'
import { initialsFromName, readAvatarFile, setUserAvatar } from '@/lib/profile'
import { getStreak } from '@/lib/streak'
import { celebrateStreak } from '@/lib/celebrate'
import { useAuthStore } from '@/store/auth'
import NotificationBell from '@/components/notifications/NotificationBell'

interface TopbarProps {
  onMenuClick: () => void
  showMenuButton?: boolean
}

export default function Topbar({ onMenuClick, showMenuButton = true }: TopbarProps) {
  const user = useAuthStore(state => state.user)
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [soundOn, setSoundOn] = useState(isSoundEnabled())
  const playClick = useSound('click')
  const playChime = useSound('chime')
  const playThud = useSound('thud')
  const { name, avatar } = useProfile()
  const streak = getStreak()
  const celebrated = useRef(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const { data: config, isLoading: configLoading, isError: configError } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
  })

  const disconnectGmail = useMutation({
    mutationFn: postGmailDisconnect,
    onSuccess: () => {
      playChime()
      toast.success('Gmail disconnected')
      setMenuOpen(false)
      queryClient.invalidateQueries()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not disconnect')
    },
  })

  const disconnectGroq = useMutation({
    mutationFn: postGroqDisconnect,
    onSuccess: () => {
      playChime()
      toast.success('Groq disconnected')
      setMenuOpen(false)
      queryClient.invalidateQueries()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not disconnect')
    },
  })

  const handleSoundToggle = () => {
    const next = toggleSound()
    setSoundOn(next)
    if (next) playClick()
  }

  useEffect(() => {
    if (celebrated.current || !streak.milestone) return
    celebrated.current = true
    celebrateStreak(streak.milestone)
    playChime()
    toast.success(`🔥 ${streak.milestone}-day streak! Keep going.`)
  }, [streak.milestone, playChime])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search.trim())}`)
    }
  }

  const openPalette = () => {
    playClick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
  }

  const avatarLabel =
    initialsFromName(name) || initials(config?.gmail_email || 'Context User')

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUrl = await readAvatarFile(file)
      setUserAvatar(dataUrl)
      playChime()
      toast.success('Avatar updated')
    } catch (error) {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not use that image')
    }
  }

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/80 bg-background px-4 sm:px-6 shadow-sm transition-colors">
      {/* Top accent gradient rim */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] opacity-70"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, var(--theme-glow) 50%, transparent 100%)',
        }}
      />

      <div className="flex min-w-0 flex-1 items-center gap-2 pr-3 sm:gap-3">
        {/* Mobile menu trigger */}
        {showMenuButton && <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface-2 text-muted-foreground transition hover:bg-surface-3 hover:text-foreground lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>}

        {/* Omni-Search Spotlight Capsule */}
        <form onSubmit={handleSearch} className="min-w-0 max-w-[420px] flex-1">
          <div
            className={cn(
              'group relative flex h-10 w-full items-center gap-2.5 rounded-xl border px-3 sm:px-3.5 transition-all duration-200',
              focused
                ? 'border-primary/50 bg-card/90 ring-2 ring-primary/20 shadow-lg shadow-primary/10'
                : 'border-border/70 bg-surface-2/60 hover:border-border hover:bg-surface-2/90'
            )}
          >
            <Search
              className={cn(
                'h-3.5 w-3.5 shrink-0 transition-colors',
                focused ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-foreground'
              )}
            />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              aria-label="Search your context"
              placeholder="Search files, spending, notes, topics…"
              className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
            />

            <AnimatePresence mode="popLayout">
              {search ? (
                <motion.button
                  key="clear"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                  className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-surface-3 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </motion.button>
              ) : (
                <button
                  type="button"
                  onClick={openPalette}
                  data-ui-tooltip="Open Command Palette (⌘K)"
                  className="hidden items-center gap-1 rounded-md border border-border/70 bg-surface-3/90 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/75 transition hover:border-primary/40 hover:bg-surface-3 hover:text-foreground sm:flex"
                >
                  <Command className="h-2.5 w-2.5" />
                  <span>K</span>
                </button>
              )}
            </AnimatePresence>
          </div>
        </form>
      </div>

      {/* Right Hardware Status & Identity Cluster */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        {user && <button type="button" aria-label="Quick capture" onClick={() => window.dispatchEvent(new Event('context:quick-capture'))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card/80 text-muted-foreground hover:text-foreground"><Plus className="h-4 w-4" /></button>}
        <NotificationBell />
        {/* Streak Counter */}
        <div tabIndex={0} aria-label={`Daily streak: ${streak.streak} ${streak.streak === 1 ? 'day' : 'days'}`}
          className="hidden h-9 items-center gap-2 rounded-xl border border-amber-500/20 bg-card/80 pl-1 pr-2.5 shadow-sm transition-colors hover:border-amber-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:flex"
          data-ui-tooltip={
            streak.streak <= 1 && streak.firstEver
              ? 'Your streak starts today. Come back tomorrow!'
              : `${streak.streak}-day streak. Keep going!`
          }
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 light:text-amber-700">
            <Flame className="h-3.5 w-3.5 fill-amber-500/15" strokeWidth={1.8} />
          </span>
          <motion.span
            key={streak.streak}
            initial={streak.increased ? { scale: 1.45 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="text-[11px] font-semibold tabular-nums text-foreground/90"
          >
            {streak.streak} {streak.streak === 1 ? 'day' : 'days'}
          </motion.span>
        </div>

        {/* AI Hardware Chip Indicator (Groq) */}
        <button type="button" disabled={configLoading}
          onClick={() => navigate('/settings?tab=integrations')}
          aria-label={config?.has_groq ? 'Manage your personal AI connection' : 'Connect your personal AI API key'}
          className={cn(
            'group hidden h-9 items-center gap-2 rounded-xl border bg-card/80 pl-1 pr-2.5 text-[11px] font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait xl:inline-flex',
            config?.has_groq
              ? 'border-emerald-500/20 text-foreground/90 hover:border-emerald-500/40'
              : 'border-border/80 text-muted-foreground hover:border-primary/30 hover:text-foreground'
          )}
          data-ui-tooltip={configError ? 'AI connection status unavailable. Open Integrations to retry.' : config?.has_groq ? 'Your personal AI key is connected. Manage integrations.' : 'Add your own AI API key in Settings > Integrations.'}
        >
          <span
            className={cn(
              'relative flex h-6 w-6 items-center justify-center rounded-lg transition-colors',
              config?.has_groq
                ? 'bg-emerald-500/10 text-emerald-400 light:text-emerald-700'
                : 'bg-surface-2 text-muted-foreground group-hover:text-primary'
            )}
          >
            <Zap className="h-3.5 w-3.5" strokeWidth={1.8} />
            {config?.has_groq && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-2 ring-card" />}
          </span>
          <span>{configLoading ? 'Checking AI' : configError ? 'AI unavailable' : config?.has_groq ? 'AI ready' : 'Connect AI'}</span>
        </button>

        {/* Gmail Sync Indicator */}
        {config?.gmail_connected && (
          <div tabIndex={0}
            className="hidden max-w-[180px] items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-blue-400 2xl:inline-flex shadow-sm"
            data-ui-tooltip={config.gmail_email ?? 'Gmail synced'}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] animate-pulse" />
            <Mail className="h-3 w-3 shrink-0 opacity-70" />
            <span className="truncate font-mono text-[10px] font-medium">
              {config.gmail_email?.split('@')[0]}
            </span>
          </div>
        )}

        {/* Sound Knob Switch */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          type="button"
          onClick={handleSoundToggle}
          aria-label={soundOn ? 'Mute sounds' : 'Enable sounds'}
          data-ui-tooltip={soundOn ? 'Audio feedback: On' : 'Audio feedback: Muted'}
          className={cn(
            'hidden h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 sm:flex',
            soundOn
              ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
              : 'border-border/70 bg-surface-2 text-muted-foreground/60 hover:text-foreground'
          )}
        >
          {soundOn ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </motion.button>

        {/* Theme Switcher Knob */}
        <ThemeToggle className="hidden sm:flex" />

        {/* Floating Identity Capsule + Dropdown */}
        <div className="relative" ref={menuRef}>
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={() => {
              playClick()
              setMenuOpen((open) => !open)
            }}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            className="group relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl text-xs font-bold text-white shadow-md transition-all ring-2 ring-primary/40 hover:ring-primary/80"
            style={{
              background:
                'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--theme-accent)) 100%)',
              boxShadow: '0 4px 16px -2px var(--theme-glow)',
            }}
          >
            {avatar ? (
              <img
                src={avatar}
                alt={name || 'Profile avatar'}
                className="h-full w-full object-cover"
              />
            ) : (
              avatarLabel
            )}
            <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
          </motion.button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-border/90 bg-[#121518]/95 p-1.5 shadow-2xl backdrop-blur-2xl"
              >
                {/* User Info Header */}
                <div className="border-b border-border/60 px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow"
                      style={{
                        background:
                          'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--theme-accent)) 100%)',
                      }}
                    >
                      {avatarLabel}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {user?.name || 'Welcome to Context'}
                      </p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground/60">
                        {user?.email || ''}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between rounded-lg bg-surface-2 px-2 py-1 text-[10px] font-mono text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {user ? 'Session: Secure' : 'Dashboard preview'}
                    </span>
                    <span className="text-emerald-400 font-semibold">{user ? 'Connected' : 'Guest'}</span>
                  </div>
                </div>

                <div className="p-1 space-y-0.5">
                  {!user && <MenuItem icon={LogOut} label="Sign in / Create Account" onClick={() => { setMenuOpen(false); navigate('/auth'); }} />}
                  {user && <MenuItem icon={LogOut} label="Sign out" onClick={() => {
                    setMenuOpen(false)
                    void useAuthStore.getState().logout().catch(() => toast.error('Could not revoke the session. Please retry.'))
                  }} />}
                  <MenuItem
                    icon={Upload}
                    label={avatar ? 'Change avatar' : 'Upload custom avatar'}
                    onClick={() => {
                      setMenuOpen(false)
                      avatarInputRef.current?.click()
                    }}
                  />

                  <MenuItem
                    icon={Settings}
                    label="System Settings"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/settings')
                    }}
                  />
                  <MenuItem
                    icon={Sparkles}
                    label="Product Tour & Intro"
                    onClick={() => {
                      setMenuOpen(false)
                      window.dispatchEvent(
                        new CustomEvent('context:open-tour', { detail: { withLoader: true } })
                      )
                    }}
                  />
                  {config?.gmail_connected && (
                    <MenuItem
                      icon={LogOut}
                      label="Disconnect Gmail"
                      danger
                      disabled={disconnectGmail.isPending}
                      onClick={() => disconnectGmail.mutate()}
                    />
                  )}
                  {config?.has_groq && (
                    <MenuItem
                      icon={Zap}
                      label="Disconnect Groq LLM"
                      danger
                      disabled={disconnectGroq.isPending}
                      onClick={() => disconnectGroq.mutate()}
                    />
                  )}
                  <MenuItem
                    icon={Info}
                    label="About Context OS"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/settings#about')
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              handleAvatarFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>
      </div>
    </header>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: typeof Settings
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors disabled:opacity-50',
        danger
          ? 'text-rose-400 hover:bg-rose-500/10'
          : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
