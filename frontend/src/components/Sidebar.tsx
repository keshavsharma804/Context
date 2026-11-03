import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  BookOpen,
  Briefcase,
  Calendar,
  FileText,
  HandCoins,
  LayoutDashboard,
  Lock,
  LogIn,
  Mail,
  PiggyBank,
  Repeat,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSound } from '@/hooks/useSound'
import { useUIStore } from '@/store/ui'
import { useAuthStore } from '@/store/auth'
import { ContextLogo } from '@/components/ui/ContextLogo'

interface NavGroup {
  name: string
  items: {
    to: string
    icon: typeof LayoutDashboard
    label: string
    hotkey: string
    badge?: string
  }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    name: 'Finance & Control',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', hotkey: 'D' },
      { to: '/money', icon: Wallet, label: 'Money & Spends', hotkey: 'M' },
      { to: '/subscriptions', icon: Repeat, label: 'Subscriptions', hotkey: 'R' },
      { to: '/debts', icon: HandCoins, label: 'Debts & IOUs', hotkey: 'B' },
      { to: '/savings', icon: PiggyBank, label: 'Savings Goals', hotkey: 'G' },
    ],
  },
  {
    name: 'Life & Workspace',
    items: [
      { to: '/calendar', icon: Calendar, label: 'Calendar', hotkey: 'C' },
      { to: '/vault', icon: Lock, label: 'Vault', hotkey: 'V' },
      { to: '/email', icon: Mail, label: 'Email', hotkey: 'E' },
      { to: '/jobs', icon: Briefcase, label: 'Jobs & Career', hotkey: 'J' },
      { to: '/people', icon: Users, label: 'People', hotkey: 'P' },
      { to: '/files', icon: FileText, label: 'Files Index', hotkey: 'F' },
    ],
  },
  {
    name: 'Insights & Mind',
    items: [
      { to: '/review', icon: Sparkles, label: 'Weekly Review', hotkey: 'W' },
      { to: '/journal', icon: BookOpen, label: 'Journal & Mood', hotkey: 'L' },
    ],
  },
]

function isActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname.startsWith(to)
}

function Logo({ compact = false }: { compact?: boolean }) {
  const playClick = useSound('click')
  return (
    <NavLink
      to="/"
      onClick={() => playClick()}
      className={cn(
        'group relative flex h-16 shrink-0 items-center border-b border-border/60 transition-colors',
        compact ? 'justify-center px-2' : 'gap-3 px-4'
      )}
    >
      {/* Ambient background glow behind logo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-4 left-2 h-16 w-32 rounded-full opacity-40 blur-xl transition-opacity group-hover:opacity-70"
        style={{
          background: 'radial-gradient(circle, var(--theme-glow) 0%, transparent 70%)',
        }}
      />

      {/* Hardware Emblem */}
      <div className="relative flex shrink-0 items-center justify-center transition-all duration-300 group-hover:scale-105">
        <ContextLogo size={32} />
      </div>

      {!compact && (
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground transition-colors group-hover:text-primary">
              CONTEXT
            </span>
            <span className="rounded bg-primary/10 px-1 py-0.2 font-mono text-[8px] font-semibold tracking-wider text-primary">
              OS
            </span>
          </div>
          <span className="mt-0.5 font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground/60">
            Local Silicon · v2.4
          </span>
        </div>
      )}
    </NavLink>
  )
}

