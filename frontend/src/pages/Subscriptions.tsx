import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import {
  Repeat,
  Plus,
  Search,
  AlertTriangle,
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  Trash2,
  Edit2,
  Sparkles,
  CreditCard,
  Tv,
  Cpu,
  Cloud,
  Zap,
  HeartPulse,
  Dumbbell,
  Briefcase,
  GraduationCap,
  Layers,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns'
import { toast } from 'sonner'
import {
  fetchSubscriptions,
  fetchConfig,
  fetchMoneySummary,
  postSubscriptionAdd,
  putSubscriptionUpdate,
  deleteSubscription,
  postSubscriptionRenew,
  type Subscription,
} from '@/lib/api'
import { PageHeader, EmptyCommand, ErrorPanel } from '@/components/pages/PageChrome'
import { CountUp } from '@/components/motion/CountUp'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSound } from '@/hooks/useSound'

const CATEGORY_MAP: Record<string, { label: string; icon: typeof Tv; color: string; bg: string }> = {
  entertainment: { label: 'Entertainment', icon: Tv, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' },
  software: { label: 'Software & AI', icon: Cpu, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  cloud: { label: 'Cloud & Hosting', icon: Cloud, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
  utilities: { label: 'Utilities', icon: Zap, color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)' },
  health: { label: 'Health', icon: HeartPulse, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  gym: { label: 'Fitness & Gym', icon: Dumbbell, color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)' },
  work: { label: 'Work & Tools', icon: Briefcase, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  education: { label: 'Education', icon: GraduationCap, color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.12)' },
  other: { label: 'Other', icon: Layers, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)' },
}

const PRESETS = [
  { name: 'Netflix', amount: 649, cycle: 'monthly', category: 'entertainment' },
  { name: 'Spotify', amount: 119, cycle: 'monthly', category: 'entertainment' },
  { name: 'ChatGPT Plus', amount: 1999, cycle: 'monthly', category: 'software' },
  { name: 'YouTube Premium', amount: 129, cycle: 'monthly', category: 'entertainment' },
  { name: 'GitHub Copilot', amount: 850, cycle: 'monthly', category: 'software' },
  { name: 'Amazon Prime', amount: 1499, cycle: 'yearly', category: 'entertainment' },
  { name: 'iCloud 200GB', amount: 219, cycle: 'monthly', category: 'cloud' },
  { name: 'Gym Membership', amount: 2500, cycle: 'monthly', category: 'gym' },
  { name: 'Fiber Internet', amount: 999, cycle: 'monthly', category: 'utilities' },
]

// ─── TACTILE CALENDAR PICKER ─────────────────────────────────────────────────

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
  align = 'left',
  position = 'top',
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 4 : -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: position === 'top' ? 4 : -4 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'absolute z-[60] w-[242px] rounded-xl border border-border/90 bg-[#121518] p-2.5 shadow-2xl backdrop-blur-xl',
        position === 'top' ? 'bottom-full mb-1.5' : 'top-11',
        align === 'right' ? 'right-0' : 'left-0'
      )}
    >
        {/* Quick Presets for Renewals */}
        <div className="mb-2 grid grid-cols-3 gap-1 border-b border-border/50 pb-1.5">
          <button
            type="button"
            onClick={() => selectDate(addDays(new Date(), 7))}
            className="rounded bg-surface-2 px-1 py-1 text-[9px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground transition text-center"
          >
            In 7 Days
          </button>
          <button
            type="button"
            onClick={() => selectDate(addDays(new Date(), 30))}
            className="rounded bg-surface-2 px-1 py-1 text-[9px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground transition text-center"
          >
            In 30 Days
          </button>
          <button
            type="button"
            onClick={() => selectDate(addMonths(new Date(), 12))}
            className="rounded bg-surface-2 px-1 py-1 text-[9px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground transition text-center"
          >
            In 1 Year
          </button>
        </div>

        {/* Month Navigation */}
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="font-mono text-[11px] font-semibold text-foreground">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                playClick()
                setCurrentMonth((prev) => subMonths(prev, 1))
              }}
              className="flex h-5 w-5 items-center justify-center rounded-md border border-border/60 bg-surface-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                playClick()
                setCurrentMonth((prev) => addMonths(prev, 1))
              }}
              className="flex h-5 w-5 items-center justify-center rounded-md border border-border/60 bg-surface-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center font-mono text-[8px] uppercase tracking-wider text-muted-foreground/60">
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
                  'flex h-6 w-6 items-center justify-center rounded-md font-mono text-[10px] transition-all',
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
  )
}

