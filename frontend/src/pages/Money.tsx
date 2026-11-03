import { useMemo, useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns'
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Edit3,
  Flame,
  HandCoins,
  History,
  Pencil,
  PiggyBank,
  Plus,
  Receipt,
  RefreshCw,
  Repeat,
  ShoppingBag,
  Sparkles,
  Trash2,
  Undo2,
  Utensils,
  Wallet,
  X,
  Zap,
  Sliders,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchConfig,
  fetchMoneySummary,
  postMoneyAdd,
  putSpendUpdate,
  deleteSpend,
  postSetBudget,
  deleteBudget,
  type SpendRow,
  type BudgetStatus,
} from '@/lib/api'
import { currencySymbol, money } from '@/lib/format'
import { PageHeader, ErrorPanel, EmptyCommand } from '@/components/pages/PageChrome'
import { CountUp } from '@/components/motion/CountUp'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useSound } from '@/hooks/useSound'
import { useColorTheme } from '@/hooks/useColorTheme'

// ─── CATEGORY METADATA & PALETTE ─────────────────────────────────────────────

interface CategoryMeta {
  label: string
  icon: typeof Utensils
  color: string
  bg: string
  border: string
  glow: string
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  food: {
    label: 'Food & Dining',
    icon: Utensils,
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.28)',
    glow: 'rgba(245, 158, 11, 0.25)',
  },
  transport: {
    label: 'Transport & Travel',
    icon: CreditCard,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.28)',
    glow: 'rgba(16, 185, 129, 0.25)',
  },
  travel: {
    label: 'Transport & Travel',
    icon: CreditCard,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.28)',
    glow: 'rgba(16, 185, 129, 0.25)',
  },
  shopping: {
    label: 'Shopping',
    icon: ShoppingBag,
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.12)',
    border: 'rgba(168, 85, 247, 0.28)',
    glow: 'rgba(168, 85, 247, 0.25)',
  },
  bills: {
    label: 'Bills & Utilities',
    icon: Receipt,
    color: '#06b6d4',
    bg: 'rgba(6, 182, 212, 0.12)',
    border: 'rgba(6, 182, 212, 0.28)',
    glow: 'rgba(6, 182, 212, 0.25)',
  },
  subscriptions: {
    label: 'Subscriptions',
    icon: Repeat,
    color: '#ec4899',
    bg: 'rgba(236, 72, 153, 0.12)',
    border: 'rgba(236, 72, 153, 0.28)',
    glow: 'rgba(236, 72, 153, 0.25)',
  },
  other: {
    label: 'Other',
    icon: Wallet,
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.12)',
    border: 'rgba(148, 163, 184, 0.28)',
    glow: 'rgba(148, 163, 184, 0.2)',
  },
}

const CATEGORY_KEYS = ['food', 'transport', 'shopping', 'bills', 'subscriptions', 'other'] as const

function getCategoryMeta(cat: string): CategoryMeta {
  const normalized = (cat || 'other').toLowerCase().trim()
  return CATEGORY_META[normalized] || CATEGORY_META.other
}

function dayHeading(iso: string) {
  const today = new Date()
  const date = new Date(`${iso}T00:00:00`)
  const todayKey = today.toISOString().slice(0, 10)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (iso === todayKey) return 'Today'
  if (iso === yesterday.toISOString().slice(0, 10)) return 'Yesterday'
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatDateShort(iso: string) {
  const todayKey = new Date().toISOString().slice(0, 10)
  const yesterdayKey = subDays(new Date(), 1).toISOString().slice(0, 10)
  if (iso === todayKey) return 'Today'
  if (iso === yesterdayKey) return 'Yesterday'
  try {
    return format(new Date(`${iso}T00:00:00`), 'dd MMM')
  } catch {
    return iso
  }
}

// ─── TACTILE CUSTOM DATE PICKER ──────────────────────────────────────────────

interface TactileDatePickerProps {
  value: string // 'YYYY-MM-DD'
  onChange: (dateStr: string) => void
  onClose: () => void
  align?: 'left' | 'right'
  position?: 'top' | 'bottom'
}

function TactileDatePicker({
  value,
  onChange,
  onClose,
  align = 'right',
  position = 'bottom',
}: TactileDatePickerProps) {
  const playClick = useSound('click')
  const initialDate = useMemo(() => {
    try {
      return value ? new Date(`${value}T00:00:00`) : new Date()
    } catch {
      return new Date()
    }
  }, [value])

  const [currentMonth, setCurrentMonth] = useState<Date>(initialDate)

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: startDate, end: endDate })
  }, [currentMonth])

  const selectDate = (d: Date) => {
    playClick()
    const formatted = format(d, 'yyyy-MM-dd')
    onChange(formatted)
    onClose()
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 4 : -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: position === 'top' ? 4 : -4 }}
        transition={{ duration: 0.15 }}
        className={cn(
          'absolute z-50 w-64 rounded-xl border border-border/90 bg-[#121518] p-3 shadow-2xl backdrop-blur-xl',
          position === 'top' ? 'bottom-full mb-1.5' : 'top-11',
          align === 'right' ? 'right-0' : 'left-0'
        )}
      >
        {/* Quick Presets */}
        <div className="mb-2 flex items-center gap-1 border-b border-border/50 pb-2">
          <button
            type="button"
            onClick={() => selectDate(new Date())}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
              value === todayStr
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground'
            )}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => selectDate(subDays(new Date(), 1))}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
              value === yesterdayStr
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground'
            )}
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => selectDate(subDays(new Date(), 2))}
            className="flex-1 rounded-md bg-surface-2 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground transition-colors"
          >
            2d ago
          </button>
        </div>

        {/* Month Navigation */}
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="font-mono text-xs font-semibold text-foreground">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                playClick()
                setCurrentMonth((prev) => subMonths(prev, 1))
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-surface-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                playClick()
                setCurrentMonth((prev) => addMonths(prev, 1))
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-surface-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
          <span>Su</span>
        </div>

        {/* Days Grid */}
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const isSelected = dateStr === value
            const inMonth = isSameMonth(day, currentMonth)
            const isCurrentToday = isToday(day)

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => selectDate(day)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg font-mono text-[11px] transition-all',
                  isSelected
                    ? 'bg-primary font-bold text-primary-foreground shadow-sm'
                    : isCurrentToday
                    ? 'border border-primary/40 bg-primary/10 text-primary font-semibold'
                    : inMonth
                    ? 'text-foreground/90 hover:bg-surface-2 hover:text-foreground'
                    : 'text-muted-foreground/30 hover:bg-surface-2/50'
                )}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
      </motion.div>
    </>
  )
}