function NavItem({
  to,
  icon: Icon,
  label,
  hotkey,
  compact,
  pathname,
  onNavigate,
}: {
  to: string
  icon: typeof LayoutDashboard
  label: string
  hotkey: string
  compact: boolean
  pathname: string
  onNavigate?: () => void
}) {
  const active = isActive(pathname, to)
  const playClick = useSound('click')

  return (
    <NavLink
      to={to}
      data-ui-tooltip={`${label} · G ${hotkey}`}
      aria-label={compact ? label : undefined}
      className="block"
      onClick={() => {
        playClick()
        onNavigate?.()
      }}
    >
      <motion.div
        whileHover={{ x: compact ? 0 : 2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className={cn(
          'group relative flex items-center rounded-xl text-xs font-medium transition-all duration-200',
          compact ? 'h-9 w-9 justify-center' : 'justify-between px-3 py-2',
          active
            ? 'border border-primary/30 bg-primary/15 font-semibold text-foreground shadow-sm shadow-primary/10'
            : 'border border-transparent text-muted-foreground/75 hover:border-border/50 hover:bg-surface-2 hover:text-foreground'
        )}
      >
        {/* Neon vertical indicator filament for active item */}
        {active && !compact && (
          <motion.span
            layoutId="sidebar-active"
            className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-primary"
            style={{
              boxShadow: '0 0 8px var(--theme-glow)',
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}

        <div className="flex min-w-0 items-center gap-2.5">
          <Icon
            className={cn(
              'h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
              active
                ? 'text-primary'
                : 'text-muted-foreground/60 group-hover:text-foreground'
            )}
            strokeWidth={active ? 2.2 : 1.75}
          />
          {!compact && <span className="truncate">{label}</span>}
        </div>

        {/* Tactile Keyboard Keycap on Hover */}
        {!compact && (
          <span
            className={cn(
              'rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-opacity duration-150',
              active
                ? 'border-primary/30 bg-primary/20 text-primary opacity-100 font-bold'
                : 'border-border/60 bg-surface-2/80 text-muted-foreground/60 opacity-0 group-hover:opacity-100'
            )}
          >
            G {hotkey}
          </span>
        )}
      </motion.div>
    </NavLink>
  )
}

function NavList({
  compact,
  pathname,
  onNavigate,
}: {
  compact: boolean
  pathname: string
  onNavigate?: () => void
}) {
  const hiddenSections = useUIStore((s) => s.hiddenSections)

  return (
    <nav
      className={cn(
        'relative flex-1 overflow-y-auto space-y-4 no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        compact ? 'flex flex-col items-center gap-2 px-2 py-3' : 'px-3 py-3'
      )}
    >
      {NAV_GROUPS.map((group) => {
        const visibleItems = group.items.filter((item) => !hiddenSections.includes(item.to))
        if (visibleItems.length === 0) return null

        return (
          <div key={group.name} className="space-y-1">
            {!compact && (
              <div className="flex items-center justify-between px-2 pb-1">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
                  {group.name}
                </span>
                <span className="h-px flex-1 ml-2 bg-border/40" />
              </div>
            )}
            <div className={cn(compact ? 'flex flex-col items-center gap-1' : 'space-y-0.5')}>
              {visibleItems.map(({ to, icon, label, hotkey }) => (
                <NavItem
                  key={to}
                  to={to}
                  icon={icon}
                  label={label}
                  hotkey={hotkey}
                  compact={compact}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { pathname } = useLocation()
  const playClick = useSound('click')
  const { user, isAuthenticated } = useAuthStore()
  const settingsActive = pathname.startsWith('/settings')
  const authActive = pathname.startsWith('/auth')

  return (
    <>
      {/* Desktop Precision Sidebar */}
      <aside className="relative z-20 hidden h-screen w-64 shrink-0 flex-col border-r border-border/80 bg-sidebar/95 backdrop-blur-2xl shadow-2xl lg:flex no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Subtle Ambient Radial Glow on Top Rim */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-48 opacity-30"
          style={{
            background:
              'radial-gradient(ellipse 80% 100% at 50% 0%, var(--theme-glow), transparent 75%)',
          }}
        />

        <Logo />
        <NavList compact={false} pathname={pathname} />

        {/* Hardware Control Telemetry Dock at Bottom */}
        <div className="relative shrink-0 border-t border-border/70 p-3 bg-surface-1/40 space-y-1.5">
          {/* Account / Sign In Row */}
          <NavLink
            to="/auth"
            onClick={() => playClick()}
            className={cn(
              'group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all',
              authActive
                ? 'border border-primary/30 bg-primary/15 text-foreground font-semibold shadow-sm'
                : 'border border-transparent text-muted-foreground hover:border-border/60 hover:bg-surface-2 hover:text-foreground'
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isAuthenticated && user ? (
                <div className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-[10px] font-bold text-primary">
                  {user.name.charAt(0).toUpperCase()}
                  <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </div>
              ) : (
                <LogIn className={cn('h-4 w-4', authActive ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-foreground')} />
              )}
              <span className="truncate">
                {isAuthenticated && user ? user.name : 'Sign In / Account'}
              </span>
            </div>
            {isAuthenticated ? (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
            ) : (
              <span className="rounded bg-primary/10 px-1.5 py-0.2 font-mono text-[8.5px] font-semibold text-primary shrink-0">
                Auth
              </span>
            )}
          </NavLink>

          {/* Settings Row */}
          <NavLink
            to="/settings"
            onClick={() => playClick()}
            className={cn(
              'group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all',
              settingsActive
                ? 'border border-primary/30 bg-primary/15 text-foreground font-semibold shadow-sm'
                : 'border border-transparent text-muted-foreground hover:border-border/60 hover:bg-surface-2 hover:text-foreground'
            )}
          >
            <div className="flex items-center gap-2.5">
              <Settings
                className={cn(
                  'h-4 w-4 transition-transform duration-300 group-hover:rotate-45',
                  settingsActive ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-foreground'
                )}
              />
              <span>System Settings</span>
            </div>
            <span className="font-mono text-[9px] text-muted-foreground/60 uppercase">G S</span>
          </NavLink>

          {/* Local-First Silicon Security Badge */}
          <div className="rounded-xl border border-border/60 bg-surface-2/50 p-2.5 shadow-inner mt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground/90 font-mono uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Local Silicon
              </div>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
            <p className="mt-1 text-[9.5px] leading-relaxed text-muted-foreground/60">
              AES-256 local encrypted SQLite context.db
            </p>
          </div>
        </div>
      </aside>

      {/* Tablet Compact Icon Rail */}
      <aside className="relative z-20 flex h-screen w-16 shrink-0 flex-col border-r border-border/80 bg-sidebar/95 backdrop-blur-2xl shadow-xl lg:hidden no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Logo compact />
        <NavList compact pathname={pathname} />
        <div className="shrink-0 border-t border-border/70 p-2 flex flex-col items-center gap-2">
          <NavLink
            to="/auth"
            onClick={() => playClick()}
            data-ui-tooltip={isAuthenticated && user ? `Account: ${user.name}` : 'Sign In / Account'}
            aria-label={isAuthenticated && user ? `Account: ${user.name}` : 'Sign In / Account'}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl transition',
              authActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
            )}
          >
            {isAuthenticated && user ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
                {user.name.charAt(0).toUpperCase()}
              </span>
            ) : (
              <LogIn className="h-4 w-4" />
            )}
          </NavLink>

          <NavLink
            to="/settings"
            onClick={() => playClick()}
            data-ui-tooltip="Settings · G S"
            aria-label="Settings"
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl transition',
              settingsActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
            )}
          >
            <Settings className="h-4 w-4" />
          </NavLink>
        </div>
      </aside>

      {/* Mobile Overlay Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.button
              aria-label="Close navigation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border/80 bg-sidebar shadow-2xl no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="relative">
                <Logo />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close navigation"
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <NavList compact={false} pathname={pathname} onNavigate={onClose} />
              <div className="shrink-0 border-t border-border/70 p-3 space-y-1.5">
                <NavLink
                  to="/auth"
                  onClick={() => {
                    playClick()
                    onClose()
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition',
                    authActive ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                  )}
                >
                  <LogIn className="h-4 w-4" />
                  <span>{isAuthenticated && user ? `Account (${user.name})` : 'Sign In / Account'}</span>
                </NavLink>

                <NavLink
                  to="/settings"
                  onClick={() => {
                    playClick()
                    onClose()
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition',
                    settingsActive ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                  )}
                >
                  <Settings className="h-4 w-4" />
                  <span>System Settings</span>
                </NavLink>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
