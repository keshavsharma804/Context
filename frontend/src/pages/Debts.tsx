import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import {
  HandCoins,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Edit2,
  Calendar,
  User,
  RotateCcw,
  Scale,
  X,
  FileText,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
} from 'date-fns'
import { toast } from 'sonner'
import {
  fetchDebts,
  fetchConfig,
  postDebtAdd,
  putDebtUpdate,
  postDebtSettle,
  deleteDebt,
  type Debt,
} from '@/lib/api'
import { PageHeader, EmptyCommand, ErrorPanel } from '@/components/pages/PageChrome'
import { CountUp } from '@/components/motion/CountUp'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSound } from '@/hooks/useSound'

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
            Clear Date (No Due Date)
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── NATURAL LANGUAGE DEBT PARSER ───────────────────────────────────────────

function parseDebtNLP(raw: string) {
  let clean = raw.trim()
  const today = format(new Date(), 'yyyy-MM-dd')
  if (!clean) {
    return {
      person: '',
      direction: 'lent' as 'lent' | 'borrowed',
      amount: null as number | null,
      description: '',
      takenAt: today,
      dueDate: '',
      notes: '',
    }
  }

  // 1. Direction:
  let direction: 'lent' | 'borrowed' = 'lent'
  if (/\b(?:borrowed|borrow|took|i owe|owe|got from)\b/i.test(clean)) {
    direction = 'borrowed'
  } else if (/\b(?:lent|lend|gave|give|paid for|owes me)\b/i.test(clean)) {
    direction = 'lent'
  }

  // 2. Amount:
  let amount: number | null = null
  const amountMatch = clean.match(/(?:(?:rs\.?|inr|₹)\s*)?(\d+(?:\.\d{1,2})?)/i)
  if (amountMatch) {
    amount = parseFloat(amountMatch[1])
  }

  // 3. Person:
  let person = ''
  const personMatch = clean.match(/(?:to|from|with)\s+([A-Z][a-z]+|[a-z]+)/i)
  if (personMatch) {
    person = personMatch[1].trim()
    person = person.charAt(0).toUpperCase() + person.slice(1)
  }

  // 4. Taken Date (When money was borrowed / lent):
  let takenAt = today
  if (/\byesterday\b/i.test(clean)) {
    takenAt = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  } else if (/\blast\s+week\b/i.test(clean)) {
    takenAt = format(subDays(new Date(), 7), 'yyyy-MM-dd')
  }

  // 5. Expected Settlement Due Date:
  let dueDate = ''
  const daysDueMatch = clean.match(/(?:due\s+in|settle\s+in|by)\s+(\d+)\s*days?/i)
  if (daysDueMatch) {
    dueDate = format(addDays(new Date(), parseInt(daysDueMatch[1], 10)), 'yyyy-MM-dd')
  } else if (/(?:due\s+next\s+week|in\s+a\s+week)/i.test(clean)) {
    dueDate = format(addDays(new Date(), 7), 'yyyy-MM-dd')
  } else if (/(?:due\s+in\s+2\s+weeks)/i.test(clean)) {
    dueDate = format(addDays(new Date(), 14), 'yyyy-MM-dd')
  } else if (/(?:due\s+next\s+month|in\s+a\s+month)/i.test(clean)) {
    dueDate = format(addMonths(new Date(), 1), 'yyyy-MM-dd')
  }

  // 6. Purpose / Description:
  let description = ''
  const forMatch = clean.match(/\bfor\s+([^,.;]+?)(?:\s+(?:due|on|yesterday|tomorrow|next|in|\d+)|$)/i)
  if (forMatch) {
    description = forMatch[1].trim()
  }

  return {
    person,
    direction,
    amount,
    description,
    takenAt,
    dueDate,
    notes: '',
  }
}

// ─── MAIN DEBTS PAGE COMPONENT ───────────────────────────────────────────────