function parseSmartNLP(raw: string) {
  let clean = raw.trim()
  if (!clean) return { amount: null, merchant: '', category: 'other' }

  let amount: number | null = null
  const match = clean.match(/(?:(?:rs\.?|inr|₹)\s*)?(\d+(?:\.\d{1,2})?)/i)
  if (match) {
    amount = parseFloat(match[1])
    clean = clean.replace(match[0], ' ').trim()
  }

  const lower = clean.toLowerCase()
  let category = 'other'
  if (
    /\b(coffee|tea|lunch|dinner|breakfast|food|cafe|swiggy|zomato|burger|pizza|snack|mcd|starbucks|kfc|restaurant|groceries)\b/.test(
      lower
    )
  ) {
    category = 'food'
  } else if (
    /\b(uber|ola|cab|auto|metro|fuel|petrol|diesel|flight|train|bus|rapido|taxi|transport|ride)\b/.test(
      lower
    )
  ) {
    category = 'transport'
  } else if (
    /\b(amazon|flipkart|myntra|clothes|shirt|shoes|shopping|blinkit|zepto|instamart|book|gadget)\b/.test(
      lower
    )
  ) {
    category = 'shopping'
  } else if (
    /\b(bill|recharge|wifi|broadband|electricity|rent|maintenance|water|gas|electric)\b/.test(
      lower
    )
  ) {
    category = 'bills'
  } else if (
    /\b(netflix|spotify|youtube|prime|hotstar|icloud|subscription|gym|apple)\b/.test(lower)
  ) {
    category = 'subscriptions'
  }

  let merchant = clean
    .replace(/\b(for|at|on|with|to)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!merchant && category !== 'other') {
    merchant = category.charAt(0).toUpperCase() + category.slice(1)
  }

  return { amount, merchant: merchant || '', category }
}

// ─── OMNI-INPUT COMMAND STRIP ────────────────────────────────────────────────

interface OmniInputProps {
  symbol: string
  onSpendAdded: (spend: { amount: number; merchant: string; category: string; spent_at?: string }) => void
}

