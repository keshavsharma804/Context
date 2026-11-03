import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  FileText,
  Globe,
  HandCoins,
  History,
  Lock,
  PiggyBank,
  RefreshCw,
  Repeat,
  Search,
  Sparkles,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  fetchConfig,
  fetchHome,
  type FileRow,
  type HistoryRow,
  type HomeData,
} from '@/lib/api'
import { currencySymbol, money, relativeTime } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useProfile } from '@/hooks/useProfile'
import { useVault } from '@/store/vault'
import { MotionCard } from '@/components/dashboard/MotionCard'
import CardHeading from '@/components/dashboard/CardHeading'
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton'
import { gridVariants } from '@/components/dashboard/motion'
import AskHero from '@/components/dashboard/AskHero'
import ChronosphereHero from '@/components/dashboard/ChronosphereHero'
import { MoneyCard } from '@/components/dashboard/MoneyCard'
import { DailyPulseCard } from '@/components/dashboard/DailyPulseCard'
import { FinancialPulseCard } from '@/components/dashboard/FinancialPulseCard'
import { CountUp } from '@/components/motion/CountUp'
import { Typewriter } from '@/components/motion/Typewriter'
import { PulseDot } from '@/components/motion/PulseDot'
import { useConnectionCelebration } from '@/hooks/useConnectionCelebration'
import { useSound } from '@/hooks/useSound'

function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function StatPill({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon
  value: number
  label: string
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-1 py-1 pl-2.5 pr-3 transition-colors hover:border-primary/25 hover:bg-primary/[0.04]">
      <Icon className="h-3 w-3 text-primary/70" strokeWidth={1.8} />
      <span className="text-[11px] font-medium tabular-nums text-foreground/80">
        <CountUp value={value} duration={0.9} />
      </span>
      <span className="text-[10px] text-muted-foreground/60">{label}</span>
    </div>
  )
}

/** Time-aware greeting; types once per session and cross-fades at boundaries. */
function Greeting() {
  const { name } = useProfile()
  const [now, setNow] = useState(() => new Date())
  const [typeOnce, setTypeOnce] = useState(() => {
    try {
      return !sessionStorage.getItem('context:greeted')
    } catch {
      return true
    }
  })

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem('context:greeted', '1')
    } catch {
      // storage unavailable
    }
    const stopTyping = window.setTimeout(() => setTypeOnce(false), 900)
    return () => window.clearTimeout(stopTyping)
  }, [])

  const displayName = name.trim()
  const text = displayName ? `${greeting(now)}, ${displayName}` : greeting(now)

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.h1
        key={text}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="mt-1.5 text-3xl font-semibold tracking-tight text-foreground"
      >
        <Typewriter text={text} enabled={typeOnce} duration={600} />
        <span className="text-primary">.</span>
      </motion.h1>
    </AnimatePresence>
  )
}