// ─── SMART AI NATURAL LANGUAGE PARSER ────────────────────────────────────────

function parseSubscriptionNLP(raw: string) {
  let clean = raw.trim()
  if (!clean) {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return {
      name: '',
      amount: null,
      cycle: 'monthly',
      category: 'entertainment',
      renewal: format(d, 'yyyy-MM-dd'),
      autoRenew: true,
      paymentMethod: '',
    }
  }

  // 1. Amount
  let amount: number | null = null
  const amountMatch = clean.match(/(?:(?:rs\.?|inr|₹)\s*)?(\d+(?:\.\d{1,2})?)/i)
  if (amountMatch) {
    amount = parseFloat(amountMatch[1])
    clean = clean.replace(amountMatch[0], ' ').trim()
  }

  // 2. Billing Cycle
  let cycle = 'monthly'
  if (/\b(yearly|annual|annually|per year|\/yr|\/year|year)\b/i.test(clean)) {
    cycle = 'yearly'
    clean = clean.replace(/\b(yearly|annual|annually|per year|\/yr|\/year|year)\b/gi, ' ')
  } else if (/\b(quarterly|quarter|3 months)\b/i.test(clean)) {
    cycle = 'quarterly'
    clean = clean.replace(/\b(quarterly|quarter|3 months)\b/gi, ' ')
  } else if (/\b(weekly|week|per week|\/wk)\b/i.test(clean)) {
    cycle = 'weekly'
    clean = clean.replace(/\b(weekly|week|per week|\/wk)\b/gi, ' ')
  } else if (/\b(monthly|month|per month|\/mo)\b/i.test(clean)) {
    cycle = 'monthly'
    clean = clean.replace(/\b(monthly|month|per month|\/mo)\b/gi, ' ')
  }

  // 3. Category
  let category = 'entertainment'
  const lower = clean.toLowerCase()
  if (/\b(netflix|spotify|youtube|prime|disney|hotstar|hbo|apple tv|music|streaming|movie|tv)\b/.test(lower)) {
    category = 'entertainment'
  } else if (/\b(chatgpt|openai|copilot|github|cursor|claude|gemini|software|adobe|figma|notion|jetbrains|slack|code)\b/.test(lower)) {
    category = 'software'
  } else if (/\b(icloud|aws|gcp|azure|google one|dropbox|cloud|hosting|vercel|render|vps|digitalocean|server)\b/.test(lower)) {
    category = 'cloud'
  } else if (/\b(wifi|fiber|broadband|electricity|water|utility|utilities|recharge|mobile|airtel|jio)\b/.test(lower)) {
    category = 'utilities'
  } else if (/\b(gym|fitness|cult|workout|protein|yoga)\b/.test(lower)) {
    category = 'gym'
  } else if (/\b(health|doctor|therapy|insurance|medicine)\b/.test(lower)) {
    category = 'health'
  } else if (/\b(work|zoom|loom|trello|asana|tools)\b/.test(lower)) {
    category = 'work'
  } else if (/\b(course|udemy|coursera|education|learning|duolingo|book)\b/.test(lower)) {
    category = 'education'
  }

  // 4. Renewal date
  let renewal = format(addDays(new Date(), cycle === 'yearly' ? 365 : cycle === 'weekly' ? 7 : 30), 'yyyy-MM-dd')
  const inDaysMatch = clean.match(/in\s+(\d+)\s+days?/i)
  if (inDaysMatch) {
    renewal = format(addDays(new Date(), parseInt(inDaysMatch[1], 10)), 'yyyy-MM-dd')
    clean = clean.replace(inDaysMatch[0], ' ')
  } else {
    const monthNames: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    }
    const dayMonthMatch = clean.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i)
    if (dayMonthMatch) {
      const day = parseInt(dayMonthMatch[1], 10)
      const month = monthNames[dayMonthMatch[2].toLowerCase().slice(0, 3)]
      const year = new Date().getFullYear()
      let targetDate = new Date(year, month, day)
      if (targetDate < new Date()) {
        targetDate = new Date(year + 1, month, day)
      }
      renewal = format(targetDate, 'yyyy-MM-dd')
      clean = clean.replace(dayMonthMatch[0], ' ')
    }
  }

  // 5. Auto renew
  let autoRenew = true
  if (/\b(manual|not auto|no auto)\b/i.test(clean)) {
    autoRenew = false
    clean = clean.replace(/\b(manual|not auto|no auto)\b/gi, ' ')
  } else {
    clean = clean.replace(/\b(auto-renew|auto renew|auto)\b/gi, ' ')
  }

  // 6. Name
  let name = clean
    .replace(/\b(next|renewal|renew|on|due|subscription|sub|for|at)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    name: name || '',
    amount,
    cycle,
    category,
    renewal,
    autoRenew,
    paymentMethod: '',
  }
}

