import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import {
  PiggyBank,
  Plus,
  Target,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit2,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  X,
  Coins,
  Shield,
  Plane,
  ShoppingBag,
  Zap,
  Lock,
  Unlock,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  ArrowRight,
} from 'lucide-react'
import {
  format,
  addDays,
  subDays,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  differenceInCalendarDays,
} from 'date-fns'
import { toast } from 'sonner'
import {
  fetchSavings,
  fetchConfig,
  fetchMoneySummary,
  postSavingGoalAdd,
  putSavingGoalUpdate,
  postSavingGoalDeposit,
  deleteSavingGoal,
  type SavingGoal,
} from '@/lib/api'
import { PageHeader, EmptyCommand, ErrorPanel } from '@/components/pages/PageChrome'
import { CountUp } from '@/components/motion/CountUp'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSound } from '@/hooks/useSound'
import { celebrateConnection } from '@/lib/celebrate'

const CATEGORY_MAP: Record<
  string,
  { label: string; icon: any; color: string; bg: string }
> = {
  purchase: {
    label: 'Major Purchase',
    icon: ShoppingBag,
    color: '#818cf8',
    bg: 'rgba(129, 140, 248, 0.15)',
  },
  travel: {
    label: 'Travel & Vacation',
    icon: Plane,
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.15)',
  },
  emergency: {
    label: 'Emergency Safety Net',
    icon: Shield,
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.15)',
  },
  investment: {
    label: 'Wealth & Investment',
    icon: TrendingUp,
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.15)',
  },
  other: {
    label: 'General Target',
    icon: Target,
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.15)',
  },
}

// ─── TACTILE CALENDAR PICKER ─────────────────────────────────────────────────

interface TactileDatePickerProps {
  value: string // 'YYYY-MM-DD'
  onChange: (dateStr: string) => void
  onClose: () => void
  align?: 'left' | 'right'
  position?: 'top' | 'bottom'
  presets?: { label: string; date: Date }[]
  allowClear?: boolean
}