/** Rotating, context-aware status line under the greeting. */
function ContextSubline({ data, symbol }: { data?: HomeData; symbol: string }) {
  const [index, setIndex] = useState(0)

  const lines = useMemo(() => {
    const next: string[] = []
    const today = data?.cal?.today ?? []
    if (today.length > 0) {
      const first = [...today].sort((a, b) => a.start_at.localeCompare(b.start_at))[0]
      const parsed = new Date(first.start_at)
      const time = Number.isNaN(parsed.getTime())
        ? null
        : parsed.toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
          })
      next.push(
        `${today.length} event${today.length === 1 ? '' : 's'} today.${
          time ? ` First at ${time}.` : ''
        }`
      )
    }

    const patterns = data?.patterns?.count ?? 0
    if (patterns > 0) {
      next.push(`${patterns} thing${patterns === 1 ? '' : 's'} worth your attention.`)
    }

    const spent = data?.spend?.week_total ?? 0
    if (spent > 0) next.push(`${money(spent, symbol)} spent this week.`)

    const waiting = data?.gmail?.unanswered?.length ?? 0
    if (waiting > 0) {
      next.push(`${waiting} email${waiting === 1 ? '' : 's'} waiting on you.`)
    }

    if (next.length === 0) next.push("Everything's calm today.")
    return next
  }, [data, symbol])

  useEffect(() => {
    setIndex(0)
  }, [lines.length])

  useEffect(() => {
    if (lines.length <= 1) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % lines.length)
    }, 8000)
    return () => window.clearInterval(timer)
  }, [lines])

  const line = lines[index % lines.length]

  return (
    <div className="relative mt-1.5 min-h-[20px]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={line}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="text-[13px] text-muted-foreground"
        >
          {line}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

function FirstVisitLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="flex items-end gap-1.5">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-primary"
            animate={{ y: [0, -7, 0], opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: index * 0.14,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50">
        Waking up your context
      </p>
    </div>
  )
}

function SearchResultsCard({
  q,
  files,
  history,
  onClear,
}: {
  q: string
  files: FileRow[]
  history: HistoryRow[]
  onClear: () => void
}) {
  const total = files.length + history.length

  return (
    <MotionCard className="lg:col-span-2">
      <CardHeading
        icon={Search}
        title={`Results for “${q}”`}
        subtitle={`${total} match${total === 1 ? '' : 'es'} across files and pages`}
        action={
          <Button variant="ghost" size="xs" onClick={onClear} className="gap-1">
            <X className="h-3 w-3" />
            Clear
          </Button>
        }
      />

      {total === 0 ? (
        <p className="px-5 pb-5 pt-4 text-xs text-muted-foreground">
          Nothing matched. Try a broader phrase.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 px-5 pb-5 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground/40">
              Files
            </p>
            <ul className="space-y-0.5">
              {files.slice(0, 4).map((file) => (
                <li
                  key={file.path}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-surface-2"
                >
                  <FileText className="h-3 w-3 shrink-0 text-amber-400 light:text-amber-700" />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/80">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-[9px] capitalize text-muted-foreground/40">
                    {file.category}
                  </span>
                </li>
              ))}
              {files.length === 0 && (
                <li className="px-1.5 py-1.5 text-[11px] text-muted-foreground/40">
                  No file matches
                </li>
              )}
            </ul>
          </div>

          <div>
            <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground/40">
              Pages
            </p>
            <ul className="space-y-0.5">
              {history.slice(0, 4).map((page) => (
                <li key={page.url}>
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noreferrer"
                    className="link-underline group flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-surface-2"
                  >
                    <Globe className="h-3 w-3 shrink-0 text-blue-400 light:text-blue-700" />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/80">
                      {page.title || page.url}
                    </span>
                    <ArrowUpRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground/30 group-hover:text-primary" />
                  </a>
                </li>
              ))}
              {history.length === 0 && (
                <li className="px-1.5 py-1.5 text-[11px] text-muted-foreground/40">
                  No page matches
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </MotionCard>
  )
}

function BentoQuickNav() {
  const { unlocked } = useVault()
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.3 }}
      className="mt-5 flex flex-wrap items-center gap-2"
    >
      <Link
        to="/vault"
        className="group inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-foreground/85 transition-all hover:border-primary/50 hover:bg-card hover:shadow-sm"
      >
        <div className="flex items-center justify-center h-5 w-5 rounded-lg bg-primary/10 text-primary">
          <Lock className="h-3 w-3" />
        </div>
        <span>Vault</span>
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 rounded-full',
            unlocked ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-muted-foreground/40'
          )}
        />
      </Link>

      <Link
        to="/journal"
        className="group inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-foreground/85 transition-all hover:border-blue-500/50 hover:bg-card hover:shadow-sm"
      >
        <div className="flex items-center justify-center h-5 w-5 rounded-lg bg-blue-500/10 text-blue-400">
          <BookOpen className="h-3 w-3" />
        </div>
        <span>Journal & Mood</span>
      </Link>

      <Link
        to="/subscriptions"
        className="group inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-foreground/85 transition-all hover:border-indigo-500/50 hover:bg-card hover:shadow-sm"
      >
        <div className="flex items-center justify-center h-5 w-5 rounded-lg bg-indigo-500/10 text-indigo-400">
          <Repeat className="h-3 w-3" />
        </div>
        <span>Subscriptions</span>
      </Link>

      <Link
        to="/debts"
        className="group inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-foreground/85 transition-all hover:border-emerald-500/50 hover:bg-card hover:shadow-sm"
      >
        <div className="flex items-center justify-center h-5 w-5 rounded-lg bg-emerald-500/10 text-emerald-400">
          <HandCoins className="h-3 w-3" />
        </div>
        <span>Debts & IOUs</span>
      </Link>

      <Link
        to="/savings"
        className="group inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-foreground/85 transition-all hover:border-amber-500/50 hover:bg-card hover:shadow-sm"
      >
        <div className="flex items-center justify-center h-5 w-5 rounded-lg bg-amber-500/10 text-amber-400">
          <PiggyBank className="h-3 w-3" />
        </div>
        <span>Savings Pots</span>
      </Link>

      <Link
        to="/review"
        className="group inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-foreground/85 transition-all hover:border-purple-500/50 hover:bg-card hover:shadow-sm"
      >
        <div className="flex items-center justify-center h-5 w-5 rounded-lg bg-purple-500/10 text-purple-400">
          <Sparkles className="h-3 w-3" />
        </div>
        <span>Weekly Review</span>
      </Link>
    </motion.div>
  )
}

