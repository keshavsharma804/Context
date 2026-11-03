import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity,
  Archive,
  BookOpen,
  Brain,
  Check,
  Droplets,
  Dumbbell,
  Flame,
  Heart,
  Laptop,
  Moon,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  X,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchHabit,
  fetchHabits,
  postHabitAdd,
  postHabitArchive,
  postHabitClear,
  postHabitLog,
  postHabitUpdate,
  type Habit,
  type HabitDay,
  type HabitInsight,
  type HabitStatus,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { useSound } from '@/hooks/useSound'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import {
  celebrateHabitLog,
  celebrateHabitMilestone,
} from '@/lib/celebrate'
import { itemEnter, spring, staggerContainer } from '@/lib/animations'
import { MotionCard } from './MotionCard'
import CardHeading from './CardHeading'

const HABIT_ICONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'target', label: 'General', icon: Target },
  { id: 'fitness', label: 'Fitness', icon: Activity },
  { id: 'reading', label: 'Reading', icon: BookOpen },
  { id: 'mind', label: 'Mindfulness', icon: Sparkles },
  { id: 'discipline', label: 'Discipline', icon: ShieldCheck },
  { id: 'work', label: 'Work', icon: Laptop },
  { id: 'water', label: 'Hydration', icon: Droplets },
  { id: 'sleep', label: 'Rest', icon: Moon },
  { id: 'wellness', label: 'Wellness', icon: Heart },
  { id: 'focus', label: 'Focus', icon: Brain },
]

function getHabitIconComponent(name: string, emojiOrId?: string): LucideIcon {
  const n = (name || '').toLowerCase()
  const e = (emojiOrId || '').toLowerCase()
  if (n.includes('read') || n.includes('book') || e.includes('📚') || e === 'reading') return BookOpen
  if (n.includes('sugar') || n.includes('diet') || n.includes('food') || n.includes('eat') || n.includes('fast') || e.includes('🍬') || e === 'discipline') return ShieldCheck
  if (n.includes('meditat') || n.includes('zen') || n.includes('mind') || n.includes('breath') || e.includes('🧘') || e === 'mind') return Sparkles
  if (n.includes('gym') || n.includes('workout') || n.includes('run') || n.includes('fitness') || n.includes('walk') || n.includes('lift') || e.includes('💪') || e.includes('🏃') || e === 'fitness') return Activity
  if (n.includes('code') || n.includes('dev') || n.includes('program') || e === 'work') return Laptop
  if (n.includes('water') || n.includes('drink') || e.includes('💧') || e === 'water') return Droplets
  if (n.includes('sleep') || n.includes('rest') || n.includes('bed') || e.includes('🌙') || e === 'sleep') return Moon
  if (n.includes('heart') || n.includes('wellness') || e.includes('❤️') || e === 'wellness') return Heart
  if (n.includes('focus') || n.includes('brain') || e === 'focus') return Brain
  return Target
}

const COLORS = [
  '#8b5cf6', '#6366f1', '#0ea5e9', '#14b8a6',
  '#10b981', '#f59e0b', '#ef4444', '#ec4899',
]

const MILESTONES = [7, 30, 100]

const EMPTY_EXAMPLES = [
  'did gym today',
  'read 20 mins',
  'no sugar today',
]

function isoDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function prettyDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: parsed.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

function statusLabel(status: HabitStatus | null | undefined): string {
  if (status === 'done') return 'done'
  if (status === 'skipped') return 'skipped'
  return 'not logged'
}