export default function Debts() {
  const queryClient = useQueryClient()
  const playClick = useSound('click')
  const playChime = useSound('chime')

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'lent' | 'borrowed' | 'settled'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)
  const [settlingId, setSettlingId] = useState<number | null>(null)

  // In-page NLP State
  const [inPageNlp, setInPageNlp] = useState('')
  const [inPageNlpLoading, setInPageNlpLoading] = useState(false)

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
    queryKey: ['debts'],
    queryFn: () => fetchDebts(),
  })

  const debts = data?.debts ?? []
  const summary = data?.summary

  // Mutations
  const settleMutation = useMutation({
    mutationFn: ({ id, settled }: { id: number; settled: boolean }) =>
      postDebtSettle(id, settled),
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['debts'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      toast.success(
        vars.settled
          ? `Settled debt with ${res.debt.person}!`
          : `Reopened debt with ${res.debt.person}`
      )
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update settlement status')
    },
    onSettled: () => setSettlingId(null),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDebt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] })
      toast.success('Record deleted')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete record')
    },
  })

  // Handle in-page AI submission
  const handleInPageNlpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseDebtNLP(inPageNlp)
    if (!parsed.person) {
      toast.error('Please specify contact name (e.g. "Lent 500 to Rahul")')
      return
    }
    if (!parsed.amount || parsed.amount <= 0) {
      toast.error('Please specify an amount (e.g. "Lent 500 to Rahul")')
      return
    }

    setInPageNlpLoading(true)
    try {
      await postDebtAdd({
        person: parsed.person,
        direction: parsed.direction,
        amount: parsed.amount,
        description: parsed.description,
        taken_at: parsed.takenAt || undefined,
        due_date: parsed.dueDate || undefined,
        notes: parsed.notes,
      })
      queryClient.invalidateQueries({ queryKey: ['debts'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      toast.success(
        parsed.direction === 'lent'
          ? `Recorded ${money(parsed.amount, symbol)} lent to ${parsed.person}`
          : `Recorded ${money(parsed.amount, symbol)} borrowed from ${parsed.person}`
      )
      setInPageNlp('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to record debt via AI')
    } finally {
      setInPageNlpLoading(false)
    }
  }

  // Filtered debts
  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      const matchSearch =
        d.person.toLowerCase().includes(search.toLowerCase()) ||
        (d.description && d.description.toLowerCase().includes(search.toLowerCase())) ||
        (d.notes && d.notes.toLowerCase().includes(search.toLowerCase()))

      if (!matchSearch) return false

      if (activeTab === 'settled') {
        return d.settled
      }
      if (d.settled) return false // other tabs only show active

      if (activeTab === 'lent') return d.direction === 'lent'
      if (activeTab === 'borrowed') return d.direction === 'borrowed'
      return true
    })
  }, [debts, search, activeTab])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={HandCoins}
        eyebrow="IOUs & Balances"
        title="Debts & IOUs"
        subtitle={
          summary
            ? `${summary.active_count} active slips · Net balance ${
                summary.net_balance >= 0 ? '+' : ''
              }${money(summary.net_balance, symbol)}`
            : 'Keep clean track of money lent to or borrowed from others'
        }
        actions={
          <button
            onClick={() => {
              playClick()
              setEditingDebt(null)
              setModalOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Record Debt / IOU
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
          {/* Owed to You (Lent) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 backdrop-blur-xl shadow-sm"
          >
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="text-[11px] font-medium uppercase tracking-wider">Owed to You</span>
              <ArrowUpRight className="h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl">
              <CountUp value={summary.total_lent} prefix={symbol} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Money you have lent out
            </p>
          </motion.div>

          {/* You Owe (Borrowed) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 backdrop-blur-xl shadow-sm"
          >
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
              <span className="text-[11px] font-medium uppercase tracking-wider">You Owe</span>
              <ArrowDownLeft className="h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 sm:text-3xl">
              <CountUp value={summary.total_borrowed} prefix={symbol} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Money you have borrowed
            </p>
          </motion.div>

          {/* Net Balance */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-xl shadow-sm"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">Net Position</span>
              <Scale className="h-4 w-4 text-primary" />
            </div>
            <div
              className={cn(
                'mt-2 text-2xl font-bold tracking-tight sm:text-3xl',
                summary.net_balance > 0
                  ? 'text-emerald-500'
                  : summary.net_balance < 0
                  ? 'text-rose-500'
                  : 'text-foreground'
              )}
            >
              {summary.net_balance >= 0 ? '+' : ''}
              <CountUp value={summary.net_balance} prefix={symbol} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {summary.net_balance >= 0 ? 'You are in net surplus' : 'You have net liabilities'}
            </p>
          </motion.div>

          {/* Active / Overdue Count */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={cn(
              'relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl shadow-sm transition',
              summary.overdue_count > 0
                ? 'border-red-500/30 bg-red-500/5'
                : 'border-border/70 bg-card/60'
            )}
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">Active Slips</span>
              <Clock className={cn('h-4 w-4', summary.overdue_count > 0 ? 'text-red-500' : 'text-primary')} />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              <CountUp value={summary.active_count} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {summary.overdue_count > 0 ? (
                <span className="text-red-500 font-semibold">
                  {summary.overdue_count} overdue debt{summary.overdue_count > 1 ? 's' : ''}!
                </span>
              ) : (
                `${summary.settled_count} resolved in history`
              )}
            </p>
          </motion.div>
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
          <span className="text-[11px] font-semibold text-foreground">AI Natural Language IOU Logging</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            · Type naturally to record borrowed or lent cash
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder='e.g. "Lent 500 to Rahul for dinner yesterday" or "Borrowed 1200 from Priya for groceries due in 10 days"...'
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
            <span>Record via AI ↵</span>
          </button>
        </div>
      </form>

      {/* Filter and Search Bar */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by contact name, purpose, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border/80 bg-surface-1/60 py-2 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary backdrop-blur-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: 'all', label: 'All Active' },
              { id: 'lent', label: 'Owed to Me' },
              { id: 'borrowed', label: 'I Owe' },
              { id: 'settled', label: 'Settled History' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                playClick()
                setActiveTab(tab.id)
              }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-surface-2/60 text-muted-foreground hover:text-foreground hover:bg-surface-2'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Debts List / Grid */}
      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 rounded-2xl border border-border/50 bg-card/40 animate-pulse" />
          ))}
        </div>
      ) : filteredDebts.length === 0 ? (
        <div className="mt-6">
          <EmptyCommand
            title={search ? 'No matching records found' : 'No debts or IOUs in this view'}
            description={
              search
                ? `No records matching "${search}". Try another search term.`
                : activeTab === 'settled'
                ? 'No debts have been marked settled yet.'
                : 'All clear! Click "Record Debt / IOU" or use the AI bar above to log a transaction.'
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filteredDebts.map((debt) => {
              const isLent = debt.direction === 'lent'

              return (
                <motion.div
                  key={debt.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={cn(
                    'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 backdrop-blur-xl transition shadow-sm hover:shadow-md',
                    debt.settled
                      ? 'border-border/60 bg-card/40 opacity-70'
                      : isLent
                      ? 'border-emerald-500/25 bg-gradient-to-b from-emerald-500/5 to-card/60 hover:border-emerald-500/40'
                      : 'border-rose-500/25 bg-gradient-to-b from-rose-500/5 to-card/60 hover:border-rose-500/40'
                  )}
                >
                  <div>
                    {/* Header: Person & Direction Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-xl font-bold uppercase text-xs shadow-inner',
                            isLent
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : 'bg-rose-500/15 text-rose-500'
                          )}
                        >
                          {debt.person.slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">{debt.person}</h3>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider',
                              isLent
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            )}
                          >
                            {isLent ? (
                              <>
                                <ArrowUpRight className="h-3 w-3" /> Owes You
                              </>
                            ) : (
                              <>
                                <ArrowDownLeft className="h-3 w-3" /> You Owe
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Status / Due Badge */}
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-tight',
                          debt.settled && 'bg-emerald-500/10 text-emerald-500',
                          !debt.settled && debt.status === 'overdue' && 'bg-red-500/15 text-red-500 font-semibold',
                          !debt.settled && debt.status === 'urgent' && 'bg-amber-500/15 text-amber-500 font-semibold',
                          !debt.settled && debt.status === 'soon' && 'bg-blue-500/10 text-blue-500',
                          !debt.settled && debt.status === 'active' && 'bg-surface-2 text-muted-foreground'
                        )}
                      >
                        {debt.settled ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Settled
                          </>
                        ) : debt.status === 'overdue' ? (
                          <>
                            <AlertCircle className="h-3 w-3" /> Overdue
                          </>
                        ) : debt.status === 'urgent' ? (
                          <>
                            <Clock className="h-3 w-3 animate-pulse" /> Due in {debt.days_remaining}d
                          </>
                        ) : debt.due_date ? (
                          <>
                            <Calendar className="h-3 w-3" /> Due in {debt.days_remaining}d
                          </>
                        ) : (
                          'No due date'
                        )}
                      </span>
                    </div>

                    {/* Amount & Description */}
                    <div className="mt-4">
                      <div
                        className={cn(
                          'font-mono text-2xl font-bold tracking-tight',
                          isLent
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        )}
                      >
                        {money(debt.amount, symbol)}
                      </div>
                      {debt.description && (
                        <p className="mt-1 text-xs font-medium text-foreground line-clamp-1">
                          {debt.description}
                        </p>
                      )}
                    </div>

                    {/* Dates: When money was borrowed or lent & settlement due date */}
                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-border/40 bg-surface-2/40 p-2.5 text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground/70">
                          {isLent ? 'Lent Date' : 'Borrowed Date'}
                        </span>
                        <span className="font-mono text-xs font-semibold text-foreground mt-0.5">
                          {debt.taken_at
                            ? new Date(`${debt.taken_at.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Today'}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground/70">
                          Settlement Due
                        </span>
                        <span className="font-mono text-xs font-semibold text-foreground mt-0.5">
                          {debt.due_date ? (
                            new Date(`${debt.due_date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          ) : (
                            <span className="text-muted-foreground/50 font-normal italic">Optional / None</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {debt.settled && debt.settled_at && (
                      <p className="mt-2 text-[10px] font-mono text-emerald-500">
                        ✓ Settled on {new Date(debt.settled_at).toLocaleDateString()}
                      </p>
                    )}
                    {debt.notes && (
                      <p className="mt-1 text-[10px] text-muted-foreground/80 line-clamp-2 italic">
                        "{debt.notes}"
                      </p>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="mt-5 flex items-center justify-between border-t border-hairline pt-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          playClick()
                          setEditingDebt(debt)
                          setModalOpen(true)
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
                        title="Edit record"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete debt slip for ${debt.person}?`)) {
                            deleteMutation.mutate(debt.id)
                          }
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition"
                        title="Delete record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {debt.settled ? (
                      <button
                        onClick={() => {
                          setSettlingId(debt.id)
                          settleMutation.mutate({ id: debt.id, settled: false })
                        }}
                        disabled={settlingId === debt.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground transition shadow-sm"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reopen
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSettlingId(debt.id)
                          settleMutation.mutate({ id: debt.id, settled: true })
                        }}
                        disabled={settlingId === debt.id}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition shadow-sm',
                          isLent
                            ? 'bg-emerald-600 hover:bg-emerald-500'
                            : 'bg-rose-600 hover:bg-rose-500'
                        )}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Settle Up
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add / Edit Debt Dialog */}
      <DebtDialog
        open={modalOpen}
        editingDebt={editingDebt}
        symbol={symbol}
        onClose={() => {
          setModalOpen(false)
          setEditingDebt(null)
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['debts'] })
          setModalOpen(false)
          setEditingDebt(null)
        }}
      />
    </div>
  )
}

// ─── IMPROVED COMPACT DEBT DIALOG ───────────────────────────────────────────

function DebtDialog({
  open,
  editingDebt,
  symbol,
  onClose,
  onSuccess,
}: {
  open: boolean
  editingDebt: Debt | null
  symbol: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [mode, setMode] = useState<'form' | 'nlp'>('form')
  const [nlpText, setNlpText] = useState('')

  const [person, setPerson] = useState('')
  const [direction, setDirection] = useState<'lent' | 'borrowed'>('lent')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [takenAt, setTakenAt] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  // Custom Popover States
  const [takenPickerOpen, setTakenPickerOpen] = useState(false)
  const [duePickerOpen, setDuePickerOpen] = useState(false)

  const takenPickerRef = useRef<HTMLDivElement>(null)
  const duePickerRef = useRef<HTMLDivElement>(null)

  const playClick = useSound('click')
  const playChime = useSound('chime')

  // Outside click handlers
  useEffect(() => {
    if (!takenPickerOpen) return
    const handleOutside = (e: MouseEvent) => {
      if (takenPickerRef.current && !takenPickerRef.current.contains(e.target as Node)) {
        setTakenPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [takenPickerOpen])

  useEffect(() => {
    if (!duePickerOpen) return
    const handleOutside = (e: MouseEvent) => {
      if (duePickerRef.current && !duePickerRef.current.contains(e.target as Node)) {
        setDuePickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [duePickerOpen])

  useEffect(() => {
    setTakenPickerOpen(false)
    setDuePickerOpen(false)
    if (editingDebt) {
      setPerson(editingDebt.person)
      setDirection(editingDebt.direction)
      setAmount(String(editingDebt.amount))
      setDescription(editingDebt.description || '')
      setTakenAt(editingDebt.taken_at ? editingDebt.taken_at.slice(0, 10) : format(new Date(), 'yyyy-MM-dd'))
      setDueDate(editingDebt.due_date ? editingDebt.due_date.slice(0, 10) : '')
      setNotes(editingDebt.notes || '')
      setMode('form')
    } else {
      setPerson('')
      setDirection('lent')
      setAmount('')
      setDescription('')
      setTakenAt(format(new Date(), 'yyyy-MM-dd'))
      setDueDate('')
      setNotes('')
      setNlpText('')
      setMode('form')
    }
  }, [editingDebt, open])

  const parsedNlp = useMemo(() => parseDebtNLP(nlpText), [nlpText])

  const handleNlpApply = () => {
    if (!parsedNlp.person) {
      toast.error('Please include a contact name')
      return
    }
    if (!parsedNlp.amount || parsedNlp.amount <= 0) {
      toast.error('Please include an amount')
      return
    }

    setPerson(parsedNlp.person)
    setDirection(parsedNlp.direction)
    setAmount(String(parsedNlp.amount))
    setDescription(parsedNlp.description)
    setTakenAt(parsedNlp.takenAt)
    setDueDate(parsedNlp.dueDate)
    setMode('form')
    playChime()
    toast.success('AI filled debt details! Review and save.')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!person.trim()) {
      toast.error('Please enter contact name')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setLoading(true)
    try {
      if (editingDebt) {
        await putDebtUpdate(editingDebt.id, {
          person: person.trim(),
          direction,
          amount: parsedAmount,
          description: description.trim(),
          taken_at: takenAt || undefined,
          due_date: dueDate || undefined,
          notes: notes.trim(),
        })
        toast.success(`Updated record for ${person}`)
      } else {
        await postDebtAdd({
          person: person.trim(),
          direction,
          amount: parsedAmount,
          description: description.trim(),
          taken_at: takenAt || undefined,
          due_date: dueDate || undefined,
          notes: notes.trim(),
        })
        toast.success(
          direction === 'lent'
            ? `Recorded ${money(parsedAmount, symbol)} lent to ${person}`
            : `Recorded ${money(parsedAmount, symbol)} borrowed from ${person}`
        )
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
                {editingDebt ? 'Edit Debt / IOU Slip' : 'Record Debt / IOU Slip'}
              </h2>
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-[10px] font-mono font-semibold',
                  direction === 'lent'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-rose-500/15 text-rose-400'
                )}
              >
                {editingDebt ? 'EDIT MODE' : direction === 'lent' ? 'I LENT CASH' : 'I BORROWED'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Keep tabs on borrowed or lent amounts, origin dates, and settlement schedules
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!editingDebt && (
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
          {mode === 'nlp' && !editingDebt ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Sparkles className="h-4 w-4" />
                <span>Type naturally to configure your debt slip</span>
              </div>
              <input
                type="text"
                autoFocus
                placeholder='e.g. "Lent 500 to Rahul for dinner yesterday" or "Borrowed 1200 from Priya for groceries due in 10 days"...'
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
                    <span
                      className={cn(
                        'rounded px-2 py-0.5 font-semibold uppercase text-[10px]',
                        parsedNlp.direction === 'lent'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      )}
                    >
                      {parsedNlp.direction === 'lent' ? 'I Lent (Owed to Me)' : 'I Borrowed (I Owe)'}
                    </span>
                    <span className="rounded bg-surface-2 px-2 py-0.5 font-semibold text-foreground">
                      Contact: {parsedNlp.person || '...'}
                    </span>
                    <span className="rounded bg-surface-2 px-2 py-0.5 font-mono font-bold text-foreground">
                      Amount: {symbol}{parsedNlp.amount || 0}
                    </span>
                    <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-muted-foreground">
                      Date: {parsedNlp.takenAt}
                    </span>
                    {parsedNlp.dueDate && (
                      <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-amber-400">
                        Due: {parsedNlp.dueDate}
                      </span>
                    )}
                    {parsedNlp.description && (
                      <span className="rounded bg-surface-2 px-2 py-0.5 text-muted-foreground">
                        Purpose: {parsedNlp.description}
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
                disabled={!parsedNlp.person || !parsedNlp.amount}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 active:scale-95 transition disabled:opacity-50"
              >
                Apply AI Details to Form
              </button>
            </div>
          </div>
        ) : (
          /* Form View: High-density 2-column structured layout */
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Direction Switcher */}
            <div>
              <label className="text-[11px] font-medium text-foreground">Transaction Direction</label>
              <div className="mt-1 grid grid-cols-2 gap-2 rounded-xl border border-border/80 bg-surface-1 p-1">
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setDirection('lent')
                  }}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition',
                    direction === 'lent'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
                  )}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  I Lent Money (Owed to Me)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setDirection('borrowed')
                  }}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition',
                    direction === 'borrowed'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
                  )}
                >
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  I Borrowed Money (I Owe)
                </button>
              </div>
            </div>

            {/* Row 1: Contact Name & Amount */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium text-foreground">
                  {direction === 'lent' ? 'Who owes you? (Contact)' : 'Who did you borrow from? (Contact)'}
                </label>
                <div className="relative mt-1">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                  <input
                    type="text"
                    placeholder="e.g. Rahul, Maya, Mom"
                    value={person}
                    onChange={(e) => setPerson(e.target.value)}
                    required
                    className="w-full rounded-xl border border-border/80 bg-surface-1 py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground">Amount ({symbol})</label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                    {symbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 1500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full rounded-xl border border-border/80 bg-surface-1 py-2 pl-7 pr-3 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Date Borrowed / Lent & Expected Settlement Date */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium text-foreground">
                  {direction === 'lent' ? 'Date Money Was Lent' : 'Date Money Was Borrowed'}
                </label>
                <div ref={takenPickerRef} className="relative mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      playClick()
                      setTakenPickerOpen((v) => !v)
                    }}
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-border/80 bg-surface-1 px-3 text-xs font-mono font-medium text-foreground transition hover:border-primary/50"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{takenAt || 'Select date'}</span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
                  </button>

                  <AnimatePresence>
                    {takenPickerOpen && (
                      <TactileDatePicker
                        value={takenAt}
                        onChange={(d) => setTakenAt(d)}
                        onClose={() => setTakenPickerOpen(false)}
                        align="left"
                        position="top"
                        presets={[
                          { label: 'Today', date: new Date() },
                          { label: 'Yesterday', date: subDays(new Date(), 1) },
                          { label: 'Last Week', date: subDays(new Date(), 7) },
                        ]}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground">
                  Expected Settlement Date (optional)
                </label>
                <div ref={duePickerRef} className="relative mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      playClick()
                      setDuePickerOpen((v) => !v)
                    }}
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-border/80 bg-surface-1 px-3 text-xs font-mono font-medium text-foreground transition hover:border-primary/50"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className={dueDate ? 'text-foreground' : 'text-muted-foreground/60 italic font-sans'}>
                        {dueDate || 'No due date set (tap to add)'}
                      </span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
                  </button>

                  <AnimatePresence>
                    {duePickerOpen && (
                      <TactileDatePicker
                        value={dueDate}
                        onChange={(d) => setDueDate(d)}
                        onClose={() => setDuePickerOpen(false)}
                        align="left"
                        position="top"
                        allowClear={true}
                        presets={[
                          { label: 'In 7 Days', date: addDays(new Date(), 7) },
                          { label: 'In 14 Days', date: addDays(new Date(), 14) },
                          { label: 'In 30 Days', date: addDays(new Date(), 30) },
                        ]}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Row 3: Purpose / Description */}
            <div>
              <label className="text-[11px] font-medium text-foreground">Purpose / Description</label>
              <input
                type="text"
                placeholder="e.g. Dinner bill split, Flight ticket, Rent deposit share"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border/80 bg-surface-1 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
              />
            </div>

            {/* Row 4: Notes (optional) */}
            <div>
              <label className="text-[11px] font-medium text-foreground">Notes (optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. Will pay back after salary on 1st, UPI sent from HDFC..."
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
                {loading ? 'Saving...' : editingDebt ? 'Update Record' : 'Save Record'}
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