// ─── MAIN SUBSCRIPTIONS COMPONENT ────────────────────────────────────────────

export default function Subscriptions() {
  const queryClient = useQueryClient()
  const playClick = useSound('click')
  const playChime = useSound('chime')

  const [search, setSearch] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'urgent' | 'monthly' | 'yearly'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSub, setEditingSub] = useState<Subscription | null>(null)
  const [inlineNlpText, setInlineNlpText] = useState('')

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
  })
  const symbol = config?.symbol || '₹'

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: fetchSubscriptions,
  })

  const subscriptions = data?.subscriptions ?? []
  const summary = data?.summary

  // Query money summary for active budgets
  const { data: moneyData } = useQuery({
    queryKey: ['money-summary', 'month'],
    queryFn: () => fetchMoneySummary('month'),
  })

  const subBudget = useMemo(() => {
    if (!moneyData?.budgets) return null
    return (
      moneyData.budgets.find((b) => b.category === 'subscriptions') ||
      moneyData.budgets.find((b) => b.category === 'bills') ||
      null
    )
  }, [moneyData])

  // Mutations
  const addMutation = useMutation({
    mutationFn: (payload: {
      name: string
      amount: number
      billing_cycle?: string
      category?: string
      next_renewal?: string
      payment_method?: string
      auto_renew?: boolean
      notes?: string
    }) => postSubscriptionAdd(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      toast.success(`Added ${res.subscription.name} (${money(res.subscription.amount, symbol)}/${res.subscription.billing_cycle})`)
      setInlineNlpText('')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add subscription')
    },
  })

  const renewMutation = useMutation({
    mutationFn: ({ id, logSpend }: { id: number; logSpend: boolean }) =>
      postSubscriptionRenew(id, logSpend),
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['money'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      toast.success(
        vars.logSpend
          ? `Renewed ${res.subscription.name} & logged ${money(res.subscription.amount, symbol)} to spends!`
          : `Advanced renewal date for ${res.subscription.name}`
      )
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to renew subscription')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      toast.success('Subscription deleted')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete subscription')
    },
  })

  const parsedInlineNlp = useMemo(() => parseSubscriptionNLP(inlineNlpText), [inlineNlpText])

  const handleInlineNlpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!parsedInlineNlp.name) {
      toast.error('Please include a service name, e.g. "Netflix 649 monthly"')
      return
    }
    if (!parsedInlineNlp.amount || parsedInlineNlp.amount <= 0) {
      toast.error('Please include an amount, e.g. "ChatGPT Plus 1999"')
      return
    }

    addMutation.mutate({
      name: parsedInlineNlp.name,
      amount: parsedInlineNlp.amount,
      billing_cycle: parsedInlineNlp.cycle,
      category: parsedInlineNlp.category,
      next_renewal: parsedInlineNlp.renewal,
      auto_renew: parsedInlineNlp.autoRenew,
    })
  }

  // Filtered list
  const filteredSubs = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchSearch =
        sub.name.toLowerCase().includes(search.toLowerCase()) ||
        sub.category.toLowerCase().includes(search.toLowerCase()) ||
        (sub.payment_method && sub.payment_method.toLowerCase().includes(search.toLowerCase()))

      if (!matchSearch) return false

      if (selectedFilter === 'urgent') {
        return sub.days_remaining <= 7
      }
      if (selectedFilter === 'monthly') {
        return sub.billing_cycle === 'monthly'
      }
      if (selectedFilter === 'yearly') {
        return sub.billing_cycle === 'yearly'
      }
      return true
    })
  }, [subscriptions, search, selectedFilter])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={Repeat}
        eyebrow="Recurring Expenses"
        title="Subscriptions & Renewals"
        subtitle={
          summary
            ? `${summary.active_count} active services · ${money(summary.total_monthly, symbol)} / mo burn`
            : 'Track recurring software, services, and upcoming renewals'
        }
        actions={
          <button
            type="button"
            onClick={() => {
              playClick()
              setEditingSub(null)
              setModalOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add Subscription
          </button>
        }
      />

      {isError && (
        <div className="mt-6">
          <ErrorPanel error={error as Error} onRetry={() => refetch()} />
        </div>
      )}

      {/* Metrics Row */}
      {summary && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Monthly Burn */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-xl shadow-sm"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">Monthly Burn</span>
              <Repeat className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              <CountUp value={summary.total_monthly} prefix={symbol} />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Projected {money(summary.total_yearly, symbol)}/yr</span>
              {subBudget && (
                <span
                  className={cn(
                    'font-mono font-bold',
                    summary.total_monthly > subBudget.budget ? 'text-rose-400' : 'text-emerald-400'
                  )}
                >
                  {summary.total_monthly > subBudget.budget
                    ? `⚠️ ${symbol}${(summary.total_monthly - subBudget.budget).toLocaleString()} over budget`
                    : `${symbol}${Math.max(0, subBudget.budget - summary.total_monthly).toLocaleString()} left of ${symbol}${subBudget.budget.toLocaleString()}`}
                </span>
              )}
            </div>
          </motion.div>

          {/* Active Services */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-xl shadow-sm"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">Active Services</span>
              <Layers className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              <CountUp value={summary.active_count} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Across {summary.by_category.length} categories
            </p>
          </motion.div>

          {/* Renewals Soon */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl shadow-sm transition',
              summary.urgent_count > 0
                ? 'border-amber-500/40 bg-amber-500/5'
                : 'border-border/70 bg-card/60'
            )}
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">Due in 7 Days</span>
              <Clock className={cn('h-4 w-4', summary.urgent_count > 0 ? 'text-amber-500' : 'text-primary')} />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              <CountUp value={summary.due_within_7_days} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {summary.urgent_count > 0 ? (
                <span className="text-amber-500 font-medium">
                  {summary.urgent_count} renewal{summary.urgent_count > 1 ? 's' : ''} in ≤ 3 days!
                </span>
              ) : (
                'No immediate renewal pressure'
              )}
            </p>
          </motion.div>

          {/* Top Category */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-xl shadow-sm"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">Top Category</span>
              <TrendingDown className="h-4 w-4 text-purple-500" />
            </div>
            <div className="mt-2 truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl capitalize">
              {summary.by_category[0]?.category || 'None'}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {summary.by_category[0]
                ? `${money(summary.by_category[0].monthly, symbol)} / mo (${summary.by_category[0].percent}%)`
                : 'No recurring spend yet'}
            </p>
          </motion.div>
        </div>
      )}

      {/* Instant In-Page AI Natural Language Subscription Command Strip */}
      <div className="mt-6 rounded-2xl border border-primary/20 bg-card/80 p-3 backdrop-blur-xl shadow-md">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>AI Fast Add Subscription</span>
            <span className="hidden sm:inline text-[11px] text-muted-foreground font-normal">
              · Type naturally to record recurring bills
            </span>
          </div>
        </div>

        <form onSubmit={handleInlineNlpSubmit} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex flex-1 items-center rounded-xl border border-border/70 bg-surface-2 px-3 py-2 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40">
              <Repeat className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder='e.g. "Netflix 649 monthly next 15 Dec" or "ChatGPT Plus 1999 monthly software" or "Gym 2500 monthly"...'
                value={inlineNlpText}
                onChange={(e) => setInlineNlpText(e.target.value)}
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 active:scale-95 whitespace-nowrap"
            >
              <span>{addMutation.isPending ? 'Logging...' : 'Log via AI'}</span>
              <kbd className="hidden sm:inline rounded bg-primary-foreground/20 px-1 font-mono text-[9px] opacity-80">↵</kbd>
            </button>
          </div>

          {/* Live Token Preview Chips */}
          {inlineNlpText.trim() && (
            <motion.div
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center gap-1.5 px-1 text-[11px]"
            >
              <span className="text-muted-foreground/70">Parsed Tokens:</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 font-semibold text-foreground">
                "{parsedInlineNlp.name || '...'}"
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 font-mono font-semibold tabular-nums text-foreground">
                {parsedInlineNlp.amount ? `${symbol}${parsedInlineNlp.amount}` : `${symbol}0.00`}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-foreground capitalize">
                {parsedInlineNlp.cycle}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium capitalize"
                style={{
                  backgroundColor: CATEGORY_MAP[parsedInlineNlp.category]?.bg,
                  color: CATEGORY_MAP[parsedInlineNlp.category]?.color,
                }}
              >
                {CATEGORY_MAP[parsedInlineNlp.category]?.label || parsedInlineNlp.category}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 font-mono text-muted-foreground">
                Renews: {parsedInlineNlp.renewal}
              </span>
            </motion.div>
          )}
        </form>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search subscriptions, categories, payment methods..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border/80 bg-surface-1/60 py-2 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary backdrop-blur-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: 'all', label: 'All Services' },
              { id: 'urgent', label: 'Due Soon (≤ 7d)' },
              { id: 'monthly', label: 'Monthly' },
              { id: 'yearly', label: 'Yearly' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                playClick()
                setSelectedFilter(tab.id)
              }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap',
                selectedFilter === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                  : 'bg-surface-2/60 text-muted-foreground hover:text-foreground hover:bg-surface-2'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subscriptions Grid */}
      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-44 rounded-2xl border border-border/60 bg-card/40 animate-pulse"
            />
          ))}
        </div>
      ) : filteredSubs.length === 0 ? (
        <div className="mt-8">
          <EmptyCommand
            title={subscriptions.length === 0 ? 'No subscriptions yet' : 'No matching subscriptions'}
            description={
              subscriptions.length === 0
                ? 'Add Netflix, Spotify, gym memberships, or cloud servers to keep track of renewal dates and burn rate.'
                : 'Try adjusting your search query or filter tags.'
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredSubs.map((sub) => {
              const catConfig = CATEGORY_MAP[sub.category] || CATEGORY_MAP.other
              const Icon = catConfig.icon

              return (
                <motion.div
                  key={sub.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-xl transition hover:border-primary/50 hover:shadow-md"
                >
                  <div>
                    {/* Top row: Icon + Category + Urgency badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-xl shadow-inner"
                          style={{
                            backgroundColor: catConfig.bg,
                            color: catConfig.color,
                          }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground line-clamp-1">
                            {sub.name}
                          </h3>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {catConfig.label}
                          </span>
                        </div>
                      </div>

                      {/* Urgency Badge */}
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-tight',
                          sub.urgency === 'overdue' && 'bg-red-500/10 text-red-500 font-semibold',
                          sub.urgency === 'urgent' && 'bg-amber-500/15 text-amber-500 font-semibold',
                          sub.urgency === 'soon' && 'bg-blue-500/10 text-blue-500',
                          sub.urgency === 'normal' && 'bg-surface-2 text-muted-foreground'
                        )}
                      >
                        {sub.urgency === 'overdue' && <AlertTriangle className="h-3 w-3" />}
                        {sub.urgency === 'urgent' && <Clock className="h-3 w-3 animate-pulse" />}
                        {sub.days_remaining < 0
                          ? `${Math.abs(sub.days_remaining)}d overdue`
                          : sub.days_remaining === 0
                          ? 'Renews today'
                          : `In ${sub.days_remaining}d`}
                      </span>
                    </div>

                    {/* Cost row */}
                    <div className="mt-4 flex items-baseline justify-between">
                      <div>
                        <div className="text-xl font-bold tracking-tight text-foreground font-mono">
                          {money(sub.amount, symbol)}
                          <span className="text-xs font-normal text-muted-foreground font-sans ml-1">
                            /{sub.billing_cycle === 'monthly' ? 'mo' : sub.billing_cycle === 'yearly' ? 'yr' : sub.billing_cycle}
                          </span>
                        </div>
                        {sub.billing_cycle !== 'monthly' && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                            ≈ {money(sub.monthly_equivalent, symbol)}/mo
                          </p>
                        )}
                      </div>

                      {/* Auto renew indicator */}
                      <div className="flex flex-col items-end text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              sub.auto_renew ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                            )}
                          />
                          {sub.auto_renew ? 'Auto-renews' : 'Manual renew'}
                        </span>
                        {sub.payment_method && (
                          <span className="text-[10px] text-muted-foreground/70 truncate max-w-[120px]">
                            {sub.payment_method}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Renewal date string */}
                    <div className="mt-3.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CalendarIcon className="h-3 w-3 text-muted-foreground/60" />
                      <span>Next renewal:</span>
                      <span className="font-medium text-foreground">
                        {new Date(sub.next_renewal).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {sub.notes && (
                      <p className="mt-2 line-clamp-1 text-[11px] text-muted-foreground/75 bg-surface-1/50 px-2 py-1 rounded-lg">
                        {sub.notes}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3">
                    <button
                      type="button"
                      disabled={renewMutation.isPending}
                      onClick={() => renewMutation.mutate({ id: sub.id, logSpend: true })}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-surface-2 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-3 transition active:scale-95"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Renew</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          playClick()
                          setEditingSub(sub)
                          setModalOpen(true)
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
                        title="Edit subscription"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete ${sub.name}?`)) {
                            deleteMutation.mutate(sub.id)
                          }
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 transition"
                        title="Delete subscription"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add / Edit Subscription Dialog */}
      <SubscriptionDialog
        open={modalOpen}
        editingSub={editingSub}
        symbol={symbol}
        onClose={() => {
          setModalOpen(false)
          setEditingSub(null)
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
          setModalOpen(false)
          setEditingSub(null)
        }}
      />
    </div>
  )
}

// ─── IMPROVED COMPACT SUBSCRIPTION DIALOG ────────────────────────────────────

function SubscriptionDialog({
  open,
  editingSub,
  symbol,
  onClose,
  onSuccess,
}: {
  open: boolean
  editingSub: Subscription | null
  symbol: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [mode, setMode] = useState<'form' | 'nlp'>('form')
  const [nlpText, setNlpText] = useState('')

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [cycle, setCycle] = useState('monthly')
  const [category, setCategory] = useState('entertainment')
  const [renewal, setRenewal] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [autoRenew, setAutoRenew] = useState(true)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  // Custom Popover States
  const [catMenuOpen, setCatMenuOpen] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const catMenuRef = useRef<HTMLDivElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!catMenuOpen) return
    const handleOutside = (e: MouseEvent) => {
      if (catMenuRef.current && !catMenuRef.current.contains(e.target as Node)) {
        setCatMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [catMenuOpen])

  useEffect(() => {
    if (!datePickerOpen) return
    const handleOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setDatePickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [datePickerOpen])

  const playClick = useSound('click')
  const playChime = useSound('chime')

  useEffect(() => {
    setCatMenuOpen(false)
    setDatePickerOpen(false)
    if (editingSub) {
      setName(editingSub.name)
      setAmount(String(editingSub.amount))
      setCycle(editingSub.billing_cycle)
      setCategory(editingSub.category)
      setRenewal(editingSub.next_renewal)
      setPaymentMethod(editingSub.payment_method || '')
      setAutoRenew(Boolean(editingSub.auto_renew))
      setNotes(editingSub.notes || '')
      setMode('form')
    } else {
      setName('')
      setAmount('')
      setCycle('monthly')
      setCategory('entertainment')
      const d = new Date()
      d.setDate(d.getDate() + 30)
      setRenewal(d.toISOString().slice(0, 10))
      setPaymentMethod('')
      setAutoRenew(true)
      setNotes('')
      setNlpText('')
      setMode('form')
    }
  }, [editingSub, open])

  const parsedNlp = useMemo(() => parseSubscriptionNLP(nlpText), [nlpText])

  const handleApplyPreset = (p: typeof PRESETS[0]) => {
    playClick()
    setName(p.name)
    setAmount(String(p.amount))
    setCycle(p.cycle)
    setCategory(p.category)
  }

  const handleNlpApply = () => {
    if (!parsedNlp.name) {
      toast.error('Please enter a service name')
      return
    }
    if (!parsedNlp.amount || parsedNlp.amount <= 0) {
      toast.error('Please include an amount')
      return
    }

    setName(parsedNlp.name)
    setAmount(String(parsedNlp.amount))
    setCycle(parsedNlp.cycle)
    setCategory(parsedNlp.category)
    setRenewal(parsedNlp.renewal)
    setAutoRenew(parsedNlp.autoRenew)
    setMode('form')
    playChime()
    toast.success('AI filled subscription details! Review and save.')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Please enter a service name')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setLoading(true)
    try {
      if (editingSub) {
        await putSubscriptionUpdate(editingSub.id, {
          name: name.trim(),
          amount: parsedAmount,
          billing_cycle: cycle,
          category,
          next_renewal: renewal || undefined,
          payment_method: paymentMethod.trim(),
          auto_renew: autoRenew,
          notes: notes.trim(),
        })
        toast.success(`Updated ${name}`)
      } else {
        await postSubscriptionAdd({
          name: name.trim(),
          amount: parsedAmount,
          billing_cycle: cycle,
          category,
          next_renewal: renewal || undefined,
          payment_method: paymentMethod.trim(),
          auto_renew: autoRenew,
          notes: notes.trim(),
        })
        toast.success(`Added ${name}`)
      }
      playChime()
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Operation failed')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const activeCatConfig = CATEGORY_MAP[category] || CATEGORY_MAP.other
  const CatIcon = activeCatConfig.icon

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto p-4 sm:p-6 pt-20 sm:pt-24 pb-12">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-md"
      />

      {/* Modal Dialog with Increased Width & Reduced Compact Height */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative my-auto w-full max-w-2xl sm:max-w-3xl max-h-[calc(100vh-7.5rem)] flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-[#121518] p-5 sm:p-6 shadow-2xl backdrop-blur-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/50 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                {editingSub ? 'Edit Subscription' : 'Add Subscription'}
              </h2>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary font-semibold">
                {editingSub ? 'EDIT MODE' : 'NEW RECURRING'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track recurring payments, renewal schedules, and monthly costs
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!editingSub && (
              <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-surface-2 p-0.5">
                <button
                  type="button"
                  onClick={() => setMode('form')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-medium transition',
                    mode === 'form' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Form
                </button>
                <button
                  type="button"
                  onClick={() => setMode('nlp')}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition',
                    mode === 'nlp' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  AI Fast Add
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {/* AI Fast Add View */}
          {mode === 'nlp' && !editingSub ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Sparkles className="h-4 w-4" />
                <span>Type naturally to configure your subscription</span>
              </div>
              <input
                type="text"
                autoFocus
                placeholder='e.g. "Netflix 649 monthly next 15 Dec" or "ChatGPT Plus 1999 monthly software" or "Gym 2500 monthly"...'
                value={nlpText}
                onChange={(e) => setNlpText(e.target.value)}
                className="w-full rounded-xl border border-border/80 bg-surface-2 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />

              {/* Parsed Live Preview */}
              {nlpText.trim() && (
                <div className="rounded-lg border border-border/50 bg-[#16191d] p-3 text-xs space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    Parsed AI Preview
                  </span>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded bg-surface-2 px-2 py-0.5 font-semibold text-foreground">
                      Service: {parsedNlp.name || '...'}
                    </span>
                    <span className="rounded bg-surface-2 px-2 py-0.5 font-mono font-bold text-foreground">
                      Amount: {symbol}{parsedNlp.amount || 0}
                    </span>
                    <span className="rounded bg-surface-2 px-2 py-0.5 capitalize text-foreground">
                      Cycle: {parsedNlp.cycle}
                    </span>
                    <span
                      className="rounded px-2 py-0.5 font-semibold capitalize"
                      style={{
                        backgroundColor: CATEGORY_MAP[parsedNlp.category]?.bg,
                        color: CATEGORY_MAP[parsedNlp.category]?.color,
                      }}
                    >
                      Category: {CATEGORY_MAP[parsedNlp.category]?.label}
                    </span>
                    <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-muted-foreground">
                      Renewal: {parsedNlp.renewal}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNlpApply}
                disabled={!parsedNlp.name || !parsedNlp.amount}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 active:scale-95 transition disabled:opacity-50"
              >
                Apply AI Details to Form
              </button>
            </div>
          </div>
        ) : (
          /* Form View: High-density 2-column structured layout */
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Quick Suggestions row for new additions */}
            {!editingSub && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Quick Suggestions
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-[11px] transition',
                        name === p.name
                          ? 'border-primary bg-primary/20 text-primary font-semibold'
                          : 'border-border/60 bg-surface-2/60 text-muted-foreground hover:border-primary hover:text-primary'
                      )}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Row 1: Name & Amount */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium text-foreground">Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. Netflix, Spotify, Gym"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-border/80 bg-surface-1 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground">Amount ({symbol})</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 649"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-border/80 bg-surface-1 px-3 py-2 font-mono text-xs font-bold text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Row 2: Billing Cycle (Segmented) & Custom Category Dropdown */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium text-foreground">Billing Cycle</label>
                <div className="mt-1 grid grid-cols-4 gap-1 rounded-xl border border-border/80 bg-surface-1 p-1">
                  {(['monthly', 'yearly', 'quarterly', 'weekly'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        playClick()
                        setCycle(c)
                      }}
                      className={cn(
                        'rounded-lg py-1.5 text-center text-[11px] font-medium capitalize transition',
                        cycle === c
                          ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground">Category</label>
                <div ref={catMenuRef} className="relative mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      playClick()
                      setCatMenuOpen((v) => !v)
                    }}
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-border/80 bg-surface-1 px-3 text-xs font-medium transition hover:border-primary/50"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-md"
                        style={{ backgroundColor: activeCatConfig.bg, color: activeCatConfig.color }}
                      >
                        <CatIcon className="h-3 w-3" />
                      </span>
                      <span className="text-foreground">{activeCatConfig.label}</span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
                  </button>

                  <AnimatePresence>
                    {catMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -4 }}
                        className="absolute left-0 top-11 z-50 w-full rounded-xl border border-border/90 bg-[#16191d] p-1.5 shadow-2xl backdrop-blur-xl max-h-56 overflow-y-auto"
                      >
                        {Object.entries(CATEGORY_MAP).map(([key, val]) => {
                          const ItemIcon = val.icon
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setCategory(key)
                                setCatMenuOpen(false)
                                playClick()
                              }}
                              className={cn(
                                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                                category === key
                                  ? 'bg-surface-3 font-semibold text-foreground'
                                  : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                              )}
                            >
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded-md"
                                style={{ backgroundColor: val.bg, color: val.color }}
                              >
                                <ItemIcon className="h-3 w-3" />
                              </span>
                              <span className="flex-1 truncate">{val.label}</span>
                              {category === key && <Check className="h-3.5 w-3.5 text-primary" />}
                            </button>
                          )
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Row 3: Custom Tactile Renewal Calendar & Payment Method */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium text-foreground">Next Renewal Date</label>
                <div ref={datePickerRef} className="relative mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      playClick()
                      setDatePickerOpen((v) => !v)
                    }}
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-border/80 bg-surface-1 px-3 text-xs font-mono font-medium text-foreground transition hover:border-primary/50"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{renewal || 'Select date'}</span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
                  </button>

                  <AnimatePresence>
                    {datePickerOpen && (
                      <TactileDatePicker
                        value={renewal}
                        onChange={(d) => setRenewal(d)}
                        onClose={() => setDatePickerOpen(false)}
                        align="left"
                        position="top"
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground">Payment Method</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Credit Card, UPI"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border/80 bg-surface-1 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Row 4: Auto-Renew Switch & Notes */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-center">
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-surface-1/50 p-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">Auto-Renewing</p>
                  <p className="text-[10px] text-muted-foreground">
                    Charges automatically on schedule
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground">Notes (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. shared with family, cancellation link..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border/80 bg-surface-1 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 active:scale-95 transition"
              >
                {loading ? 'Saving...' : editingSub ? 'Update Subscription' : 'Add Subscription'}
              </button>
            </div>
          </form>
        )}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