function useLockBody(active: boolean) {
  useEffect(() => {
    if (!active) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [active])
}

// ── Progress ring ─────────────────────────────────────────────────────────────

function ProgressRing({
  value,
  target,
  size = 74,
  stroke = 7,
  color,
  reduced,
  children,
}: {
  value: number
  target: number
  size?: number
  stroke?: number
  color: string
  reduced: boolean
  children: React.ReactNode
}) {
  const safeTarget = Math.max(1, target)
  const ratio = Math.min(1, Math.max(0, value / safeTarget))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const complete = value >= safeTarget
  const low = !complete && value < safeTarget / 2
  const tone = complete ? '#22c55e' : low ? '#f59e0b' : color

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border/70"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - ratio) }}
          transition={
            reduced ? { duration: 0 } : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}

// ── Habit card ────────────────────────────────────────────────────────────────

function HabitTile({
  habit,
  reduced,
  onOpen,
  registerRef,
}: {
  habit: Habit
  reduced: boolean
  onOpen: () => void
  registerRef: (node: HTMLButtonElement | null) => void
}) {
  const complete = habit.completion_this_week >= habit.target_per_week
  const today = isoDate(new Date())

  return (
    <motion.button
      ref={registerRef}
      type="button"
      variants={itemEnter}
      whileHover={reduced ? undefined : { y: -3 }}
      whileTap={reduced ? undefined : { scale: 0.98 }}
      transition={spring.gentle}
      onClick={onOpen}
      aria-label={`Open ${habit.name} details`}
      className="group relative flex w-[140px] shrink-0 snap-start flex-col items-center gap-2 rounded-xl border border-border/60 bg-surface-1/60 p-3 text-center transition-colors hover:border-primary/30 hover:bg-surface-2/70"
    >
      {(() => {
        const Icon = getHabitIconComponent(habit.name, habit.emoji)
        return (
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition-transform duration-200 group-hover:scale-105"
            style={{
              backgroundColor: `${habit.color || 'hsl(var(--primary))'}18`,
              borderColor: `${habit.color || 'hsl(var(--primary))'}35`,
              color: habit.color || 'hsl(var(--primary))',
            }}
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
        )
      })()}
      <span className="w-full truncate text-[11px] font-medium text-muted-foreground">
        {titleCase(habit.name)}
      </span>

      <div className="relative">
        <ProgressRing
          value={habit.completion_this_week}
          target={habit.target_per_week}
          color={habit.color || 'hsl(var(--primary))'}
          reduced={reduced}
        >
          <span className="text-[13px] font-semibold tabular-nums text-foreground">
            {habit.completion_this_week}/{habit.target_per_week}
          </span>
          <span className="text-[8px] uppercase tracking-wide text-muted-foreground/50">
            this week
          </span>
        </ProgressRing>
        {complete && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-card">
            <Check className="h-2.5 w-2.5 stroke-[3]" />
          </span>
        )}
      </div>

      {habit.streak > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500 light:text-amber-700">
          <Flame className="h-2.5 w-2.5 fill-amber-500/30 text-amber-500" />
          {habit.streak}
        </span>
      ) : (
        <span className="text-[9px] text-muted-foreground/35">no streak</span>
      )}

      <div className="flex w-full items-center justify-center gap-1">
        {habit.last_7_days.map((day) => {
          const isToday = day.date === today
          const status = day.status
          return (
            <motion.span
              key={day.date}
              title={`${prettyDate(day.date)} — ${statusLabel(status)}`}
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                status === 'done'
                  ? 'bg-emerald-500'
                  : status === 'skipped'
                    ? 'bg-rose-500/80'
                    : 'bg-surface-3 ring-1 ring-inset ring-border/70',
                isToday && status === null && 'ring-primary/60'
              )}
              animate={
                isToday && status === null && !reduced
                  ? { opacity: [0.35, 1, 0.35], scale: [1, 1.3, 1] }
                  : undefined
              }
              transition={
                isToday && status === null && !reduced
                  ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                  : undefined
              }
            />
          )
        })}
      </div>
      <span className="sr-only">Last 7 days</span>
    </motion.button>
  )
}

// ── Add / edit dialog ────────────────────────────────────────────────────────

