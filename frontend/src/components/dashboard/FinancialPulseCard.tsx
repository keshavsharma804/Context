import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import {
  Wallet,
  Repeat,
  HandCoins,
  PiggyBank,
  ArrowRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import {
  fetchSubscriptions,
  fetchDebts,
  fetchSavings,
} from '@/lib/api'
import { currencySymbol, money } from '@/lib/format'
import { MotionCard } from './MotionCard'
import CardHeading from './CardHeading'
import { cn } from '@/lib/utils'

export function FinancialPulseCard({
  symbol = '₹',
  className,
}: {
  symbol?: string
  className?: string
}) {
  const { data: subsData } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: fetchSubscriptions,
    staleTime: 60_000,
  })

  const { data: debtsData } = useQuery({
    queryKey: ['debts'],
    queryFn: () => fetchDebts(),
    staleTime: 60_000,
  })

  const { data: savingsData } = useQuery({
    queryKey: ['savings'],
    queryFn: fetchSavings,
    staleTime: 60_000,
  })

  const subSummary = subsData?.summary
  const debtSummary = debtsData?.summary
  const savingsSummary = savingsData?.summary

  const monthlyBurn = subSummary?.total_monthly ?? 0
  const activeSubs = subSummary?.active_count ?? 0
  const nextRenewal = subSummary?.upcoming?.[0]

  const netDebt = debtSummary?.net_balance ?? 0
  const owedToMe = debtSummary?.total_lent ?? 0
  const iOwe = debtSummary?.total_borrowed ?? 0

  const totalSaved = savingsSummary?.total_saved ?? 0
  const totalTarget = savingsSummary?.total_target ?? 0
  const savingsPct = savingsSummary?.overall_progress_pct ?? 0
  const topGoal = savingsSummary?.goals?.[0]

  return (
    <MotionCard className={cn('relative overflow-hidden', className)}>
      <div className="absolute left-0 bottom-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      <CardHeading
        icon={Wallet}
        title="Financial Health & Pulse"
        subtitle="Subscriptions, IOUs, and wealth targets in one place"
        action={
          <Link
            to="/money"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline transition-colors"
          >
            All Money
            <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />

      <div className="p-5 pt-3 space-y-3.5">
        {/* Row 1: Subscriptions Burn & Debts IOUs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Subscriptions Pill */}
          <Link
            to="/subscriptions"
            className="group block rounded-xl border border-border/60 bg-surface-1/70 p-3.5 transition-all duration-200 hover:border-primary/40 hover:bg-surface-2"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-medium">
                <Repeat className="h-3.5 w-3.5 text-primary" />
                Monthly Subscriptions
              </span>
              <span className="text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                {activeSubs} active
              </span>
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
              {money(monthlyBurn, symbol)}
              <span className="text-xs font-normal text-muted-foreground ml-1">/ mo</span>
            </div>
            {nextRenewal && (
              <div className="mt-2 text-[10px] text-muted-foreground truncate">
                Next: <span className="text-foreground/90 font-medium">{nextRenewal.name}</span> in{' '}
                {nextRenewal.days_remaining}d
              </div>
            )}
          </Link>

          {/* Debts & IOUs Pill */}
          <Link
            to="/debts"
            className="group block rounded-xl border border-border/60 bg-surface-1/70 p-3.5 transition-all duration-200 hover:border-emerald-500/40 hover:bg-surface-2"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-medium">
                <HandCoins className="h-3.5 w-3.5 text-emerald-400" />
                Net Debts & IOUs
              </span>
              <span
                className={cn(
                  'text-[10px] rounded-full px-2 py-0.5 font-medium',
                  netDebt >= 0
                    ? 'bg-emerald-500/10 text-emerald-300'
                    : 'bg-rose-500/10 text-rose-300'
                )}
              >
                {netDebt >= 0 ? 'Owed to you' : 'You owe'}
              </span>
            </div>
            <div
              className={cn(
                'text-xl font-bold tracking-tight tabular-nums',
                netDebt >= 0 ? 'text-emerald-400 light:text-emerald-600' : 'text-rose-400 light:text-rose-600'
              )}
            >
              {netDebt >= 0 ? '+' : ''}
              {money(netDebt, symbol)}
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Lent: {money(owedToMe, symbol)}</span>
              <span>Borrowed: {money(iOwe, symbol)}</span>
            </div>
          </Link>
        </div>

        {/* Row 2: Savings Pots Progress */}
        <Link
          to="/savings"
          className="group block rounded-xl border border-border/60 bg-surface-1/70 p-3.5 transition-all duration-200 hover:border-amber-500/40 hover:bg-surface-2"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="flex items-center gap-1.5 text-[11px] font-medium">
              <PiggyBank className="h-3.5 w-3.5 text-amber-400" />
              Savings Target Pots
            </span>
            <span className="text-[11px] font-semibold text-foreground/90 tabular-nums">
              {money(totalSaved, symbol)}{' '}
              <span className="text-[10px] text-muted-foreground font-normal">
                of {money(totalTarget, symbol)}
              </span>
            </span>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, savingsPct))}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-400"
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {topGoal ? `${topGoal.emoji} ${topGoal.title}` : 'No active targets'}
            </span>
            <span className="font-semibold text-amber-300 light:text-amber-700 tabular-nums">
              {savingsPct.toFixed(0)}% funded
            </span>
          </div>
        </Link>
      </div>
    </MotionCard>
  )
}