function OmniInputBar({ symbol, onSpendAdded }: OmniInputProps) {
  const [mode, setMode] = useState<'structured' | 'nlp'>('structured')
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [category, setCategory] = useState<string>('food')
  const [spentAt, setSpentAt] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [catMenuOpen, setCatMenuOpen] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [nlpText, setNlpText] = useState('')

  const playClick = useSound('click')
  const playChime = useSound('chime')

  const amountRef = useRef<HTMLInputElement>(null)
  const nlpRef = useRef<HTMLInputElement>(null)

  const parsedNlp = useMemo(() => parseSmartNLP(nlpText), [nlpText])
  const activeMeta = getCategoryMeta(category)
  const ActiveIcon = activeMeta.icon

  const handleStructuredSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid amount')
      amountRef.current?.focus()
      return
    }

    const finalMerchant = merchant.trim() || activeMeta.label
    onSpendAdded({
      amount: parsedAmount,
      merchant: finalMerchant,
      category,
      spent_at: spentAt,
    })

    setAmount('')
    setMerchant('')
    playChime()
    amountRef.current?.focus()
  }

  const handleNlpSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!parsedNlp.amount || parsedNlp.amount <= 0) {
      toast.error('Please include an amount, e.g. "150 coffee"')
      nlpRef.current?.focus()
      return
    }

    onSpendAdded({
      amount: parsedNlp.amount,
      merchant: parsedNlp.merchant || 'Quick spend',
      category: parsedNlp.category,
      spent_at: spentAt,
    })

    setNlpText('')
    playChime()
    nlpRef.current?.focus()
  }

  const anyDropdownOpen = catMenuOpen || datePickerOpen

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-primary/20 bg-card/85 p-2 sm:p-2.5 backdrop-blur-xl shadow-lg shadow-primary/5 transition-all focus-within:border-primary/40 focus-within:shadow-primary/10',
        anyDropdownOpen ? 'z-40' : 'z-30'
      )}
    >
      {/* Header bar / mode switcher */}
      <div className="mb-2 flex items-center justify-between px-1 text-[11px]">
        <div className="flex items-center gap-1.5 font-medium text-foreground/90">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span>Omni-Input Bar</span>
          <span className="hidden text-muted-foreground/60 sm:inline">· Zero modals, instant keyboard velocity</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => {
              playClick()
              setMode('structured')
            }}
            className={cn(
              'rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors',
              mode === 'structured'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Tabular Fast-Log
          </button>
          <button
            type="button"
            onClick={() => {
              playClick()
              setMode('nlp')
            }}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors',
              mode === 'nlp'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Sparkles className="h-2.5 w-2.5" />
            Smart Natural Language
          </button>
        </div>
      </div>

      {mode === 'structured' ? (
        <form onSubmit={handleStructuredSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Amount input */}
          <div className="relative flex min-w-[110px] max-w-full items-center rounded-xl border border-border/70 bg-surface-2 px-3 py-1.5 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40 sm:w-32">
            <span className="mr-1 text-sm font-semibold text-muted-foreground select-none">{symbol}</span>
            <input
              ref={amountRef}
              type="number"
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent font-mono text-sm font-bold tabular-nums text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </div>

          {/* Merchant input */}
          <div className="relative flex flex-1 items-center rounded-xl border border-border/70 bg-surface-2 px-3 py-1.5 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40">
            <input
              type="text"
              placeholder="Where did it go? (e.g. Blue Tokai, Metro, Swiggy)..."
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
          </div>

          {/* Category Dropdown Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                playClick()
                setDatePickerOpen(false)
                setCatMenuOpen((prev) => !prev)
              }}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-border/70 bg-surface-2 px-3 text-xs font-medium transition hover:bg-surface-3"
              style={{ color: activeMeta.color }}
            >
              <ActiveIcon className="h-3.5 w-3.5" />
              <span className="capitalize">{activeMeta.label.split(' ')[0]}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground opacity-60" />
            </button>

            <AnimatePresence>
              {catMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCatMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-11 z-50 w-48 rounded-xl border border-border/90 bg-[#121518] p-1.5 shadow-2xl backdrop-blur-xl"
                  >
                    {CATEGORY_KEYS.map((k) => {
                      const item = CATEGORY_META[k]
                      const ItemIcon = item.icon
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            setCategory(k)
                            setCatMenuOpen(false)
                            playClick()
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors',
                            category === k
                              ? 'bg-surface-3 font-semibold text-foreground'
                              : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                          )}
                        >
                          <span
                            className="flex h-5 w-5 items-center justify-center rounded-md"
                            style={{ backgroundColor: item.bg, color: item.color }}
                          >
                            <ItemIcon className="h-3 w-3" />
                          </span>
                          <span className="truncate">{item.label}</span>
                          {category === k && <Check className="ml-auto h-3 w-3 text-primary" />}
                        </button>
                      )
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Date Selector Pill with Custom Calendar */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                playClick()
                setCatMenuOpen(false)
                setDatePickerOpen((prev) => !prev)
              }}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-border/70 bg-surface-2 px-2.5 text-xs font-medium text-foreground hover:bg-surface-3 transition"
            >
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-[11px]">{formatDateShort(spentAt)}</span>
              <ChevronDown className="h-2.5 w-2.5 text-muted-foreground opacity-60" />
            </button>

            <AnimatePresence>
              {datePickerOpen && (
                <TactileDatePicker
                  value={spentAt}
                  onChange={(d) => setSpentAt(d)}
                  onClose={() => setDatePickerOpen(false)}
                  align="right"
                />
              )}
            </AnimatePresence>
          </div>

          {/* Quick Submit */}
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Log</span>
            <kbd className="hidden rounded bg-primary-foreground/20 px-1 font-mono text-[9px] opacity-80 sm:inline">
              ↵
            </kbd>
          </button>
        </form>
      ) : (
        <form onSubmit={handleNlpSubmit} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex flex-1 items-center rounded-xl border border-border/70 bg-surface-2 px-3 py-2 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40">
              <Sparkles className="mr-2 h-4 w-4 text-primary shrink-0" />
              <input
                ref={nlpRef}
                type="text"
                autoFocus
                placeholder='Type naturally, e.g. "150 lunch with rahul" or "uber 240" or "netflix 649"...'
                value={nlpText}
                onChange={(e) => setNlpText(e.target.value)}
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 active:scale-95"
            >
              <span>Instant Log</span>
              <kbd className="rounded bg-primary-foreground/20 px-1 font-mono text-[9px] opacity-80">↵</kbd>
            </button>
          </div>

          {/* Live NLP token breakdown pills */}
          {nlpText.trim() && (
            <motion.div
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center gap-2 px-1 text-[11px]"
            >
              <span className="text-muted-foreground/70">Live Preview:</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 font-mono font-semibold tabular-nums text-foreground">
                {parsedNlp.amount ? `${symbol}${parsedNlp.amount}` : `${symbol}0.00`}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-foreground/80">
                "{parsedNlp.merchant || '...'}"
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium capitalize"
                style={{
                  backgroundColor: getCategoryMeta(parsedNlp.category).bg,
                  color: getCategoryMeta(parsedNlp.category).color,
                }}
              >
                {parsedNlp.category}
              </span>
            </motion.div>
          )}
        </form>
      )}
    </div>
  )
}

// ─── CASH FLOW VELOCITY & SPECTRUM BAR ───────────────────────────────────────

interface VelocityBarProps {
  total: number
  symbol: string
  byCategory: { category: string; total: number; count: number }[]
  trend: { date: string; total: number; count: number }[]
  budgets: BudgetStatus[]
  period: 'week' | 'month'
  activeCategory: string | null
  hoveredCategory: string | null
  onHoverCategory: (cat: string | null) => void
  onSelectCategory: (cat: string | null) => void
}

