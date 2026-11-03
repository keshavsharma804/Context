import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Calendar,
  FileText,
  HandCoins,
  LayoutDashboard,
  Lock,
  Mail,
  PiggyBank,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { spring } from '@/lib/animations'
import { useSound } from '@/hooks/useSound'
import { useVault } from '@/store/vault'

interface PaletteItem {
  id: string
  label: string
  hint: string
  icon: LucideIcon
  to?: string
  ask?: boolean
  action?: () => void
}

const ITEMS: PaletteItem[] = [
  { id: 'dashboard', label: 'Dashboard', hint: 'Overview · G D', icon: LayoutDashboard, to: '/' },
  { id: 'money', label: 'Money', hint: 'Spending · G M', icon: Wallet, to: '/money' },
  { id: 'subscriptions', label: 'Subscriptions', hint: 'Renewals & burn · G R', icon: Repeat, to: '/subscriptions' },
  { id: 'debts', label: 'Debts & IOUs', hint: 'Borrowed & lent · G B', icon: HandCoins, to: '/debts' },
  { id: 'savings', label: 'Savings Goals', hint: 'Target pots · G G', icon: PiggyBank, to: '/savings' },
  { id: 'people', label: 'People', hint: 'Contacts · G P', icon: Users, to: '/people' },
  { id: 'calendar', label: 'Calendar', hint: 'Events · G C', icon: Calendar, to: '/calendar' },
  { id: 'vault', label: 'Vault', hint: 'Encrypted store · G V', icon: Lock, to: '/vault' },
  { id: 'email', label: 'Email', hint: 'Inbox · G E', icon: Mail, to: '/email' },
  { id: 'jobs', label: 'Jobs', hint: 'Applications · G J', icon: Briefcase, to: '/jobs' },
  { id: 'files', label: 'Files', hint: 'Index · G F', icon: FileText, to: '/files' },
  { id: 'review', label: 'Weekly Review', hint: 'Retrospective & card · G W', icon: Sparkles, to: '/review' },
  { id: 'journal', label: 'Journal & Mood', hint: 'Daily reflection · G L', icon: BookOpen, to: '/journal' },
  { id: 'settings', label: 'Settings', hint: 'Preferences · G S', icon: Settings, to: '/settings' },
  { id: 'ask', label: 'Ask Context', hint: 'Floating chat · ⌘J', icon: Sparkles, ask: true },
]

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { unlocked, lock } = useVault()
  const playClick = useSound('click')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  const inputRef = useRef<HTMLInputElement>(null)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQuery('')
      setActive(0)
    }
  }

  const results = useMemo(() => {
    const list = [...ITEMS]
    if (unlocked) {
      list.push({
        id: 'lock-vault',
        label: 'Lock Vault',
        hint: 'Wipe key from memory',
        icon: Lock,
        action: () => lock(),
      })
    }
    const needle = query.trim().toLowerCase()
    if (!needle) return list
    return list.filter(
      (item) =>
        item.label.toLowerCase().includes(needle) ||
        item.hint.toLowerCase().includes(needle)
    )
  }, [query, unlocked, lock])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60)
    return () => window.clearTimeout(timer)
  }, [open])

  const safeActive = results.length ? Math.min(active, results.length - 1) : 0

  const choose = (item: PaletteItem | undefined) => {
    if (!item) return
    playClick()
    onClose()
    if (item.action) {
      item.action()
      return
    }
    if (item.ask) {
      window.dispatchEvent(new Event('context:toggle-ask'))
      return
    }
    if (item.to) navigate(item.to)
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
          <motion.button
            aria-label="Close command palette"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={spring.snappy}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center gap-2.5 border-b border-border/70 px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setActive((current) => (current + 1) % Math.max(1, results.length))
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setActive(
                      (current) =>
                        (current - 1 + Math.max(1, results.length)) %
                        Math.max(1, results.length)
                    )
                  } else if (event.key === 'Enter') {
                    event.preventDefault()
                    choose(results[safeActive])
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    onClose()
                  }
                }}
                placeholder="Jump to a page or action…"
                aria-label="Search commands"
                className="h-12 min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
              />
              <kbd className="rounded border border-hairline bg-surface-2 px-1.5 py-0.5 text-[9px] text-muted-foreground/50">
                esc
              </kbd>
            </div>

            <div className="max-h-[46vh] overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-[11px] text-muted-foreground/60">
                  Nothing matches “{query}”.
                </p>
              ) : (
                results.map((item, index) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(item)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                        index === safeActive
                          ? 'bg-primary/10 text-foreground'
                          : 'text-muted-foreground hover:bg-surface-2'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                          index === safeActive
                            ? 'bg-primary/15 text-primary'
                            : 'bg-surface-2 text-muted-foreground/70'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium">
                          {item.label}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground/60">
                          {item.hint}
                        </span>
                      </span>
                      <ArrowRight
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 transition-opacity',
                          index === safeActive ? 'opacity-60' : 'opacity-0'
                        )}
                      />
                    </button>
                  )
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border/70 px-3 py-2 text-[9.5px] text-muted-foreground/45">
              <span>↑↓ navigate · ↵ open</span>
              <span className="flex items-center gap-0.5">
                <kbd className="rounded border border-hairline bg-surface-2 px-1 py-0.5">?</kbd>
                all shortcuts
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