function HabitDialog({
  open,
  habit,
  onClose,
}: {
  open: boolean
  habit?: Habit
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const playChime = useSound('chime')
  const playThud = useSound('thud')
  const editing = Boolean(habit)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(HABIT_ICONS[0].id)
  const [color, setColor] = useState(COLORS[0])
  const [target, setTarget] = useState(7)
  const inputRef = useRef<HTMLInputElement>(null)

  useLockBody(open)

  useEffect(() => {
    if (!open) return
    setName(habit?.name ?? '')
    setEmoji(habit?.emoji ?? HABIT_ICONS[0].id)
    setColor(habit?.color ?? COLORS[0])
    setTarget(habit?.target_per_week ?? 7)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 140)
    return () => window.clearTimeout(timer)
    // Re-initialise only when the dialog opens or switches habit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, habit?.id])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const mutation = useMutation({
    mutationFn: () =>
      habit
        ? postHabitUpdate({
            id: habit.id,
            new_name: name.trim(),
            emoji,
            color,
            target_per_week: target,
          })
        : postHabitAdd({
            name: name.trim(),
            emoji,
            color,
            target_per_week: target,
          }),
    onSuccess: (result) => {
      playChime()
      toast.success(
        editing
          ? `Updated ${titleCase(result.habit.name)}`
          : `Added ${titleCase(result.habit.name)}`
      )
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      onClose()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not save habit')
    },
  })

  const submit = () => {
    if (!name.trim() || mutation.isPending) return
    mutation.mutate()
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
          <motion.button
            type="button"
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />

          <motion.form
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={spring.gentle}
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
            className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
              <div>
                <h3 className="text-[14px] font-semibold text-foreground">
                  {editing ? 'Edit habit' : 'New habit'}
                </h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                  {editing
                    ? 'Change the name, look, or weekly target.'
                    : 'Small, specific, repeatable — that is the trick.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
                  Name
                </span>
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="gym, reading, no sugar…"
                  maxLength={60}
                  className="h-10 w-full rounded-lg border border-border bg-surface-inset px-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/45 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <div>
                <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
                  Icon
                </span>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {HABIT_ICONS.map((option) => {
                    const OptionIcon = option.icon
                    const isSelected = emoji === option.id || emoji === option.label
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setEmoji(option.id)}
                        title={option.label}
                        className={cn(
                          'flex h-9 items-center justify-center rounded-lg border transition-all cursor-pointer',
                          isSelected
                            ? 'border-primary bg-primary/15 text-primary shadow-sm'
                            : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                        )}
                      >
                        <OptionIcon className="h-4 w-4" strokeWidth={2} />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
                  Colour
                </span>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setColor(option)}
                      aria-label={`Use colour ${option}`}
                      className={cn(
                        'h-7 w-7 rounded-full transition-transform',
                        color === option
                          ? 'scale-110 ring-2 ring-foreground/40 ring-offset-2 ring-offset-card'
                          : 'hover:scale-105'
                      )}
                      style={{ backgroundColor: option }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Target per week
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-foreground">
                    {target} {target === 1 ? 'day' : 'days'}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={7}
                  step={1}
                  value={target}
                  onChange={(event) => setTarget(Number(event.target.value))}
                  aria-label="Target per week"
                  className="habit-range w-full accent-primary"
                />
                <div className="mt-1 flex justify-between text-[9px] text-muted-foreground/40">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border/60 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="h-8 rounded-lg px-3 text-[12px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || mutation.isPending}
                className="h-8 rounded-lg bg-primary px-3.5 text-[12px] font-medium text-primary-foreground transition-opacity disabled:opacity-40"
              >
                {mutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add habit'}
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

// ── Heatmap ──────────────────────────────────────────────────────────────────

const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface CalendarSquare {
  date: string
  dayNumber: number
  monthShort: string
  isFirstOfMonth: boolean
  isToday: boolean
  isFuture: boolean
  isOutOfWindow: boolean
  status: HabitStatus | null
  fullDateLabel: string
}

function Heatmap({
  days,
  busy,
  onToggle,
}: {
  days: HabitDay[]
  busy: boolean
  onToggle: (date: string, next: HabitStatus | null) => void
}) {
  const [hovered, setHovered] = useState<CalendarSquare | null>(null)
  const todayDate = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => isoDate(todayDate), [todayDate])

  const map = useMemo(() => {
    const result = new Map<string, HabitStatus>()
    for (const day of days) {
      if (day.status) result.set(day.date, day.status)
    }
    return result
  }, [days])

  const { squares, doneCount, skippedCount, emptyCount } = useMemo(() => {
    const windowStart = addDays(todayDate, -29)
    const startWeekday = (windowStart.getDay() + 6) % 7 // 0=Mon, 6=Sun
    const gridStart = addDays(windowStart, -startWeekday)

    const todayWeekday = (todayDate.getDay() + 6) % 7
    const daysUntilSunday = 6 - todayWeekday
    const gridEnd = addDays(todayDate, daysUntilSunday)

    const totalDays =
      Math.round((gridEnd.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const list: CalendarSquare[] = []

    let done = 0
    let skipped = 0
    let empty = 0

    const windowStartNormalized = new Date(
      windowStart.getFullYear(),
      windowStart.getMonth(),
      windowStart.getDate()
    )

    for (let i = 0; i < totalDays; i++) {
      const current = addDays(gridStart, i)
      const dateString = isoDate(current)
      const isToday = dateString === todayStr
      const isFuture = dateString > todayStr
      const isOutOfWindow = current < windowStartNormalized

      const status = map.get(dateString) ?? null
      const isFirstOfMonth = current.getDate() === 1 || i === 0

      const fullDateLabel = current.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })

      const monthShort = current.toLocaleDateString('en-US', { month: 'short' })

      if (!isFuture && !isOutOfWindow) {
        if (status === 'done') done++
        else if (status === 'skipped') skipped++
        else empty++
      }

      list.push({
        date: dateString,
        dayNumber: current.getDate(),
        monthShort,
        isFirstOfMonth,
        isToday,
        isFuture,
        isOutOfWindow,
        status,
        fullDateLabel,
      })
    }

    return {
      squares: list,
      doneCount: done,
      skippedCount: skipped,
      emptyCount: empty,
    }
  }, [todayDate, todayStr, map])

  const activeDisplay =
    hovered ?? squares.find((s) => s.isToday) ?? squares[squares.length - 1]

  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-border/60 bg-surface-1/40 p-3">
        {/* Weekday headers */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS_SHORT.map((day) => (
            <div
              key={day}
              className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60"
            >
              {day}
            </div>
          ))}
        </div>

        {/* 7-column calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {squares.map((square) => {
            if (square.isOutOfWindow) {
              return (
                <div
                  key={square.date}
                  className="flex h-11 flex-col items-center justify-between rounded-lg border border-transparent p-1 opacity-20 pointer-events-none"
                >
                  <span className="text-[10px] text-muted-foreground/30">
                    {square.dayNumber}
                  </span>
                </div>
              )
            }

            if (square.isFuture) {
              return (
                <div
                  key={square.date}
                  className="flex h-11 flex-col items-center justify-between rounded-lg border border-dashed border-border/30 bg-surface-2/20 p-1 opacity-30 pointer-events-none"
                >
                  <span className="text-[10px] text-muted-foreground/40">
                    {square.dayNumber}
                  </span>
                </div>
              )
            }

            const next: HabitStatus | null =
              square.status === 'done'
                ? 'skipped'
                : square.status === 'skipped'
                  ? null
                  : 'done'

            return (
              <button
                key={square.date}
                type="button"
                disabled={busy}
                onClick={() => onToggle(square.date, next)}
                onMouseEnter={() => setHovered(square)}
                onMouseLeave={() => setHovered(null)}
                aria-label={`${square.fullDateLabel}: ${statusLabel(square.status)}`}
                className={cn(
                  'group relative flex h-11 cursor-pointer flex-col items-center justify-between rounded-lg border p-1 transition-all duration-150',
                  'hover:scale-105 active:scale-95 disabled:opacity-50',
                  square.status === 'done'
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 light:text-emerald-700'
                    : square.status === 'skipped'
                      ? 'border-rose-500/40 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 light:text-rose-600'
                      : 'border-border/60 bg-surface-2/50 text-foreground/80 hover:border-border hover:bg-surface-2',
                  square.isToday &&
                    'border-primary/50 font-bold ring-2 ring-primary ring-offset-2 ring-offset-card'
                )}
              >
                {/* Top: Day number & Month tag */}
                <div className="flex w-full items-center justify-between px-0.5 leading-none">
                  <span
                    className={cn(
                      'text-[10px] font-medium leading-none',
                      square.isToday
                        ? 'font-bold text-primary'
                        : 'text-muted-foreground/80'
                    )}
                  >
                    {square.dayNumber}
                  </span>
                  {square.isFirstOfMonth ? (
                    <span className="text-[8px] font-bold uppercase tracking-wider text-primary/80">
                      {square.monthShort}
                    </span>
                  ) : square.isToday ? (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-primary"
                      title="Today"
                    />
                  ) : null}
                </div>

                {/* Bottom: Status Icon or neutral dot */}
                <div className="flex items-center justify-center">
                  {square.status === 'done' && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500 light:text-emerald-700">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  )}
                  {square.status === 'skipped' && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500/20 text-rose-500 light:text-rose-600">
                      <X className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  )}
                  {square.status === null && (
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/25 transition-colors group-hover:bg-muted-foreground/50" />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Hover / Active Date Status Banner */}
        <div className="mt-3 flex items-center justify-between rounded-lg border border-border/50 bg-surface-inset px-2.5 py-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="text-muted-foreground">Date:</span>
            <span>{activeDisplay?.fullDateLabel}</span>
            {activeDisplay?.isToday && (
              <span className="rounded bg-primary/15 px-1 py-0.5 text-[9px] font-semibold text-primary">
                Today
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Status:</span>
            <span
              className={cn(
                'font-semibold capitalize',
                activeDisplay?.status === 'done'
                  ? 'text-emerald-500 light:text-emerald-700'
                  : activeDisplay?.status === 'skipped'
                    ? 'text-rose-400 light:text-rose-600'
                    : 'text-muted-foreground/60'
              )}
            >
              {statusLabel(activeDisplay?.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Legend & Stats Summary */}
      <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground/60">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-foreground">{doneCount}</span> done
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="font-medium text-foreground">{skippedCount}</span> skipped
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            <span className="font-medium text-foreground">{emptyCount}</span> no entry
          </span>
        </div>
        <span className="text-[9.5px] italic text-muted-foreground/45">
          click cell to cycle
        </span>
      </div>
    </div>
  )
}

// ── Detail drawer ────────────────────────────────────────────────────────────

function HabitDrawer({
  habit,
  insights,
  suspended,
  onClose,
  onEdit,
  getOrigin,
}: {
  habit: Habit
  insights: HabitInsight[]
  suspended: boolean
  onClose: () => void
  onEdit: () => void
  getOrigin: () => { x: number; y: number } | undefined
}) {
  const queryClient = useQueryClient()
  const reduced = useReducedMotion()
  const playThud = useSound('thud')
  const playClick = useSound('click')
  const [confirmArchive, setConfirmArchive] = useState(false)

  useLockBody(true)

  const detail = useQuery({
    queryKey: ['habits', habit.id, 'detail'],
    queryFn: () => fetchHabit(habit.name),
  })

  useEffect(() => {
    if (suspended) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, suspended])

  const monthTarget = 30
  const monthDone = Math.min(habit.completion_this_month, monthTarget)
  const monthPercent = Math.round((monthDone / monthTarget) * 100)
  const todayStatus = habit.today_status
  const habitInsights = insights.filter(
    (insight) =>
      insight.habit_id === habit.id ||
      insight.habit_name.toLowerCase() === habit.name.toLowerCase()
  )

  const log = useMutation({
    mutationFn: ({ status, date }: { status: HabitStatus; date?: string }) =>
      postHabitLog({
        id: habit.id,
        date: date ?? 'today',
        status,
      }),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      if (variables.status === 'done') {
        const milestone = MILESTONES.includes(result.streak)
        if (milestone) {
          celebrateHabitMilestone(getOrigin(), habit.color)
          toast.success(
            `🔥 ${result.streak}-day streak on ${titleCase(habit.name)}!`,
            { duration: 5000 }
          )
        } else {
          celebrateHabitLog(getOrigin(), habit.color)
          toast.success(`Logged ${titleCase(habit.name)} for ${variables.date ? prettyDate(variables.date) : 'today'}`)
        }
      } else {
        playThud()
        toast(`Skipped ${titleCase(habit.name)} — tomorrow is a fresh start.`)
      }
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not log habit')
    },
  })

  const clear = useMutation({
    mutationFn: (date: string) => postHabitClear({ id: habit.id, date }),
    onSuccess: () => {
      playClick()
      queryClient.invalidateQueries({ queryKey: ['habits'] })
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not update habit')
    },
  })

  const archive = useMutation({
    mutationFn: () => postHabitArchive({ id: habit.id }),
    onSuccess: () => {
      playClick()
      toast.success(`Archived ${titleCase(habit.name)}`)
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      onClose()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not archive habit')
    },
  })

  const busy = log.isPending || clear.isPending
  const toggleDay = (date: string, next: HabitStatus | null) => {
    if (next) log.mutate({ status: next, date })
    else clear.mutate(date)
  }

  const logToday = (status: HabitStatus) => {
    if (todayStatus === status) return
    log.mutate({ status })
  }

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <motion.button
        type="button"
        aria-label="Close habit details"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
      />

      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={reduced ? { duration: 0 } : spring.gentle}
        className="absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col border-l border-border bg-card shadow-2xl"
      >
        <div className="flex shrink-0 items-start gap-2 border-b border-border/60 px-5 py-4">
          {(() => {
            const Icon = getHabitIconComponent(habit.name, habit.emoji)
            return (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                style={{
                  backgroundColor: `${habit.color || 'hsl(var(--primary))'}20`,
                  borderColor: `${habit.color || 'hsl(var(--primary))'}40`,
                  color: habit.color || 'hsl(var(--primary))',
                }}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
            )
          })()}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold text-foreground">
              {titleCase(habit.name)}
            </h2>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground/55">
              {habit.target_per_week}× per week target
            </p>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit habit"
              title="Edit habit"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmArchive((current) => !current)}
              aria-label={confirmArchive ? 'Confirm archive' : 'Archive habit'}
              title={confirmArchive ? 'Click again to archive' : 'Archive habit'}
              className={cn(
                'flex h-7 items-center justify-center rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground',
                confirmArchive && 'w-auto gap-1 text-rose-400 light:text-rose-600'
              )}
            >
              <Archive className="h-3.5 w-3.5" />
              {confirmArchive && (
                <span className="text-[9px] font-semibold">Sure?</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmArchive) archive.mutate()
                else onClose()
              }}
              onMouseLeave={() => setConfirmArchive(false)}
              aria-label={confirmArchive ? 'Confirm archive' : 'Close'}
              title={confirmArchive ? 'Confirm archive' : 'Close'}
              className={cn(
                'flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground',
                confirmArchive && 'bg-rose-500/10 text-rose-400 light:text-rose-600'
              )}
            >
              {confirmArchive ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* This month */}
          <section className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-surface-1/50 p-4">
            <ProgressRing
              value={monthDone}
              target={monthTarget}
              size={140}
              stroke={11}
              color={habit.color || 'hsl(var(--primary))'}
              reduced={reduced}
            >
              <span className="text-[26px] font-semibold tabular-nums leading-none text-foreground">
                {monthPercent}%
              </span>
              <span className="mt-1 text-[9px] uppercase tracking-[0.16em] text-muted-foreground/50">
                last 30 days
              </span>
            </ProgressRing>
            <p className="text-[11.5px] text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {monthDone}
              </span>{' '}
              / {monthTarget} days · {monthPercent}%
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              🔥 Current:{' '}
              <span className="font-semibold tabular-nums text-foreground">
                {habit.streak}
              </span>{' '}
              {habit.streak === 1 ? 'day' : 'days'} · Longest:{' '}
              <span className="font-semibold tabular-nums text-foreground">
                {habit.longest_streak}
              </span>{' '}
              {habit.longest_streak === 1 ? 'day' : 'days'}
            </p>
          </section>

          {/* Heatmap */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                Last 30 days
              </h3>
              <span className="text-[9.5px] text-muted-foreground/40">
                calendar view · click to toggle
              </span>
            </div>
            <Heatmap
              days={detail.data?.logs ?? habit.logs ?? []}
              busy={busy}
              onToggle={toggleDay}
            />
            {!detail.isLoading && (detail.data?.logs?.length ?? 0) === 0 && (
              <p className="mt-2 text-[10.5px] text-muted-foreground/45">
                No data yet for this habit — click today to start your streak.
              </p>
            )}
          </section>

          {/* Today */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
              Today
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => logToday('done')}
                className={cn(
                  'flex h-10 items-center justify-center gap-1.5 rounded-lg border text-[12px] font-medium transition-colors disabled:opacity-50',
                  todayStatus === 'done'
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-500 light:text-emerald-700'
                    : 'border-border/60 bg-surface-1 text-muted-foreground hover:border-emerald-500/40 hover:text-foreground'
                )}
              >
                <Check className="h-3.5 w-3.5" /> Did it
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => logToday('skipped')}
                className={cn(
                  'flex h-10 items-center justify-center gap-1.5 rounded-lg border text-[12px] font-medium transition-colors disabled:opacity-50',
                  todayStatus === 'skipped'
                    ? 'border-rose-500/50 bg-rose-500/15 text-rose-400 light:text-rose-600'
                    : 'border-border/60 bg-surface-1 text-muted-foreground hover:border-rose-500/40 hover:text-foreground'
                )}
              >
                <X className="h-3.5 w-3.5" /> Skipped
              </button>
              <button
                type="button"
                disabled={busy || todayStatus === null}
                onClick={() => clear.mutate('today')}
                className={cn(
                  'flex h-10 items-center justify-center gap-1.5 rounded-lg border text-[12px] font-medium transition-colors disabled:opacity-50',
                  todayStatus === null
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/60 bg-surface-1 text-muted-foreground hover:text-foreground'
                )}
              >
                — Not yet
              </button>
            </div>
          </section>

          {/* Insights */}
          {habitInsights.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                What I noticed
              </h3>
              <div className="space-y-1.5">
                {habitInsights.map((insight) => (
                  <div
                    key={`${insight.kind}-${insight.message}`}
                    className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2.5"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <p className="text-[11.5px] leading-relaxed text-foreground/85">
                      {insight.message}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="shrink-0 border-t border-border/60 px-5 py-3">
          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
            <Flame className="h-3 w-3" />
            Every log is stored locally and refreshes your dashboard.
          </p>
        </div>
      </motion.aside>
    </div>,
    document.body
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

export default function HabitsCard() {
  const queryClient = useQueryClient()
  const reduced = useReducedMotion()
  const playChime = useSound('chime')
  const playThud = useSound('thud')
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['habits'],
    queryFn: fetchHabits,
    refetchInterval: 30_000,
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [inlineName, setInlineName] = useState('')
  const [inlineEmoji, setInlineEmoji] = useState('🎯')
  const cardRefs = useRef(new Map<number, HTMLButtonElement>())

  const habits = data?.habits ?? []
  const insights = data?.insights ?? []
  const selected = habits.find((habit) => habit.id === selectedId) ?? null

  useEffect(() => {
    if (selectedId !== null && !selected && !isLoading) setSelectedId(null)
  }, [selectedId, selected, isLoading])

  const inlineAdd = useMutation({
    mutationFn: () =>
      postHabitAdd({ name: inlineName.trim(), emoji: inlineEmoji }),
    onSuccess: (result) => {
      playChime()
      toast.success(`Added ${titleCase(result.habit.name)}`)
      setInlineName('')
      queryClient.invalidateQueries({ queryKey: ['habits'] })
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not add habit')
    },
  })

  const originFor = (habitId: number) => {
    const element = cardRefs.current.get(habitId)
    if (!element) return undefined
    const rect = element.getBoundingClientRect()
    return {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    }
  }

  return (
    <>
      <MotionCard className="h-full overflow-hidden">
        <CardHeading
          icon={Target}
          title="Habits"
          subtitle={
            habits.length > 0
              ? `${habits.length} tracked · ${insights.length} noticed`
              : 'small daily wins'
          }
          action={
            <button
              type="button"
              onClick={() => {
                setEditHabit(null)
                setDialogOpen(true)
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border/70 bg-surface-1 px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/[0.06] hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> Add habit
            </button>
          }
        />

        <div className="px-5 pb-5 pt-4">
          {isLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="skeleton-shimmer h-[158px] w-[140px] shrink-0 rounded-xl border border-border/40"
                />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                Could not load habits.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          ) : habits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-surface-1/40 px-4 py-6">
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-1">
                  <Target className="h-5 w-5" />
                </div>
                <p className="text-[13px] font-medium text-foreground">
                  No habits tracked yet.
                </p>
                <p className="max-w-[44ch] text-[11.5px] leading-relaxed text-muted-foreground/60">
                  Type in the Ask bar to log one, or add it below.
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {EMPTY_EXAMPLES.map((example) => (
                    <span
                      key={example}
                      className="rounded-full border border-border/70 bg-surface-2 px-2.5 py-1 text-[10px] text-muted-foreground"
                    >
                      “{example}”
                    </span>
                  ))}
                </div>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  if (inlineName.trim() && !inlineAdd.isPending) {
                    inlineAdd.mutate()
                  }
                }}
                className="mx-auto mt-4 flex max-w-lg flex-col gap-2 sm:flex-row sm:items-center"
              >
                <div className="flex flex-wrap gap-1">
                  {HABIT_ICONS.slice(0, 6).map((option) => {
                    const OptionIcon = option.icon
                    const isSelected = inlineEmoji === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setInlineEmoji(option.id)}
                        title={option.label}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors cursor-pointer',
                          isSelected
                            ? 'border-primary/50 bg-primary/15 text-primary'
                            : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2'
                        )}
                      >
                        <OptionIcon className="h-3.5 w-3.5" />
                      </button>
                    )
                  })}
                </div>
                <input
                  value={inlineName}
                  onChange={(event) => setInlineName(event.target.value)}
                  placeholder="Name a habit…"
                  aria-label="Habit name"
                  maxLength={60}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface-inset px-3 text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground/45 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                />
                <button
                  type="submit"
                  disabled={!inlineName.trim() || inlineAdd.isPending}
                  className="h-9 shrink-0 rounded-lg bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-opacity disabled:opacity-40"
                >
                  {inlineAdd.isPending ? 'Adding…' : 'Add'}
                </button>
              </form>
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial={reduced ? false : 'hidden'}
              animate="show"
              className="flex snap-x gap-3 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible"
            >
              {habits.map((habit) => (
                <HabitTile
                  key={habit.id}
                  habit={habit}
                  reduced={reduced}
                  onOpen={() => setSelectedId(habit.id)}
                  registerRef={(node) => {
                    if (node) cardRefs.current.set(habit.id, node)
                    else cardRefs.current.delete(habit.id)
                  }}
                />
              ))}
            </motion.div>
          )}

          {insights.length > 0 && (
            <div className="mt-4 border-t border-border/50 pt-3">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/50">
                  What I noticed
                </p>
              </div>
              <div className="space-y-1.5">
                {insights.map((insight) => (
                  <p
                    key={`${insight.habit_id}-${insight.kind}-${insight.message}`}
                    className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500/80" />
                    {insight.message}
                    <span className="ml-auto shrink-0 text-[9px] tabular-nums text-muted-foreground/35">
                      {insight.data_points} pts
                    </span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </MotionCard>

      <HabitDialog
        open={dialogOpen}
        habit={editHabit ?? undefined}
        onClose={() => {
          setDialogOpen(false)
          setEditHabit(null)
        }}
      />

      <AnimatePresence>
        {selected && (
          <HabitDrawer
            key={selected.id}
            habit={selected}
            insights={insights}
            suspended={dialogOpen && Boolean(editHabit)}
            onClose={() => setSelectedId(null)}
            onEdit={() => {
              setEditHabit(selected)
              setDialogOpen(true)
            }}
            getOrigin={() => originFor(selected.id)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