export default function Dashboard({ preview = false }: { preview?: boolean }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q')?.trim() ?? ''
  const [firstVisit] = useState(() => {
    try {
      return !localStorage.getItem('context:visited')
    } catch {
      return false
    }
  })
  const playThud = useSound('thud')
  const { name: profileName } = useProfile()
  const markedVisited = useRef(false)

  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } =
    useQuery({
      queryKey: ['home', q],
      queryFn: () => fetchHome(q),
      enabled: !preview,
      refetchInterval: 60_000,
    })

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
    enabled: !preview,
    refetchInterval: 60_000,
  })

  useConnectionCelebration(config)

  useEffect(() => {
    if (data && !markedVisited.current) {
      markedVisited.current = true
      try {
        localStorage.setItem('context:visited', '1')
      } catch {
        // storage unavailable
      }
    }
  }, [data])

  useEffect(() => {
    if (isError) playThud()
  }, [isError, playThud])

  if (isLoading && !firstVisit) return <DashboardSkeleton />

  if (!preview && (isError || (!data && !isLoading))) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-400 light:text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-foreground">
            Couldn&apos;t reach your context
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {error instanceof Error
              ? error.message
              : 'Start the backend with python app.py, then try again.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            sound="thud"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-1 gap-1.5"
          >
            <RefreshCw
              className={cn('h-3 w-3', isFetching && 'animate-spin')}
            />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const symbol = currencySymbol(config?.symbol)
  const counts = data?.counts ?? {}

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8"
      onClickCapture={preview ? event => {
        if ((event.target as HTMLElement).closest('button, input, textarea, select')) {
          event.preventDefault(); event.stopPropagation(); navigate('/auth');
        }
      } : undefined}
      onSubmitCapture={preview ? event => { event.preventDefault(); event.stopPropagation(); navigate('/auth'); } : undefined}>
      {/* The Chronosphere: Planetary Horizon & Live Atmosphere Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mb-5"
      >
        <ChronosphereHero userName={profileName} />
      </motion.div>

      {/* Subline status & Activity Counts */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
        <ContextSubline data={data} symbol={symbol} />

        <div className="flex flex-wrap items-center gap-1.5">
          <StatPill icon={FileText} value={counts.files ?? 0} label="files" />
          <StatPill
            icon={History}
            value={counts.history ?? 0}
            label="pages"
          />
        </div>
      </div>

      <BentoQuickNav />

      {isLoading && firstVisit ? (
        <FirstVisitLoader />
      ) : (
        <>
          {/* Bento Command Center Grid */}
          <motion.div
            variants={gridVariants}
            initial="hidden"
            animate="show"
            className="mt-6 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2"
          >
            {q && data && (
              <SearchResultsCard
                q={q}
                files={data.files ?? []}
                history={data.history ?? []}
                onClear={() => setSearchParams({})}
              />
            )}

            {/* Omni AI Search Hero */}
            <AskHero
              hasGroq={data?.has_groq ?? false}
              className="lg:col-span-2"
            />

            {/* Daily Momentum & Financial Pulse Bento Row */}
            <DailyPulseCard className="lg:col-span-1" />
            <FinancialPulseCard symbol={symbol} className="lg:col-span-1" />

            {/* Spending */}
            <div className="lg:col-span-2">
              <MoneyCard spend={data?.spend} symbol={symbol} />
            </div>
          </motion.div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/35">
            <PulseDot color="bg-emerald-400" size="w-1 h-1" />
            {preview ? 'Dashboard preview · Sign in to add your own data' : 'Indexed locally'}
            {dataUpdatedAt
              ? ` · last refreshed ${relativeTime(new Date(dataUpdatedAt).toISOString())}`
              : ''}
          </p>
        </>
      )}
    </div>
  )
}