function TactileDatePicker({
  value,
  onChange,
  onClose,
  align = 'left',
  position = 'top',
  presets,
  allowClear = false,
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

  const clearDate = () => {
    playClick()
    onChange('')
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 4 : -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: position === 'top' ? 4 : -4 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'absolute z-[70] w-[246px] rounded-xl border border-border/90 bg-[#121518] p-2.5 shadow-2xl backdrop-blur-xl',
        position === 'top' ? 'bottom-full mb-1.5' : 'top-11',
        align === 'right' ? 'right-0' : 'left-0'
      )}
    >
      {/* Quick Presets */}
      {presets && presets.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-1 border-b border-border/50 pb-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => selectDate(p.date)}
              className="rounded bg-surface-2 px-1 py-1 text-[9px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground transition text-center"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

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

      {allowClear && (
        <div className="mt-2 border-t border-border/40 pt-1.5 flex justify-end">
          <button
            type="button"
            onClick={clearDate}
            className="text-[9px] font-mono text-muted-foreground hover:text-rose-400 transition"
          >
            Clear Date (No Target Date)
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── NATURAL LANGUAGE SAVINGS GOAL PARSER ────────────────────────────────────

function parseSavingGoalNLP(raw: string) {
  let clean = raw.trim()
  if (!clean) {
    return {
      title: '',
      targetAmount: null as number | null,
      currentAmount: 0,
      targetDate: '',
      category: 'purchase',
      notes: '',
      isLocked: false,
    }
  }

  const lower = clean.toLowerCase()

  // 1. Target Date parsing first
  let targetDate = ''
  const monthsRegex = /(?:in|within|by)\s+(\d+)\s*months?/i
  const matchMonths = clean.match(monthsRegex)
  if (matchMonths) {
    const m = parseInt(matchMonths[1], 10)
    targetDate = format(addMonths(new Date(), m), 'yyyy-MM-dd')
  } else if (/(?:in\s+half\s+year|half\s+year)/i.test(lower)) {
    targetDate = format(addMonths(new Date(), 6), 'yyyy-MM-dd')
  } else if (/(?:in\s+1\s+year|next\s+year|in\s+a\s+year)/i.test(lower)) {
    targetDate = format(addMonths(new Date(), 12), 'yyyy-MM-dd')
  } else if (/(?:by\s+dec(?:ember)?)/i.test(lower)) {
    const year = new Date().getFullYear()
    targetDate = `${year}-12-31`
  } else {
    const daysMatch = lower.match(/(?:in|by)\s+(\d+)\s*days?/i)
    if (daysMatch) {
      targetDate = format(addDays(new Date(), parseInt(daysMatch[1], 10)), 'yyyy-MM-dd')
    }
  }

  // 2. Extract Target Amount (explicit keyword or largest number >= 50)
  let targetAmount: number | null = null
  const explicitAmount = clean.match(/(?:(?:rs\.?|inr|₹|target|save)\s*)(\d[\d,]*(?:\.\d{1,2})?)/i)
  if (explicitAmount) {
    targetAmount = parseFloat(explicitAmount[1].replace(/,/g, ''))
  } else {
    const allNums = [...clean.matchAll(/\b(\d[\d,]*(?:\.\d{1,2})?)\b/g)]
      .map((m) => parseFloat(m[1].replace(/,/g, '')))
      .filter((n) => n >= 50)
    if (allNums.length > 0) {
      targetAmount = Math.max(...allNums)
    }
  }

  // 3. Category & Locked Detection
  let category = 'purchase'
  let isLocked = false

  if (/(?:locked|vault|lock|safe)/i.test(lower)) {
    isLocked = true
  }

  if (/(?:macbook|laptop|phone|iphone|pc|computer|car|bike|watch|ring|purchase|buy)/i.test(lower)) {
    category = 'purchase'
  } else if (/(?:japan|trip|vacation|flight|travel|holiday|beach|hotel)/i.test(lower)) {
    category = 'travel'
  } else if (/(?:emergency|rainy day|safety|cushion|medical)/i.test(lower)) {
    category = 'emergency'
    isLocked = true
  } else if (/(?:invest|stock|gold|mutual fund|crypto)/i.test(lower)) {
    category = 'investment'
  } else if (/(?:course|degree|college|school|exam)/i.test(lower)) {
    category = 'other'
  }

  // 4. Extract Title cleanly without leaving stray digits or keywords
  let title = ''
  const forMatch = clean.match(/(?:for|named|titled|pot)\s+([^,.;]+?)(?:\s+(?:by|target|in|\d+)|$)/i)
  if (forMatch) {
    title = forMatch[1].trim()
  } else {
    let temp = clean
      .replace(/(?:in|within|by)\s+\d+\s*months?/gi, '')
      .replace(/(?:in|within|by)\s+\d+\s*days?/gi, '')
      .replace(/(?:in\s+1\s+year|next\s+year|in\s+a\s+year)/gi, '')
      .replace(/by\s+dec(?:ember)?/gi, '')

    if (targetAmount) {
      const amtStr = String(targetAmount)
      temp = temp.replace(new RegExp('(?:(?:rs\\.?|inr|₹)\\s*)?' + amtStr, 'gi'), '')
    }

    temp = temp.replace(/\b(?:save|saving|target|goal|pot|locked|vault|lock|in|by|for)\b/gi, '')
    temp = temp.replace(/^[,\s.-]+|[,\s.-]+$/g, '').replace(/\s+/g, ' ').trim()
    if (temp.length > 0) {
      title = temp
    }
  }

  if (title) {
    title = title.charAt(0).toUpperCase() + title.slice(1)
  }

  return {
    title,
    targetAmount,
    currentAmount: 0,
    targetDate,
    category,
    notes: '',
    isLocked,
  }
}

// ─── AI FEASIBILITY ENGINE ───────────────────────────────────────────────────

function computeAIFeasibility(
  targetAmount: number,
  currentAmount: number,
  targetDateStr: string | undefined | null,
  symbol: string
) {
  if (!targetAmount || targetAmount <= 0) return null
  const remaining = Math.max(0, targetAmount - currentAmount)
  if (remaining <= 0) {
    return {
      severity: 'safe' as const,
      status: 'Goal Met!',
      details: 'This target has reached 100% funding.',
      recommendation: '',
      recommendedMonths: 0,
      monthlyRequired: 0,
    }
  }

  let days = 180 // default 6 months if no target date
  if (targetDateStr) {
    try {
      const d = differenceInCalendarDays(new Date(`${targetDateStr.slice(0, 10)}T00:00:00`), new Date())
      if (d > 0) days = d
    } catch {
      // ignore
    }
  }

  const months = Math.max(0.33, days / 30)
  const monthlyRequired = Math.round(remaining / months)

  // Calibrate against typical personal cashflow baselines
  if (monthlyRequired <= 15000) {
    return {
      severity: 'safe' as const,
      status: 'Highly Feasible · Comfortable Margin',
      details: `Requires saving ~${symbol}${monthlyRequired.toLocaleString()}/mo. Fits smoothly within typical cashflow margins.`,
      recommendation: '',
      recommendedMonths: Math.max(1, Math.round(months)),
      monthlyRequired,
    }
  } else if (monthlyRequired <= 40000) {
    return {
      severity: 'moderate' as const,
      status: 'Disciplined Allocation Needed',
      details: `Requires ~${symbol}${monthlyRequired.toLocaleString()}/mo. Recommends curbing discretionary dining & shopping.`,
      recommendation: '',
      recommendedMonths: Math.max(1, Math.round(months)),
      monthlyRequired,
    }
  } else {
    // High strain: recommend extending timeline to achieve ~25,000/mo
    const recommendedMonths = Math.max(3, Math.ceil(remaining / 25000))
    return {
      severity: 'strain' as const,
      status: '⚠️ High Cashflow Strain',
      details: `Requires ~${symbol}${monthlyRequired.toLocaleString()}/mo. Setting aside this much risks a monthly liquidity crunch!`,
      recommendation: `Extend timeline to ${recommendedMonths} months (~${symbol}25,000/mo) for comfortable execution.`,
      recommendedMonths,
      monthlyRequired,
    }
  }
}

// ─── MAIN SAVINGS PAGE COMPONENT ─────────────────────────────────────────────

export default function Savings() {
  const queryClient = useQueryClient()
  const playClick = useSound('click')
  const playChime = useSound('chime')

  const [modalOpen, setModalOpen] = useState(false)
  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<SavingGoal | null>(null)
  const [actionAmount, setActionAmount] = useState('')

  // In-page NLP State
  const [inPageNlp, setInPageNlp] = useState('')
  const [inPageNlpLoading, setInPageNlpLoading] = useState(false)

  // Surplus Sweep Target Pot Selection & Dropdown Popover
  const [sweepPotId, setSweepPotId] = useState<number | null>(null)
  const [sweepMenuOpen, setSweepMenuOpen] = useState(false)
  const sweepMenuRef = useRef<HTMLDivElement>(null)

  // Track swept surplus for current month in localStorage to prevent repeat/infinite sweeping
  const currentMonthKey = useMemo(() => `context_surplus_swept_${format(new Date(), 'yyyy-MM')}`, [])
  const [sweptAmount, setSweptAmount] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(`context_surplus_swept_${format(new Date(), 'yyyy-MM')}`)
      return stored ? parseFloat(stored) : 0
    } catch {
      return 0
    }
  })

  // Outside click listener for sweep popover
  useEffect(() => {
    if (!sweepMenuOpen) return
    const handleOutside = (e: MouseEvent) => {
      if (sweepMenuRef.current && !sweepMenuRef.current.contains(e.target as Node)) {
        setSweepMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [sweepMenuOpen])

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
    queryKey: ['savings'],
    queryFn: fetchSavings,
  })

  // Fetch money summary to calculate unspent budget surplus
  const { data: moneyData } = useQuery({
    queryKey: ['money-summary', 'month'],
    queryFn: () => fetchMoneySummary('month'),
  })

  const summary = data?.summary
  const goals = data?.goals ?? []

  // Auto-select emergency or first goal for surplus sweep
  useEffect(() => {
    if (goals.length > 0 && sweepPotId === null) {
      const emergency = goals.find((g) => g.category === 'emergency' || g.is_locked)
      setSweepPotId(emergency ? emergency.id : goals[0].id)
    }
  }, [goals, sweepPotId])

  // Calculate unspent budget surplus from money summary
  const unspentSurplus = useMemo(() => {
    if (!moneyData?.budgets) return 0
    let totalUnspent = 0
    for (const b of moneyData.budgets) {
      if (b.budget > b.spent) {
        totalUnspent += (b.budget - b.spent)
      }
    }
    return Math.round(totalUnspent)
  }, [moneyData])

  // Available surplus after accounting for what was already swept this month
  const availableSurplus = useMemo(() => {
    return Math.max(0, unspentSurplus - sweptAmount)
  }, [unspentSurplus, sweptAmount])

  // Deposit Mutation
  const depositMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      postSavingGoalDeposit(id, amount),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['savings'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      if (res.goal.is_completed) {
        celebrateConnection()
        toast.success(`🎉 Congratulations! You reached your goal for ${res.goal.title}!`)
      } else {
        toast.success(`Added ${money(parseFloat(actionAmount), symbol)} to ${res.goal.title}!`)
      }
      setDepositModalOpen(false)
      setActionAmount('')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Deposit failed')
    },
  })

  // Withdraw Mutation
  const withdrawMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      postSavingGoalDeposit(id, -Math.abs(amount)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['savings'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      toast.success(`Withdrew ${money(parseFloat(actionAmount), symbol)} from ${res.goal.title}`)
      setWithdrawModalOpen(false)
      setActionAmount('')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Withdrawal failed')
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSavingGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings'] })
      toast.success('Savings goal deleted')
    },
  })

  // 1-Tap Surplus Sweep Action (Single sweep per month to prevent duplicate infinite sweeps)
  const handleSurplusSweep = async () => {
    if (!sweepPotId || availableSurplus <= 0) return
    const targetPot = goals.find((g) => g.id === sweepPotId)
    if (!targetPot) return

    playClick()
    try {
      await postSavingGoalDeposit(sweepPotId, availableSurplus)
      const newSwept = sweptAmount + availableSurplus
      setSweptAmount(newSwept)
      try {
        localStorage.setItem(currentMonthKey, String(newSwept))
      } catch {}
      queryClient.invalidateQueries({ queryKey: ['savings'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      celebrateConnection()
      toast.success(`⚡ Swept ${symbol}${availableSurplus.toLocaleString()} surplus into ${targetPot.title}!`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to sweep surplus')
    }
  }

  // 1-Click AI Fix Pace Action (Updates goal target_date to recommended comfortable timeline)
  const handleFixPace = async (goal: SavingGoal, recommendedMonths: number) => {
    if (!recommendedMonths || recommendedMonths <= 0) return
    playClick()
    const newTargetDate = format(addMonths(new Date(), recommendedMonths), 'yyyy-MM-dd')
    try {
      await putSavingGoalUpdate(goal.id, {
        title: goal.title,
        target_amount: goal.target_amount,
        current_amount: goal.current_amount,
        target_date: newTargetDate,
        category: goal.category,
        is_locked: goal.is_locked,
        notes: goal.notes,
      })
      queryClient.invalidateQueries({ queryKey: ['savings'] })
      playChime()
      toast.success(`Adjusted ${goal.title} to comfortable ${recommendedMonths}-month pace!`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to adjust pace')
    }
  }

  const handleOpenDeposit = (goal: SavingGoal) => {
    playClick()
    setSelectedGoal(goal)
    setActionAmount('')
    setDepositModalOpen(true)
  }

  const handleOpenWithdraw = (goal: SavingGoal) => {
    playClick()
    setSelectedGoal(goal)
    setActionAmount('')
    setWithdrawModalOpen(true)
  }

  // Handle in-page AI submission
  const handleInPageNlpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseSavingGoalNLP(inPageNlp)
    if (!parsed.title) {
      toast.error('Please specify a goal name e.g. "Save 150000 for MacBook Pro"')
      return
    }
    if (!parsed.targetAmount || parsed.targetAmount <= 0) {
      toast.error('Please specify target amount e.g. "Save 150000 for MacBook Pro"')
      return
    }

    setInPageNlpLoading(true)
    try {
      await postSavingGoalAdd({
        title: parsed.title,
        target_amount: parsed.targetAmount,
        current_amount: 0,
        target_date: parsed.targetDate || undefined,
        category: parsed.category,
        notes: parsed.notes,
        is_locked: parsed.isLocked,
      })
      queryClient.invalidateQueries({ queryKey: ['savings'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      toast.success(`Created savings pot for ${parsed.title}!`)
      setInPageNlp('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create pot via AI')
    } finally {
      setInPageNlpLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={PiggyBank}
        eyebrow="Target Pots & Reserves"
        title="Savings Goals"
        subtitle={
          summary
            ? `${summary.goals_count} active pots · ${summary.overall_progress_pct}% of total target reached`
            : 'Lock in financial targets, track deposit progress, and watch savings compound'
        }
        actions={
          <button
            onClick={() => {
              playClick()
              setSelectedGoal(null)
              setModalOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            New Savings Pot
          </button>
        }
      />

      {isError && (
        <div className="mt-6">
          <ErrorPanel error={error as Error} onRetry={() => refetch()} />
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Saved */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 backdrop-blur-xl shadow-sm"
          >
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="text-[11px] font-medium uppercase tracking-wider">Total Stashed</span>
              <Coins className="h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl font-mono">
              <CountUp value={summary.total_saved} prefix={symbol} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Across all target pots
            </p>
          </motion.div>

          {/* Target Amount */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-xl shadow-sm"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">Total Targets</span>
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-mono">
              <CountUp value={summary.total_target} prefix={symbol} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Combined target sum
            </p>
          </motion.div>

          {/* Overall Progress */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-5 backdrop-blur-xl shadow-sm"
          >
            <div className="flex items-center justify-between text-primary">
              <span className="text-[11px] font-medium uppercase tracking-wider">Overall Progress</span>
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-primary sm:text-3xl font-mono">
              {summary.overall_progress_pct}%
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(100, summary.overall_progress_pct)}%` }}
              />
            </div>
          </motion.div>

          {/* Completed Pots */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-xl shadow-sm"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">Pots Completed</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-mono">
              <CountUp value={summary.completed_count} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {summary.completed_count > 0 ? 'Goals fully unlocked!' : 'Keep depositing regularly'}
            </p>
          </motion.div>
        </div>
      )}

      {/* Feature 1: Intelligent 1-Tap Surplus Sweep Card */}
      {goals.length > 0 && (unspentSurplus > 0 || sweptAmount > 0) && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-card to-surface-1 p-4 shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">
                  {availableSurplus > 0 ? 'Monthly Budget Surplus Detected' : 'Monthly Surplus Deployed'}
                </span>
                {availableSurplus > 0 ? (
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300">
                    +{symbol}{availableSurplus.toLocaleString()} Available
                  </span>
                ) : (
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
                    ✓ {symbol}{sweptAmount.toLocaleString()} Swept
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {availableSurplus > 0
                  ? 'You stayed under budget in your expense categories. Sweep this surplus before month-end!'
                  : `You've already swept your unspent surplus into your savings goals for this month.`}
              </p>

              {/* Real-time Category Breakdown of remaining budget cushion */}
              {moneyData?.budgets && moneyData.budgets.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {moneyData.budgets.map((b) => {
                    const remaining = Math.max(0, b.budget - b.spent)
                    return (
                      <span
                        key={b.category}
                        className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-surface-2/80 px-2 py-0.5 text-[10px] font-mono shadow-xs"
                      >
                        <span className="capitalize font-sans font-medium text-foreground">{b.category}:</span>
                        <strong className={remaining > 0 ? 'text-amber-300' : 'text-rose-400'}>
                          {symbol}{remaining.toLocaleString()} left
                        </strong>
                        <span className="text-muted-foreground/80">of {symbol}{b.budget.toLocaleString()}</span>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Custom Tactile Dropdown for Target Pot Selection */}
            <div ref={sweepMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  playClick()
                  setSweepMenuOpen((v) => !v)
                }}
                className="flex items-center gap-2 rounded-xl border border-border/80 bg-[#14171a] px-3 py-2 text-xs font-medium text-foreground transition hover:border-amber-500/50"
              >
                <span className="truncate max-w-[150px]">
                  Sweep to: <strong className="text-amber-300">{goals.find((g) => g.id === sweepPotId)?.title || 'Select Pot'}</strong>
                </span>
                {goals.find((g) => g.id === sweepPotId)?.is_locked && (
                  <Lock className="h-3 w-3 text-amber-400 shrink-0" />
                )}
                <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', sweepMenuOpen && 'rotate-180')} />
              </button>

              <AnimatePresence>
                {sweepMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1.5 z-50 w-60 rounded-xl border border-border/90 bg-[#14171a] p-1.5 shadow-2xl backdrop-blur-2xl"
                  >
                    <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Select Target Pot
                    </div>
                    <div className="space-y-0.5 mt-1 max-h-48 overflow-y-auto">
                      {goals.map((g) => {
                        const isSel = g.id === sweepPotId
                        const cat = CATEGORY_MAP[g.category] || CATEGORY_MAP.other
                        const Icon = cat.icon
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => {
                              playClick()
                              setSweepPotId(g.id)
                              setSweepMenuOpen(false)
                            }}
                            className={cn(
                              'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition',
                              isSel
                                ? 'bg-amber-500/20 text-amber-300 font-semibold'
                                : 'text-foreground hover:bg-surface-2'
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                                style={{ backgroundColor: cat.bg, color: cat.color }}
                              >
                                <Icon className="h-3 w-3" />
                              </div>
                              <span className="truncate">{g.title}</span>
                              {g.is_locked && <Lock className="h-2.5 w-2.5 text-amber-400" />}
                            </div>
                            {isSel && <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0 ml-2" />}
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sweep Action Button */}
            {availableSurplus > 0 ? (
              <button
                onClick={handleSurplusSweep}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-black shadow-md transition hover:bg-amber-400 active:scale-95"
              >
                <span>Sweep Now</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-2 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Fully Swept</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Fast Natural Language Omni-Bar */}
      <form
        onSubmit={handleInPageNlpSubmit}
        className="mt-6 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/5 via-card to-surface-1 p-3 shadow-md backdrop-blur-xl"
      >
        <div className="flex items-center gap-2 px-1 pb-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/20 text-primary">
            <Sparkles className="h-3 w-3" />
          </div>
          <span className="text-[11px] font-semibold text-foreground">AI Natural Language Savings Pot Creator</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            · Type naturally e.g. "Save 150000 for MacBook Pro by Dec 2026" or "Emergency Fund 50000 locked"
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder='e.g. "Save 150000 for MacBook Pro by Dec 2026" or "Emergency Fund 50000 locked"...'
              value={inPageNlp}
              onChange={(e) => setInPageNlp(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-surface-2/80 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={inPageNlpLoading || !inPageNlp.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 active:scale-95 disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Create Pot via AI ↵</span>
          </button>
        </div>
      </form>

      {/* Goals Grid */}
      {isLoading ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl border border-border/60 bg-card/40 animate-pulse" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="mt-8">
          <EmptyCommand
            title="No savings pots yet"
            description="Create pots for a new laptop, emergency fund, vacation, or down payment to watch your savings grow."
          />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {goals.map((goal) => {
              const catConfig = CATEGORY_MAP[goal.category] || CATEGORY_MAP.other
              const CatIcon = catConfig.icon

              // Calculate daily / monthly required contribution pace & AI Reality Check
              let paceText: string | null = null
              let daysLeft: number | null = null
              if (goal.target_date && !goal.is_completed) {
                try {
                  const targetD = new Date(`${goal.target_date.slice(0, 10)}T00:00:00`)
                  daysLeft = differenceInCalendarDays(targetD, new Date())
                  if (daysLeft > 0) {
                    const daily = goal.remaining / daysLeft
                    const monthly = daily * 30
                    paceText = `${money(Math.round(daily), symbol)}/day · ${money(Math.round(monthly), symbol)}/mo`
                  }
                } catch {
                  // ignore
                }
              }

              const aiCheck = computeAIFeasibility(goal.target_amount, goal.current_amount, goal.target_date, symbol)

              return (
                <motion.div
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-sm backdrop-blur-xl transition hover:shadow-md',
                    goal.is_completed
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : goal.is_locked
                      ? 'border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-card/70 hover:border-amber-500/50'
                      : 'border-border/70 bg-card/70 hover:border-primary/50'
                  )}
                >
                  <div>
                    {/* Top row: Clean Category Icon + Title + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-inner"
                          style={{ backgroundColor: catConfig.bg, color: catConfig.color }}
                        >
                          <CatIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-semibold text-sm text-foreground line-clamp-1">
                              {goal.title}
                            </h3>
                            {goal.is_locked && (
                              <span className="flex items-center gap-0.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-300">
                                <Lock className="h-2.5 w-2.5" />
                                Vault
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {catConfig.label}
                          </span>
                        </div>
                      </div>

                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-tight font-mono',
                          goal.is_completed
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-primary/10 text-primary'
                        )}
                      >
                        {goal.is_completed ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Reached!
                          </>
                        ) : (
                          `${goal.progress_pct}%`
                        )}
                      </span>
                    </div>

                    {/* Amounts */}
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
                          {money(goal.current_amount, symbol)}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          of {money(goal.target_amount, symbol)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            goal.is_completed
                              ? 'bg-emerald-500'
                              : goal.is_locked
                              ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                              : 'bg-gradient-to-r from-primary to-theme-accent'
                          )}
                          style={{ width: `${Math.min(100, goal.progress_pct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Target Date & Required Pace Info */}
                    <div className="mt-3.5 space-y-1.5 text-[11px] text-muted-foreground">
                      {!goal.is_completed && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span>
                            <strong className="text-foreground">{money(goal.remaining, symbol)}</strong> left to stash
                          </span>
                          {goal.target_date && daysLeft !== null && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {daysLeft > 0 ? `${daysLeft} days left` : 'Due today'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Smart Required Pace & AI Reality Check Assessment */}
                      {!goal.is_completed && aiCheck && (
                        <div
                          className={cn(
                            'rounded-xl border p-2.5 text-xs transition-all',
                            aiCheck.severity === 'strain'
                              ? 'border-rose-500/40 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent text-rose-300'
                              : aiCheck.severity === 'moderate'
                              ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent text-amber-300'
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 font-bold text-[11px]">
                              {aiCheck.severity === 'strain' ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                              ) : aiCheck.severity === 'moderate' ? (
                                <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                              )}
                              <span className={cn(
                                aiCheck.severity === 'strain'
                                  ? 'text-rose-400'
                                  : aiCheck.severity === 'moderate'
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              )}>
                                {aiCheck.status}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] font-bold">
                              ~{symbol}{aiCheck.monthlyRequired.toLocaleString()}/mo
                            </span>
                          </div>

                          <p className="mt-1 text-[10px] text-muted-foreground/90 leading-relaxed">
                            {aiCheck.details} {aiCheck.recommendation}
                          </p>

                          {aiCheck.severity === 'strain' && aiCheck.recommendedMonths > 0 && (
                            <button
                              type="button"
                              onClick={() => handleFixPace(goal, aiCheck.recommendedMonths)}
                              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-2.5 py-1 text-[10px] font-semibold text-rose-200 hover:bg-rose-500/30 active:scale-95 transition"
                            >
                              <span>Fix Pace: Extend to {aiCheck.recommendedMonths} months (~{symbol}25k/mo) →</span>
                            </button>
                          )}
                        </div>
                      )}

                      {goal.target_date && (
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <Calendar className="h-3 w-3 text-muted-foreground/60" />
                          <span>Target: {new Date(goal.target_date).toLocaleDateString()}</span>
                        </div>
                      )}

                      {goal.notes && (
                        <p className="text-[10px] text-muted-foreground/80 line-clamp-1 italic pt-0.5">
                          "{goal.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer Actions: Deposit & Anti-Impulse Withdraw */}
                  <div className="mt-5 flex items-center justify-between border-t border-hairline pt-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          playClick()
                          setSelectedGoal(goal)
                          setModalOpen(true)
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
                        title="Edit Goal"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete savings goal "${goal.title}"?`)) {
                            deleteMutation.mutate(goal.id)
                          }
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition"
                        title="Delete Goal"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {goal.current_amount > 0 && (
                        <button
                          onClick={() => handleOpenWithdraw(goal)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition shadow-sm',
                            goal.is_locked
                              ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                              : 'bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                          )}
                          title={goal.is_locked ? 'Locked Vault: Protected Withdrawal' : 'Withdraw funds'}
                        >
                          {goal.is_locked ? <Lock className="h-3 w-3" /> : null}
                          <span>Withdraw</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenDeposit(goal)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-95 transition shadow-sm"
                      >
                        <Coins className="h-3.5 w-3.5" />
                        Deposit
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create / Edit Goal Modal */}
      <GoalModal
        open={modalOpen}
        editingGoal={selectedGoal}
        symbol={symbol}
        onClose={() => {
          setModalOpen(false)
          setSelectedGoal(null)
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['savings'] })
          setModalOpen(false)
          setSelectedGoal(null)
        }}
      />

      {/* Deposit Modal */}
      <DepositModal
        open={depositModalOpen}
        goal={selectedGoal}
        symbol={symbol}
        amount={actionAmount}
        onAmountChange={setActionAmount}
        onSubmit={(e) => {
          e.preventDefault()
          if (!selectedGoal) return
          const parsed = parseFloat(actionAmount)
          if (isNaN(parsed) || parsed <= 0) {
            toast.error('Please enter a valid deposit amount')
            return
          }
          depositMutation.mutate({ id: selectedGoal.id, amount: parsed })
        }}
        onClose={() => setDepositModalOpen(false)}
        loading={depositMutation.isPending}
      />

      {/* Feature 4: Protected Vault Withdrawal Modal */}
      <WithdrawalModal
        open={withdrawModalOpen}
        goal={selectedGoal}
        symbol={symbol}
        amount={actionAmount}
        onAmountChange={setActionAmount}
        onSubmit={(amountToWithdraw) => {
          if (!selectedGoal) return
          withdrawMutation.mutate({ id: selectedGoal.id, amount: amountToWithdraw })
        }}
        onClose={() => setWithdrawModalOpen(false)}
        loading={withdrawMutation.isPending}
      />
    </div>
  )
}

// ─── IMPROVED COMPACT GOAL MODAL WITH AI REALITY CHECK ───────────────────────

function GoalModal({
  open,
  editingGoal,
  symbol,
  onClose,
  onSuccess,
}: {
  open: boolean
  editingGoal: SavingGoal | null
  symbol: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [mode, setMode] = useState<'form' | 'nlp'>('form')
  const [nlpText, setNlpText] = useState('')

  const [title, setTitle] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [category, setCategory] = useState('purchase')
  const [isLocked, setIsLocked] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  // Custom Popover States
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [catMenuOpen, setCatMenuOpen] = useState(false)

  const datePickerRef = useRef<HTMLDivElement>(null)
  const catMenuRef = useRef<HTMLDivElement>(null)

  const playClick = useSound('click')
  const playChime = useSound('chime')

  // Outside click handlers
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
    setDatePickerOpen(false)
    setCatMenuOpen(false)
    if (editingGoal) {
      setTitle(editingGoal.title)
      setTargetAmount(String(editingGoal.target_amount))
      setCurrentAmount(String(editingGoal.current_amount))
      setTargetDate(editingGoal.target_date ? editingGoal.target_date.slice(0, 10) : '')
      setCategory(editingGoal.category)
      setIsLocked(Boolean(editingGoal.is_locked))
      setNotes(editingGoal.notes || '')
      setMode('form')
    } else {
      setTitle('')
      setTargetAmount('')
      setCurrentAmount('0')
      setTargetDate('')
      setCategory('purchase')
      setIsLocked(false)
      setNotes('')
      setNlpText('')
      setMode('form')
    }
  }, [editingGoal, open])

  const parsedNlp = useMemo(() => parseSavingGoalNLP(nlpText), [nlpText])

  // Feature 3: Real-Time AI Feasibility & Reality Check
  const aiFeasibility = useMemo(() => {
    const t = parseFloat(targetAmount)
    const c = parseFloat(currentAmount) || 0
    return computeAIFeasibility(t, c, targetDate, symbol)
  }, [targetAmount, currentAmount, targetDate, symbol])

  const handleNlpApply = () => {
    if (!parsedNlp.title) {
      toast.error('Please specify a goal name')
      return
    }
    if (!parsedNlp.targetAmount || parsedNlp.targetAmount <= 0) {
      toast.error('Please specify target amount')
      return
    }

    setTitle(parsedNlp.title)
    setTargetAmount(String(parsedNlp.targetAmount))
    setCurrentAmount('0')
    setTargetDate(parsedNlp.targetDate)
    setCategory(parsedNlp.category)
    setIsLocked(parsedNlp.isLocked)
    setMode('form')
    playChime()
    toast.success('AI configured savings pot! Review feasibility & save.')
  }

  const handleApplyAIRecommendedDate = () => {
    if (!aiFeasibility?.recommendedMonths) return
    const newDate = format(addMonths(new Date(), aiFeasibility.recommendedMonths), 'yyyy-MM-dd')
    setTargetDate(newDate)
    playChime()
    toast.success(`Applied AI recommended timeline: ${newDate}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Please enter a goal title')
      return
    }
    const parsedTarget = parseFloat(targetAmount)
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      toast.error('Please enter a valid target amount')
      return
    }
    const parsedCurrent = parseFloat(currentAmount) || 0

    setLoading(true)
    try {
      if (editingGoal) {
        await putSavingGoalUpdate(editingGoal.id, {
          title: title.trim(),
          target_amount: parsedTarget,
          current_amount: parsedCurrent,
          target_date: targetDate || undefined,
          category,
          is_locked: isLocked,
          notes: notes.trim(),
        })
        toast.success(`Updated ${title}`)
      } else {
        await postSavingGoalAdd({
          title: title.trim(),
          target_amount: parsedTarget,
          current_amount: parsedCurrent,
          target_date: targetDate || undefined,
          category,
          is_locked: isLocked,
          notes: notes.trim(),
        })
        toast.success(`Created pot for ${title}!`)
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

      {/* Modal Dialog with Safe Top Clearance & Constrained Max Height */}
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
                {editingGoal ? 'Edit Savings Pot' : 'New Savings Pot'}
              </h2>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary font-semibold">
                {editingGoal ? 'EDIT POT' : 'TARGET POT'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lock in financial targets, compute required contribution rhythm, and track progress
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!editingGoal && (
              <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-surface-2 p-0.5">
                <button
                  type="button"
                  onClick={() => setMode('form')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-medium transition',
                    mode === 'form'
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Form
                </button>
                <button
                  type="button"
                  onClick={() => setMode('nlp')}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition',
                    mode === 'nlp'
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
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
          {mode === 'nlp' && !editingGoal ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Sparkles className="h-4 w-4" />
                <span>Type naturally to configure your savings target</span>
              </div>
              <input
                type="text"
                autoFocus
                placeholder='e.g. "Save 150000 for MacBook Pro by Dec 2026" or "Emergency Fund 50000 in 6 months locked"...'
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
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded bg-surface-2 px-2 py-0.5 font-semibold text-foreground">
                      Goal: {parsedNlp.title || '...'}
                    </span>
                    <span className="rounded bg-surface-2 px-2 py-0.5 font-mono font-bold text-foreground">
                      Target: {symbol}{parsedNlp.targetAmount || 0}
                    </span>
                    <span
                      className="rounded px-2 py-0.5 font-semibold capitalize"
                      style={{
                        backgroundColor: CATEGORY_MAP[parsedNlp.category]?.bg,
                        color: CATEGORY_MAP[parsedNlp.category]?.color,
                      }}
                    >
                      {CATEGORY_MAP[parsedNlp.category]?.label}
                    </span>
                    {parsedNlp.isLocked && (
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono font-bold text-amber-300">
                        🔒 Locked Vault
                      </span>
                    )}
                    {parsedNlp.targetDate && (
                      <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-amber-400">
                        Target Date: {parsedNlp.targetDate}
                      </span>
                    )}
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
                disabled={!parsedNlp.title || !parsedNlp.targetAmount}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 active:scale-95 transition disabled:opacity-50"
              >
                Apply AI Details to Form
              </button>
            </div>
          </div>
        ) : (
          /* Form View: High-density 2-column structured layout */
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Feature 4: Vault Type Selector (Anti-Impulse Protection) */}
            <div>
              <label className="text-[11px] font-medium text-foreground">Pot Security Archetype</label>
              <div className="mt-1 grid grid-cols-2 gap-2 rounded-xl border border-border/80 bg-surface-1 p-1">
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setIsLocked(false)
                  }}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition',
                    !isLocked
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
                  )}
                >
                  <Unlock className="h-3.5 w-3.5" />
                  Flexible Pot (Anytime Access)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setIsLocked(true)
                  }}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition',
                    isLocked
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
                  )}
                >
                  <Lock className="h-3.5 w-3.5" />
                  Locked Vault (Anti-Impulse Shield)
                </button>
              </div>
            </div>

            {/* Row 1: Goal Title & Target Amount */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium text-foreground">Goal Title</label>
                <input
                  type="text"
                  placeholder="e.g. MacBook Pro, Japan Vacation, Emergency Fund"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-border/80 bg-surface-1 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground">Target Amount ({symbol})</label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                    {symbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 150000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    required
                    className="w-full rounded-xl border border-border/80 bg-surface-1 py-2 pl-7 pr-3 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Current Saved & Target Date */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium text-foreground">Initial / Current Saved ({symbol})</label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                    {symbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-surface-1 py-2 pl-7 pr-3 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground">Target Completion Date (optional)</label>
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
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className={targetDate ? 'text-foreground' : 'text-muted-foreground/60 italic font-sans'}>
                        {targetDate || 'No deadline (tap to pick)'}
                      </span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
                  </button>

                  <AnimatePresence>
                    {datePickerOpen && (
                      <TactileDatePicker
                        value={targetDate}
                        onChange={(d) => setTargetDate(d)}
                        onClose={() => setDatePickerOpen(false)}
                        align="left"
                        position="top"
                        allowClear={true}
                        presets={[
                          { label: 'In 3 Months', date: addMonths(new Date(), 3) },
                          { label: 'In 6 Months', date: addMonths(new Date(), 6) },
                          { label: 'In 1 Year', date: addMonths(new Date(), 12) },
                        ]}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Row 3: Category Selector Popover */}
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
                      className="absolute left-0 top-11 z-[75] w-full rounded-xl border border-border/90 bg-[#16191d] p-1.5 shadow-2xl backdrop-blur-xl"
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
                          </button>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Feature 3: Real-Time AI Feasibility & Reality Check Banner */}
            {aiFeasibility && (
              <div
                className={cn(
                  'rounded-xl border p-3 text-xs transition-all space-y-2',
                  aiFeasibility.severity === 'safe'
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : aiFeasibility.severity === 'moderate'
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-rose-500/40 bg-rose-500/10'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {aiFeasibility.severity === 'strain' ? (
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                    ) : aiFeasibility.severity === 'moderate' ? (
                      <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                    )}
                    <span className={cn(
                      'font-bold text-xs',
                      aiFeasibility.severity === 'strain'
                        ? 'text-rose-400'
                        : aiFeasibility.severity === 'moderate'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    )}>
                      {aiFeasibility.status}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-foreground">
                    ~{symbol}{aiFeasibility.monthlyRequired.toLocaleString()}/mo
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {aiFeasibility.details}
                </p>
                {aiFeasibility.recommendation && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                    <span className="text-[10px] text-rose-300 font-medium">
                      💡 {aiFeasibility.recommendation}
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyAIRecommendedDate}
                      className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-200 hover:bg-rose-500/30 transition shrink-0"
                    >
                      Apply Recommended Date
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Row 4: Notes (optional) */}
            <div>
              <label className="text-[11px] font-medium text-foreground">Notes / Savings Strategy (optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. Setting aside 10% of monthly freelance income..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border/80 bg-surface-1 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none resize-none"
              />
            </div>

            {/* Footer Actions */}
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
                className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingGoal ? 'Update Pot' : 'Create Pot'}
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

// ─── PORTALED DEPOSIT MODAL ─────────────────────────────────────────────────

function DepositModal({
  open,
  goal,
  symbol,
  amount,
  onAmountChange,
  onSubmit,
  onClose,
  loading,
}: {
  open: boolean
  goal: SavingGoal | null
  symbol: string
  amount: string
  onAmountChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  loading: boolean
}) {
  if (!open || !goal) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start sm:justify-center overflow-y-auto p-4 sm:p-6 pt-20 sm:pt-24 pb-12">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative my-auto w-full max-w-sm overflow-hidden rounded-2xl border border-border/80 bg-[#121518] p-6 shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div>
            <h2 className="text-base font-bold text-foreground">Deposit to {goal.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Currently {money(goal.current_amount, symbol)} of {money(goal.target_amount, symbol)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-[11px] font-medium text-foreground">Deposit Amount ({symbol})</label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                {symbol}
              </span>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 5000"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                required
                autoFocus
                className="w-full rounded-xl border border-border/80 bg-surface-1 py-2.5 pl-8 pr-3 text-sm font-mono text-foreground focus:border-primary focus:outline-none font-semibold"
              />
            </div>
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5">
            {[500, 1000, 5000, 10000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onAmountChange(String(preset))}
                className="rounded-lg border border-border/60 bg-surface-2/60 px-2 py-1 text-[11px] font-mono text-muted-foreground hover:border-primary hover:text-primary transition"
              >
                +{money(preset, symbol)}
              </button>
            ))}
          </div>

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
              className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition"
            >
              {loading ? 'Depositing...' : 'Confirm Deposit'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  )
}

// ─── FEATURE 4: PROTECTED VAULT WITHDRAWAL MODAL ────────────────────────────

function WithdrawalModal({
  open,
  goal,
  symbol,
  amount,
  onAmountChange,
  onSubmit,
  onClose,
  loading,
}: {
  open: boolean
  goal: SavingGoal | null
  symbol: string
  amount: string
  onAmountChange: (v: string) => void
  onSubmit: (amount: number) => void
  onClose: () => void
  loading: boolean
}) {
  const [reason, setReason] = useState('')
  const [holdProgress, setHoldProgress] = useState(0)
  const holdIntervalRef = useRef<any>(null)

  useEffect(() => {
    setReason('')
    setHoldProgress(0)
  }, [open])

  if (!open || !goal) return null

  const isLockedVault = Boolean(goal.is_locked)
  const parsedAmount = parseFloat(amount) || 0

  const handleStartHold = () => {
    if (!isLockedVault) return
    if (parsedAmount <= 0) {
      toast.error('Please enter withdrawal amount first')
      return
    }
    if (!reason.trim()) {
      toast.error('Please specify an emergency withdrawal reason')
      return
    }

    holdIntervalRef.current = setInterval(() => {
      setHoldProgress((prev) => {
        if (prev >= 100) {
          clearInterval(holdIntervalRef.current)
          onSubmit(parsedAmount)
          return 100
        }
        return prev + 5 // 2 seconds total hold
      })
    }, 100)
  }

  const handleStopHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current)
    }
    if (holdProgress < 100) {
      setHoldProgress(0)
    }
  }

  const handleDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isLockedVault) return // locked vaults must use press-and-hold
    if (parsedAmount <= 0) {
      toast.error('Please enter a valid withdrawal amount')
      return
    }
    onSubmit(parsedAmount)
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start sm:justify-center overflow-y-auto p-4 sm:p-6 pt-20 sm:pt-24 pb-12">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className={cn(
          'relative my-auto w-full max-w-sm overflow-hidden rounded-2xl border p-6 shadow-2xl backdrop-blur-2xl bg-[#121518]',
          isLockedVault ? 'border-amber-500/50' : 'border-border/80'
        )}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-foreground">Withdraw from {goal.title}</h2>
              {isLockedVault && (
                <span className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-300">
                  <Lock className="h-2.5 w-2.5" />
                  Locked Vault
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Available balance: <strong className="text-foreground">{money(goal.current_amount, symbol)}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleDirectSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-[11px] font-medium text-foreground">Withdrawal Amount ({symbol})</label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                {symbol}
              </span>
              <input
                type="number"
                step="0.01"
                max={goal.current_amount}
                placeholder="0"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                required
                autoFocus
                className="w-full rounded-xl border border-border/80 bg-surface-1 py-2.5 pl-8 pr-3 text-sm font-mono text-foreground focus:border-primary focus:outline-none font-semibold"
              />
            </div>
          </div>

          {/* Anti-Impulse Reason for Locked Vaults */}
          {isLockedVault && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Anti-Impulse Protection Active</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                This pot is designated as a protected reserve. Please log the reason for breaking the vault.
              </p>
              <input
                type="text"
                placeholder="e.g. Urgent car repair, Medical bill..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-border/80 bg-surface-2 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-amber-400 focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
            >
              Cancel
            </button>

            {isLockedVault ? (
              <button
                type="button"
                onMouseDown={handleStartHold}
                onMouseUp={handleStopHold}
                onMouseLeave={handleStopHold}
                onTouchStart={handleStartHold}
                onTouchEnd={handleStopHold}
                disabled={loading || parsedAmount <= 0 || !reason.trim()}
                className="relative overflow-hidden rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black shadow-md hover:bg-amber-400 active:scale-95 transition disabled:opacity-40 select-none"
              >
                {/* Hold Progress Bar */}
                <span
                  className="absolute left-0 top-0 bottom-0 bg-amber-600 transition-all duration-75"
                  style={{ width: `${holdProgress}%`, opacity: 0.6 }}
                />
                <span className="relative z-10 flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  <span>{holdProgress > 0 ? `Unlocking... (${holdProgress}%)` : 'Hold 2s to Unlock'}</span>
                </span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || parsedAmount <= 0}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 active:scale-95 transition disabled:opacity-40"
              >
                {loading ? 'Withdrawing...' : 'Confirm Withdrawal'}
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  )
}
