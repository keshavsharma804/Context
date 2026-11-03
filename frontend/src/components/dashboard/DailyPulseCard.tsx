import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import {
  Sparkles,
  Flame,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Zap,
  Target,
  Activity,
  Moon,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { fetchJournal, postJournalSave, type MoodDay } from '@/lib/api'
import { MotionCard } from './MotionCard'
import CardHeading from './CardHeading'
import { useSound } from '@/hooks/useSound'
import { cn } from '@/lib/utils'

interface MentalState {
  val: number
  label: string
  subtitle: string
  icon: LucideIcon
  colorClass: string
  bgSelected: string
  borderSelected: string
  dotColor: string
}

const STATES: MentalState[] = [
  {
    val: 5,
    label: 'Optimal',
    subtitle: 'High energy & clarity',
    icon: Zap,
    colorClass: 'text-emerald-400',
    bgSelected: 'bg-emerald-500/10',
    borderSelected: 'border-emerald-500/50 shadow-[0_0_16px_rgba(16,185,129,0.2)]',
    dotColor: 'bg-emerald-400',
  },
  {
    val: 4,
    label: 'Focused',
    subtitle: 'Clear & productive',
    icon: Target,
    colorClass: 'text-blue-400',
    bgSelected: 'bg-blue-500/10',
    borderSelected: 'border-blue-500/50 shadow-[0_0_16px_rgba(59,130,246,0.2)]',
    dotColor: 'bg-blue-400',
  },
  {
    val: 3,
    label: 'Steady',
    subtitle: 'Balanced baseline',
    icon: Activity,
    colorClass: 'text-amber-400',
    bgSelected: 'bg-amber-500/10',
    borderSelected: 'border-amber-500/50 shadow-[0_0_16px_rgba(245,158,11,0.2)]',
    dotColor: 'bg-amber-400',
  },
  {
    val: 2,
    label: 'Low Energy',
    subtitle: 'Tired or slowed',
    icon: Moon,
    colorClass: 'text-purple-400',
    bgSelected: 'bg-purple-500/10',
    borderSelected: 'border-purple-500/50 shadow-[0_0_16px_rgba(168,85,247,0.2)]',
    dotColor: 'bg-purple-400',
  },
  {
    val: 1,
    label: 'Drained',
    subtitle: 'Needs recovery',
    icon: AlertCircle,
    colorClass: 'text-rose-400',
    bgSelected: 'bg-rose-500/10',
    borderSelected: 'border-rose-500/50 shadow-[0_0_16px_rgba(244,63,94,0.2)]',
    dotColor: 'bg-rose-400',
  },
]

export function DailyPulseCard({ className }: { className?: string }) {
  const queryClient = useQueryClient()
  const playPop = useSound('pop')
  const playChime = useSound('chime')

  const { data } = useQuery({
    queryKey: ['journal', 7],
    queryFn: () => fetchJournal(7),
    staleTime: 60_000,
  })

  const todayIso = new Date().toISOString().slice(0, 10)
  const todayEntry = data?.entries?.find((e) => e.date === todayIso)
  const [selectedMood, setSelectedMood] = useState<number | null>(
    todayEntry?.mood ?? null
  )

  const matrix = data?.matrix?.matrix ?? []
  const last7Days = matrix.slice(-7)
  const streak = data?.matrix?.streak ?? 0

  const saveMood = useMutation({
    mutationFn: (mood: number) => postJournalSave({ date: todayIso, mood }),
    onSuccess: (_, mood) => {
      setSelectedMood(mood)
      playChime()
      toast.success('Rhythm recorded for today')
      queryClient.invalidateQueries({ queryKey: ['journal'] })
    },
    onError: () => {
      toast.error('Could not save entry')
    },
  })

  const currentMood = selectedMood ?? todayEntry?.mood ?? null

  return (
    <MotionCard className={cn('relative overflow-hidden', className)}>
      <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <CardHeading
        icon={Activity}
        title="Daily Rhythm & Energy"
        subtitle="One-tap check-in for your mental baseline"
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 light:text-amber-700">
              <Flame className="h-3 w-3 text-amber-400 fill-amber-400/40" />
              {streak}d Streak
            </span>
            <Link
              to="/journal"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Journal
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        }
      />

      <div className="p-5 pt-3 space-y-4">
        {/* Rating Pills */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground/70">
              Current Mental State
            </span>
            {currentMood && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Logged for today
              </span>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2">
            {STATES.map((s) => {
              const isSelected = currentMood === s.val
              const Icon = s.icon
              return (
                <button
                  key={s.val}
                  type="button"
                  onClick={() => {
                    playPop()
                    setSelectedMood(s.val)
                    saveMood.mutate(s.val)
                  }}
                  className={cn(
                    'group relative flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all duration-200 cursor-pointer',
                    isSelected
                      ? cn('ring-1 ring-inset ring-primary/30', s.bgSelected, s.borderSelected)
                      : 'border-border/60 bg-surface-1 hover:border-border hover:bg-surface-2'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-surface-2 transition-transform duration-200 group-hover:scale-105',
                      isSelected ? s.colorClass : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <span
                    className={cn(
                      'mt-1.5 text-[11px] font-semibold tracking-tight text-center truncate w-full',
                      isSelected ? 'text-foreground font-bold' : 'text-muted-foreground/80'
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 7-day Minimalist Status Pip Strip */}
        <div className="rounded-xl border border-border/60 bg-surface-1/50 p-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
            <span className="font-semibold text-foreground/80">7-Day Trailing Baseline</span>
            <Link
              to="/review"
              className="text-primary hover:underline inline-flex items-center gap-1 text-[11px]"
            >
              <Sparkles className="h-3 w-3" />
              Weekly Retrospective
            </Link>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {last7Days.map((day: MoodDay) => {
              const dateObj = new Date(day.date)
              const dayName = isNaN(dateObj.getTime())
                ? day.day_of_week.slice(0, 2)
                : dateObj.toLocaleDateString('en-US', { weekday: 'narrow' })
              const isToday = day.date === todayIso
              const hasMood = day.mood !== null

              const stateObj = STATES.find((st) => st.val === day.mood)

              return (
                <div
                  key={day.date}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border py-2 px-1 transition-all',
                    isToday
                      ? 'border-primary/50 bg-primary/[0.08] shadow-sm'
                      : 'border-border/40 bg-surface-2/40'
                  )}
                  title={`${day.date}: ${stateObj?.label || 'No entry'}`}
                >
                  <span className="text-[9px] uppercase font-bold text-muted-foreground/60 mb-1.5">
                    {dayName}
                  </span>
                  <div className="h-4 flex items-center justify-center">
                    {hasMood && stateObj ? (
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full shadow-sm',
                          stateObj.dotColor
                        )}
                      />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/25" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </MotionCard>
  )
}