function CashFlowVelocityBar({
  total,
  symbol,
  byCategory,
  trend,
  budgets,
  period,
  activeCategory,
  hoveredCategory,
  onHoverCategory,
  onSelectCategory,
}: VelocityBarProps) {
  const playClick = useSound('click')
  const { theme: colorTheme } = useColorTheme()

  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dayOfMonth = today.getDate()
  const remainingDays = period === 'month' ? Math.max(1, daysInMonth - dayOfMonth + 1) : Math.max(1, 7 - today.getDay())

  const totalBudget = useMemo(() => {
    return budgets.reduce((acc, b) => acc + (b.budget || 0), 0)
  }, [budgets])

  const safeDailyPulse = useMemo(() => {
    if (totalBudget > 0) {
      const remaining = Math.max(0, totalBudget - total)
      return Math.round(remaining / remainingDays)
    }
    const daysElapsed = period === 'month' ? Math.max(1, dayOfMonth) : Math.max(1, today.getDay() || 7)
    const runRate = total / daysElapsed
    return Math.round(runRate)
  }, [totalBudget, total, remainingDays, period, dayOfMonth, today])

  const sparkData = useMemo(() => {
    return trend.slice(-14).map((d) => ({
      date: d.date,
      total: d.total,
      label: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric' }),
    }))
  }, [trend])

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5 backdrop-blur-xl">
      {/* Top Pulse Row */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
              Fluid Category Spectrum & Burn Velocity
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground sm:text-3xl">
              <CountUp value={total} prefix={symbol} />
            </span>
            <span className="text-xs text-muted-foreground">spent this {period}</span>
          </div>
        </div>

        {/* Safe-to-Spend Daily Pulse Pill */}
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface-2/60 px-3.5 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
              {totalBudget > 0 ? 'Safe Daily Burn Pace' : 'Daily Burn Velocity'}
            </p>
            <p className="font-mono text-xs font-bold tabular-nums text-foreground">
              {symbol}
              {safeDailyPulse}
              <span className="font-sans font-normal text-[10px] text-muted-foreground"> / day remaining</span>
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Liquid Spectrum Bar */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Distribution Spectrum</span>
          <span className="text-[10px] text-muted-foreground/60">Hover to isolate · Click to lock filter</span>
        </div>

        <div className="relative flex h-3.5 w-full overflow-hidden rounded-full bg-surface-3 p-0.5 shadow-inner">
          {total === 0 ? (
            <div className="h-full w-full rounded-full bg-muted-foreground/20" />
          ) : (
            byCategory.map((cat) => {
              const meta = getCategoryMeta(cat.category)
              const pct = (cat.total / Math.max(total, 1)) * 100
              const isHovered = hoveredCategory === cat.category
              const isSelected = activeCategory === cat.category
              const isDimmed = (hoveredCategory && !isHovered) || (activeCategory && !isSelected)

              return (
                <div
                  key={cat.category}
                  onMouseEnter={() => onHoverCategory(cat.category)}
                  onMouseLeave={() => onHoverCategory(null)}
                  onClick={() => {
                    playClick()
                    onSelectCategory(activeCategory === cat.category ? null : cat.category)
                  }}
                  style={{
                    width: `${Math.max(pct, 3)}%`,
                    backgroundColor: meta.color,
                    boxShadow: isHovered || isSelected ? `0 0 10px ${meta.color}` : undefined,
                  }}
                  className={cn(
                    'group relative h-full cursor-pointer transition-all duration-200 first:rounded-l-full last:rounded-r-full',
                    isDimmed && 'opacity-35 saturate-50',
                    (isHovered || isSelected) && 'z-10 scale-y-125'
                  )}
                  title={`${meta.label}: ${money(cat.total, symbol)} (${Math.round(pct)}%)`}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Category Pills & Compact Trend Sparkline */}
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {byCategory.map((cat) => {
            const meta = getCategoryMeta(cat.category)
            const pct = Math.round((cat.total / Math.max(total, 1)) * 100)
            const isSelected = activeCategory === cat.category
            const isHovered = hoveredCategory === cat.category

            return (
              <button
                key={cat.category}
                type="button"
                onMouseEnter={() => onHoverCategory(cat.category)}
                onMouseLeave={() => onHoverCategory(null)}
                onClick={() => {
                  playClick()
                  onSelectCategory(isSelected ? null : cat.category)
                }}
                className={cn(
                  'group flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-all',
                  isSelected
                    ? 'border-primary bg-primary/15 font-semibold text-foreground shadow-sm'
                    : isHovered
                    ? 'border-border bg-surface-2 text-foreground'
                    : 'border-border/50 bg-card/40 text-muted-foreground hover:border-border hover:text-foreground'
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                <span className="capitalize">{cat.category}</span>
                <span className="font-mono tabular-nums text-foreground/80">{money(cat.total, symbol, true)}</span>
                <span className="text-[9px] text-muted-foreground">({pct}%)</span>
              </button>
            )
          })}

          {activeCategory && (
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Reset filter
            </button>
          )}
        </div>

        {/* Compact 40px Velocity Ticker */}
        {sparkData.length > 1 && (
          <div className="flex items-center gap-2 self-end lg:self-center">
            <span className="text-[9px] text-muted-foreground/60 uppercase tracking-widest hidden sm:inline">
              14d rhythm
            </span>
            <div className="h-8 w-32 sm:w-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData}>
                  <defs>
                    <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colorTheme.primary} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={colorTheme.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const item = payload[0].payload
                      return (
                        <div className="rounded border border-border bg-popover px-1.5 py-0.5 text-[9px] font-mono shadow-md">
                          {item.label}: {money(item.total, symbol)}
                        </div>
                      )
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={colorTheme.primary}
                    strokeWidth={1.5}
                    fill="url(#sparkFill)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CATEGORY BUDGETS & SURPLUS DECK ─────────────────────────────────────────

interface CategoryBudgetDeckProps {
  budgets: BudgetStatus[]
  symbol: string
  period: 'week' | 'month'
  onBudgetUpdated: () => void
}

function CategoryBudgetDeck({ budgets, symbol, period, onBudgetUpdated }: CategoryBudgetDeckProps) {
  const playClick = useSound('click')
  const playChime = useSound('chime')

  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [addingCategory, setAddingCategory] = useState('food')
  const [addAmount, setAddAmount] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)

  // Common spending categories to suggest
  const ALL_CATEGORIES = [
    { key: 'food', label: 'Food & Dining', meta: CATEGORY_META.food },
    { key: 'transport', label: 'Transport & Travel', meta: CATEGORY_META.transport },
    { key: 'shopping', label: 'Shopping', meta: CATEGORY_META.shopping },
    { key: 'bills', label: 'Bills & Utilities', meta: CATEGORY_META.bills },
    { key: 'subscriptions', label: 'Subscriptions', meta: CATEGORY_META.subscriptions },
    { key: 'other', label: 'Other & Discretionary', meta: CATEGORY_META.other },
  ]

  const activeBudgetCategories = useMemo(() => new Set(budgets.map((b) => b.category.toLowerCase())), [budgets])
  const unbudgetedCategories = useMemo(
    () => ALL_CATEGORIES.filter((c) => !activeBudgetCategories.has(c.key)),
    [activeBudgetCategories]
  )

  const totalBudget = useMemo(() => budgets.reduce((acc, b) => acc + (b.budget || 0), 0), [budgets])
  const totalSurplus = useMemo(
    () => budgets.reduce((acc, b) => acc + Math.max(0, (b.budget || 0) - (b.spent || 0)), 0),
    [budgets]
  )

  const handleSaveBudget = async (category: string, amountStr: string) => {
    const val = parseFloat(amountStr)
    if (isNaN(val) || val <= 0) {
      toast.error('Please enter a valid budget amount')
      return
    }
    setLoading(true)
    try {
      await postSetBudget(category, val, period)
      playChime()
      toast.success(`Set ${category} budget to ${money(val, symbol)} / ${period}`)
      setEditingCategory(null)
      setShowAddForm(false)
      setAddAmount('')
      setAddingCategory('food')
      onBudgetUpdated()
    } catch (err: any) {
      toast.error(err.message || 'Failed to set budget')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBudget = async (category: string) => {
    playClick()
    try {
      await deleteBudget(category)
      playChime()
      toast.success(`Removed budget cap for ${category}`)
      onBudgetUpdated()
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove budget')
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5 backdrop-blur-xl shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Monthly Category Budgets & Caps</h3>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary font-bold">
                {budgets.length} ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Define spending limits per category to automatically detect surplus margins for your savings pots
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totalBudget > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-mono">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Surplus Left:</span>
              <strong className="text-emerald-400 font-bold">
                {symbol}{totalSurplus.toLocaleString()}
              </strong>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              playClick()
              setShowAddForm((v) => !v)
              if (!showAddForm && unbudgetedCategories.length > 0) {
                setAddingCategory(unbudgetedCategories[0].key)
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary/15 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25 transition active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Set Budget</span>
          </button>
        </div>
      </div>

      {/* Quick Add Budget Strip */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden rounded-xl border border-primary/30 bg-primary/5 p-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex-1 flex items-center gap-2">
                <select
                  value={addingCategory}
                  onChange={(e) => setAddingCategory(e.target.value)}
                  className="rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label} {activeBudgetCategories.has(c.key) ? '(Update)' : ''}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                    {symbol}
                  </span>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-surface-2 py-2 pl-7 pr-3 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading || !addAmount}
                  onClick={() => handleSaveBudget(addingCategory || 'food', addAmount)}
                  className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Budget</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Budget Cards Grid (High Density 3-Columns) */}
      {budgets.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border/60 bg-surface-1/40 p-6 text-center">
          <p className="text-xs text-muted-foreground">
            No category budgets set yet. Click <strong>+ Set Budget</strong> above to cap your Food, Travel, or Shopping spends!
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((b) => {
            const meta = CATEGORY_META[b.category.toLowerCase()] || CATEGORY_META.other
            const Icon = meta.icon
            const remaining = Math.max(0, b.budget - b.spent)
            const percent = b.budget > 0 ? Math.round((b.spent / b.budget) * 100) : 0
            const isEditing = editingCategory === b.category

            return (
              <div
                key={b.category}
                className={cn(
                  'relative rounded-xl border p-3.5 shadow-sm transition backdrop-blur-md flex flex-col justify-between',
                  b.over
                    ? 'border-rose-500/40 bg-rose-500/5'
                    : percent >= 80
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-border/70 bg-surface-1/80 hover:border-primary/40'
                )}
              >
                <div>
                  {/* Category Pill + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-lg shadow-inner"
                        style={{ backgroundColor: meta.bg, color: meta.color }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-semibold text-xs text-foreground capitalize">
                        {meta.label || b.category}
                      </span>
                    </div>

                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-mono font-bold',
                        b.over
                          ? 'bg-rose-500/20 text-rose-400'
                          : percent >= 80
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-400'
                      )}
                    >
                      {b.over ? `⚠️ +${money(Math.round(b.spent - b.budget), symbol)} OVER` : `${symbol}${remaining.toLocaleString()} left`}
                    </span>
                  </div>

                  {/* Amounts */}
                  <div className="mt-3 flex items-baseline justify-between font-mono text-xs">
                    <span className="text-muted-foreground">
                      Spent: <strong className="text-foreground">{money(b.spent, symbol)}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Cap: <strong className="text-foreground">{money(b.budget, symbol)}</strong>
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        b.over ? 'bg-rose-500' : percent >= 80 ? 'bg-amber-400' : 'bg-emerald-400'
                      )}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                </div>

                {/* Inline Edit or Action Footer */}
                <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 w-full">
                      <input
                        type="number"
                        autoFocus
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        placeholder={String(b.budget)}
                        className="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveBudget(b.category, editAmount)}
                        className="rounded-lg bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCategory(null)}
                        className="rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-surface-2"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {percent}% of monthly budget
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            playClick()
                            setEditingCategory(b.category)
                            setEditAmount(String(b.budget))
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
                          title="Adjust Budget"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBudget(b.category)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 transition"
                          title="Remove Budget"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── HIGH-DENSITY 3-COL INTERACTIVE STREAM DECK TILE ─────────────────────────

interface SpendTileProps {
  row: SpendRow
  symbol: string
  isHighlighted: boolean
  isDimmed: boolean
  onUpdate: (id: number, data: { amount?: number; merchant?: string; category?: string; spent_at?: string }) => void
  onDelete: (row: SpendRow) => void
}

function SpendStreamTile({ row, symbol, isHighlighted, isDimmed, onUpdate, onDelete }: SpendTileProps) {
  const playClick = useSound('click')
  const playChime = useSound('chime')
  const playPop = useSound('pop')

  // Inline editing states
  const [editingAmount, setEditingAmount] = useState(false)
  const [amountVal, setAmountVal] = useState(String(row.amount))

  const [editingMerchant, setEditingMerchant] = useState(false)
  const [merchantVal, setMerchantVal] = useState(row.merchant || '')

  const [catMenuOpen, setCatMenuOpen] = useState(false)
  const [dateDrawerOpen, setDateDrawerOpen] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [dateVal, setDateVal] = useState(row.spent_at ? row.spent_at.slice(0, 10) : format(new Date(), 'yyyy-MM-dd'))

  const meta = getCategoryMeta(row.category)
  const Icon = meta.icon

  useEffect(() => {
    setAmountVal(String(row.amount))
    setMerchantVal(row.merchant || '')
    setDateVal(row.spent_at ? row.spent_at.slice(0, 10) : format(new Date(), 'yyyy-MM-dd'))
  }, [row.amount, row.merchant, row.spent_at])

  const saveAmount = () => {
    setEditingAmount(false)
    const parsed = parseFloat(amountVal)
    if (isNaN(parsed) || parsed <= 0 || parsed === row.amount) {
      setAmountVal(String(row.amount))
      return
    }
    playChime()
    onUpdate(row.id, { amount: parsed })
  }

  const saveMerchant = () => {
    setEditingMerchant(false)
    const trimmed = merchantVal.trim()
    if (!trimmed || trimmed === row.merchant) {
      setMerchantVal(row.merchant || '')
      return
    }
    playClick()
    onUpdate(row.id, { merchant: trimmed })
  }

  const saveCategory = (newCat: string) => {
    setCatMenuOpen(false)
    if (newCat === row.category) return
    playClick()
    onUpdate(row.id, { category: newCat })
  }

  const saveDate = (newDate: string) => {
    setDateVal(newDate)
    setDateDrawerOpen(false)
    setDatePickerOpen(false)
    if (newDate && newDate !== row.spent_at) {
      playClick()
      onUpdate(row.id, { spent_at: newDate })
    }
  }

  const hasOpenPopover = catMenuOpen || datePickerOpen

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: isDimmed ? 0.35 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      className={cn(
        'group relative flex flex-col justify-between overflow-visible rounded-xl border bg-card/75 p-3 backdrop-blur-md transition-all duration-200',
        hasOpenPopover ? 'z-30' : 'z-10',
        isHighlighted
          ? 'border-primary ring-1 ring-primary/40 shadow-md shadow-primary/10'
          : 'border-border/70 hover:border-border hover:bg-card/95 hover:shadow-md hover:shadow-black/10'
      )}
    >
      {/* Category Ambient Top Glow Hairline */}
      <span
        className="pointer-events-none absolute inset-x-3 top-0 h-[2px] rounded-full transition-all duration-300 group-hover:h-[3px]"
        style={{
          backgroundColor: meta.color,
          boxShadow: `0 0 10px ${meta.glow}`,
        }}
      />

      {/* Category Ambient Left Indicator */}
      <span
        className="pointer-events-none absolute inset-y-2 left-0 w-1 rounded-r-full"
        style={{ backgroundColor: meta.color }}
      />

      <div className="space-y-2.5">
        {/* Row 1: Category Micro-Capsule & Timestamp */}
        <div className="flex items-center justify-between gap-1">
          {/* Category Pill with Micro-Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                playClick()
                setCatMenuOpen((v) => !v)
              }}
              title="Tap to change category"
              className="flex h-6 items-center gap-1.5 rounded-lg border border-transparent px-2 text-[10px] font-semibold transition hover:border-border hover:bg-surface-3"
              style={{ backgroundColor: meta.bg, color: meta.color }}
            >
              <Icon className="h-3 w-3" />
              <span className="capitalize">{row.category}</span>
              <ChevronDown className="h-2.5 w-2.5 opacity-60" />
            </button>

            <AnimatePresence>
              {catMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCatMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    className="absolute left-0 top-8 z-50 w-44 rounded-xl border border-border/90 bg-[#121518] p-1.5 shadow-2xl backdrop-blur-xl"
                  >
                    {CATEGORY_KEYS.map((k) => {
                      const item = CATEGORY_META[k]
                      const ItemIcon = item.icon
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => saveCategory(k)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                            row.category === k
                              ? 'bg-surface-3 font-semibold text-foreground'
                              : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                          )}
                        >
                          <span
                            className="flex h-4 w-4 items-center justify-center rounded-md"
                            style={{ backgroundColor: item.bg, color: item.color }}
                          >
                            <ItemIcon className="h-2.5 w-2.5" />
                          </span>
                          <span className="truncate text-[11px]">{item.label}</span>
                          {row.category === k && <Check className="ml-auto h-3 w-3 text-primary" />}
                        </button>
                      )
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Time / Date label */}
          <button
            type="button"
            onClick={() => {
              playClick()
              setDateDrawerOpen((v) => !v)
            }}
            title="Click to view/change date"
            className="font-mono text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            {row.created_at
              ? new Date(row.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              : formatDateShort(row.spent_at)}
          </button>
        </div>

        {/* Row 2: Merchant Title (Hero, Inline 1-Click Tap-to-Edit) */}
        <div className="min-w-0">
          {editingMerchant ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="text"
                value={merchantVal}
                onChange={(e) => setMerchantVal(e.target.value)}
                onBlur={saveMerchant}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveMerchant()
                  if (e.key === 'Escape') {
                    setMerchantVal(row.merchant || '')
                    setEditingMerchant(false)
                  }
                }}
                className="w-full rounded-md border border-primary bg-surface-3 px-2 py-0.5 text-xs font-semibold text-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={saveMerchant}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
              >
                <Check className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingMerchant(true)}
              title="Click to rename"
              className="group/m flex w-full items-center justify-between text-left transition hover:text-primary"
            >
              <span className="truncate text-xs sm:text-[13px] font-semibold text-foreground/90">
                {row.merchant || 'Unknown merchant'}
              </span>
              <Pencil className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover/m:opacity-100 transition-opacity" />
            </button>
          )}
        </div>

        {/* Row 3: Tabular Monospace Amount + Micro Action Cluster */}
        <div className="flex items-center justify-between pt-0.5">
          {/* Editable Amount Figure */}
          {editingAmount ? (
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs font-bold text-muted-foreground">{symbol}</span>
              <input
                autoFocus
                type="number"
                step="any"
                value={amountVal}
                onChange={(e) => setAmountVal(e.target.value)}
                onBlur={saveAmount}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveAmount()
                  if (e.key === 'Escape') {
                    setAmountVal(String(row.amount))
                    setEditingAmount(false)
                  }
                }}
                className="w-20 rounded-md border border-primary bg-surface-3 px-1.5 py-0.5 text-right font-mono text-xs sm:text-sm font-bold tabular-nums text-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={saveAmount}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
              >
                <Check className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingAmount(true)}
              title="Click figure to edit amount"
              className="rounded-lg border border-transparent bg-surface-2/80 px-2 py-0.5 font-mono text-sm sm:text-base font-bold tabular-nums text-foreground transition-all hover:scale-105 hover:border-primary/40 hover:bg-surface-3"
            >
              {money(row.amount, symbol)}
            </button>
          )}

          {/* Micro Action Buttons */}
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => {
                playClick()
                setDateDrawerOpen((v) => !v)
              }}
              title="Change date"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface-3 hover:text-foreground"
            >
              <CalendarIcon className="h-3 w-3" />
            </button>

            <button
              type="button"
              onClick={() => {
                playPop()
                onDelete(row)
              }}
              title="Delete transaction (Undo available)"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-rose-500/15 hover:text-rose-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Inline Date Drawer with Presets & Custom Calendar */}
      <AnimatePresence>
        {dateDrawerOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative mt-2 border-t border-border/40 pt-2 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => saveDate(format(new Date(), 'yyyy-MM-dd'))}
                  className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => saveDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
                  className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                >
                  Yesterday
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      playClick()
                      setDatePickerOpen((v) => !v)
                    }}
                    className="flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-foreground hover:bg-surface-3"
                  >
                    <span>{formatDateShort(dateVal)}</span>
                    <ChevronDown className="h-2 w-2 opacity-60" />
                  </button>

                  <AnimatePresence>
                    {datePickerOpen && (
                      <TactileDatePicker
                        value={dateVal}
                        onChange={(d) => saveDate(d)}
                        onClose={() => setDatePickerOpen(false)}
                        align="left"
                        position="top"
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDateDrawerOpen(false)}
                className="text-muted-foreground/60 hover:text-foreground p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── MAIN MONEY COMPONENT ────────────────────────────────────────────────────

export default function Money() {
  const [period, setPeriod] = useState<'week' | 'month'>('month')
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null)
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const playClick = useSound('click')
  const playChime = useSound('chime')

  const moneyQuery = useQuery({
    queryKey: ['money', period],
    queryFn: () => fetchMoneySummary(period),
  })

  const { data: config } = useQuery({ queryKey: ['config'], queryFn: fetchConfig })
  const symbol = currencySymbol(config?.symbol)

  // Mutations
  const addMutation = useMutation({
    mutationFn: (newSpend: { amount: number; merchant: string; category: string; spent_at?: string }) =>
      postMoneyAdd(newSpend.amount, newSpend.merchant, newSpend.category, newSpend.spent_at),
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['money'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      toast.success(`Logged ${money(variables.amount, symbol)} at ${variables.merchant || 'quick spend'}`)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Could not log spend')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: { amount?: number; merchant?: string; category?: string; spent_at?: string }
    }) => putSpendUpdate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['money'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      toast.success('Updated successfully')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Update failed')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSpend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['money'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Delete failed')
    },
  })

  const handleDeleteWithUndo = (row: SpendRow) => {
    deleteMutation.mutate(row.id)
    toast(`Deleted ${money(row.amount, symbol)} at ${row.merchant}`, {
      description: 'Tap undo within 6 seconds to restore.',
      action: {
        label: 'Undo',
        onClick: () => {
          addMutation.mutate({
            amount: row.amount,
            merchant: row.merchant,
            category: row.category,
            spent_at: row.spent_at,
          })
          toast.success('Restored transaction')
        },
      },
    })
  }

  // Filtered & grouped transactions
  const groupedTransactions = useMemo(() => {
    if (!moneyQuery.data?.transactions) return []
    const all = moneyQuery.data.transactions

    const filtered = activeCategoryFilter
      ? all.filter((r) => r.category.toLowerCase() === activeCategoryFilter.toLowerCase())
      : all

    const map = new Map<string, SpendRow[]>()
    filtered.forEach((row) => {
      const dateKey = (row.spent_at || row.created_at || '').slice(0, 10) || 'Unknown'
      if (!map.has(dateKey)) map.set(dateKey, [])
      map.get(dateKey)!.push(row)
    })

    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [moneyQuery.data?.transactions, activeCategoryFilter])

  if (moneyQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (moneyQuery.isError || !moneyQuery.data) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <PageHeader icon={Wallet} eyebrow="Money" title="Spending" />
        <ErrorPanel
          error={moneyQuery.error}
          onRetry={() => moneyQuery.refetch()}
          retrying={moneyQuery.isFetching}
          className="mt-6"
        />
      </div>
    )
  }

  const data = moneyQuery.data

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header with Navigation and Period Switcher */}
      <PageHeader
        icon={Wallet}
        eyebrow="Money & Cash Flow"
        title="Spending Stream"
        subtitle={`${data.start} → ${data.end} · ${data.transactions.length} transactions recorded`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/subscriptions"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-surface-3 transition"
            >
              <Repeat className="h-3 w-3 text-primary" />
              Subscriptions
            </Link>
            <Link
              to="/debts"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-surface-3 transition"
            >
              <HandCoins className="h-3 w-3 text-primary" />
              Debts & IOUs
            </Link>
            <Link
              to="/savings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-surface-3 transition"
            >
              <PiggyBank className="h-3 w-3 text-primary" />
              Savings Pots
            </Link>

            <div className="relative flex rounded-lg border border-border bg-surface-2 p-0.5">
              {(['week', 'month'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    playClick()
                    setPeriod(item)
                  }}
                  className={cn(
                    'relative z-10 rounded-md px-3 py-1 text-[11px] font-medium capitalize transition-colors',
                    period === item ? 'text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {period === item && (
                    <motion.span
                      layoutId="money-period-pill"
                      className="absolute inset-0 -z-10 rounded-md bg-primary"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  {item}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="mt-6 space-y-4">
        {/* ① Cash Flow Velocity Bar */}
        <CashFlowVelocityBar
          total={data.total}
          symbol={symbol}
          byCategory={data.by_category}
          trend={data.trend}
          budgets={data.budgets}
          period={period}
          activeCategory={activeCategoryFilter}
          hoveredCategory={hoveredCategory}
          onHoverCategory={setHoveredCategory}
          onSelectCategory={setActiveCategoryFilter}
        />

        {/* ── Category Budgets & Monthly Caps Deck ── */}
        <CategoryBudgetDeck
          budgets={data.budgets}
          symbol={symbol}
          period={period}
          onBudgetUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['money-summary'] })
            queryClient.invalidateQueries({ queryKey: ['savings'] })
          }}
        />

        {/* ② The Omni-Input Bar (Instant Fast Logging + Custom Date & Category Dropdowns) */}
        <OmniInputBar
          symbol={symbol}
          onSpendAdded={(newSpend) => addMutation.mutate(newSpend)}
        />

        {/* ③ Interactive Stream Deck (High-Density 3-Column Grid) */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Interactive Stream Deck</h2>
              {activeCategoryFilter && (
                <Badge variant="secondary" className="capitalize">
                  {activeCategoryFilter}
                </Badge>
              )}
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {data.transactions.length} items · 3-column tactile grid · Tap any amount or name to edit
            </span>
          </div>

          {groupedTransactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-card/30 p-8">
              <EmptyCommand
                icon={Receipt}
                title={activeCategoryFilter ? `No ${activeCategoryFilter} spends logged` : 'Stream is clean'}
                hint="Type in the Omni-Input bar above or tap Log to add your first expense."
                command="120 uber to airport"
              />
            </div>
          ) : (
            <div className="space-y-6">
              {groupedTransactions.map(([date, items]) => {
                const dayTotal = items.reduce((sum, item) => sum + item.amount, 0)
                return (
                  <div key={date} className="space-y-2.5">
                    {/* Day Group Header */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                          {dayHeading(date)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">· {items.length} {items.length === 1 ? 'slip' : 'slips'}</span>
                      </div>
                      <span className="font-mono text-xs font-bold tabular-nums text-foreground/80">
                        {money(dayTotal, symbol)}
                      </span>
                    </div>

                    {/* 3-Column Structured Grid of Voucher Tiles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <AnimatePresence initial={false}>
                        {items.map((row) => (
                          <SpendStreamTile
                            key={row.id}
                            row={row}
                            symbol={symbol}
                            isHighlighted={hoveredCategory === row.category || activeCategoryFilter === row.category}
                            isDimmed={Boolean(
                              (hoveredCategory && hoveredCategory !== row.category) ||
                              (activeCategoryFilter && activeCategoryFilter !== row.category)
                            )}
                            onUpdate={(id, payload) => updateMutation.mutate({ id, data: payload })}
                            onDelete={handleDeleteWithUndo}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Footer */}
        <p className="pt-6 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/40 font-mono">
          <RefreshCw className="h-2.5 w-2.5" />
          Precision Tactile Stream Deck · 3-Column Structured · Local context.db
        </p>
      </div>
    </div>
  )
}
