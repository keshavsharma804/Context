import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Flame,
  Users,
  CheckCircle2,
  Calendar,
  Share2,
  Download,
  Copy,
  FolderGit2,
  Receipt,
  Heart,
  Quote,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { fetchWeeklyReview, fetchConfig } from '@/lib/api'
import { PageHeader, ErrorPanel } from '@/components/pages/PageChrome'
import { CountUp } from '@/components/motion/CountUp'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSound } from '@/hooks/useSound'
import { celebrateConnection } from '@/lib/celebrate'

export default function Review() {
  const playClick = useSound('click')
  const cardRef = useRef<HTMLDivElement>(null)

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
    queryKey: ['weekly-review'],
    queryFn: fetchWeeklyReview,
  })

  const review = data?.review

  const handleCelebrate = () => {
    celebrateConnection()
    toast.success('🎉 Cheers to a productive week!')
  }

  const handleCopySummary = () => {
    if (!review) return
    playClick()
    const text = `📊 Context Weekly Review (Week ${review.week_number})
• Habits: ${review.habits.adherence_pct}% completed (${review.habits.best_habit || 'routine'} streak: ${review.habits.best_streak}d)
• Spending: ${money(review.spending.total, symbol)} (${review.spending.change_pct <= 0 ? 'down' : 'up'} ${Math.abs(review.spending.change_pct)}%)
• People: Connected with ${review.people.contacted_count} contacts
• Settled Debts: ${review.debts_settled} resolved`
    navigator.clipboard.writeText(text)
    toast.success('Copied retrospective summary to clipboard!')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={Sparkles}
        eyebrow="Weekly Look-Back"
        title="Weekly Retrospective"
        subtitle={
          review
            ? `Week ${review.week_number}, ${review.year} · ${review.start_date} to ${review.end_date}`
            : 'Personal summary across habits, money, people, and accomplishments'
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-surface-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-3 transition shadow-sm"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Summary
            </button>
            <button
              onClick={handleCelebrate}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95"
            >
              <Sparkles className="h-4 w-4" />
              Celebrate Week
            </button>
          </div>
        }
      />

      {isError && (
        <div className="mt-6">
          <ErrorPanel error={error as Error} onRetry={() => refetch()} />
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 rounded-2xl border border-border/60 bg-card/40 animate-pulse" />
          ))}
        </div>
      ) : review && (
        <div className="mt-6 space-y-8">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Habits Adherence */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-xl shadow-sm"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium uppercase tracking-wider">Habit Consistency</span>
                <Flame className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                <CountUp value={review.habits.adherence_pct} />%
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {review.habits.best_habit
                  ? `${review.habits.best_habit} streak: ${review.habits.best_streak} days`
                  : `${review.habits.completed_logs} completions recorded`}
              </p>
            </motion.div>

            {/* Spending */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-xl shadow-sm"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium uppercase tracking-wider">Total Spent</span>
                <Receipt className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                <CountUp value={review.spending.total} prefix={symbol} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                {review.spending.change_pct <= 0 ? (
                  <span className="text-emerald-500 font-medium inline-flex items-center">
                    <TrendingDown className="h-3 w-3 mr-0.5" />
                    {Math.abs(review.spending.change_pct)}% vs last week
                  </span>
                ) : (
                  <span className="text-rose-500 font-medium inline-flex items-center">
                    <TrendingUp className="h-3 w-3 mr-0.5" />
                    +{review.spending.change_pct}% vs last week
                  </span>
                )}
              </p>
            </motion.div>

            {/* People Contacted */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-xl shadow-sm"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium uppercase tracking-wider">Social Touchpoints</span>
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                <CountUp value={review.people.contacted_count} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {review.people.recent[0]?.name
                  ? `Recent: ${review.people.recent.map((p) => p.name).join(', ')}`
                  : 'Stay in touch with your circle'}
              </p>
            </motion.div>

            {/* Workspace & Debts Settled */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-xl shadow-sm"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium uppercase tracking-wider">Workspace & Resolves</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                <CountUp value={review.debts_settled} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Debts settled · {review.total_files} files indexed
              </p>
            </motion.div>
          </div>

          {/* Insights Highlights */}
          {review.insights.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl shadow-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Weekly Highlights & Observations
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {review.insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-surface-1/40 p-3 text-xs text-foreground"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {idx + 1}
                    </span>
                    <p className="leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Shareable Bento Card Preview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Shareable Retrospective Card</h3>
                <p className="text-xs text-muted-foreground">
                  A polished visual summary of your week to save or share
                </p>
              </div>
              <button
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-3 transition"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>
            </div>

            {/* The Bento Card */}
            <div
              ref={cardRef}
              className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-surface-2 p-8 shadow-2xl backdrop-blur-2xl max-w-2xl mx-auto"
              style={{
                boxShadow: '0 20px 50px -12px var(--theme-glow, rgba(0,0,0,0.3))',
              }}
            >
              {/* Ambient Glow Blob */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl"
              />

              <div className="relative">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-hairline pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                      <Zap className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-foreground">
                        Context OS
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-2">
                        Weekly Look-Back
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Week {review.week_number} · {review.year}
                  </span>
                </div>

                {/* Big Stat Row */}
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-border/60 bg-surface-1/50 p-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Habit Adherence
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-4xl font-extrabold tracking-tight text-foreground">
                        {review.habits.adherence_pct}%
                      </span>
                      <Flame className="h-5 w-5 text-amber-500" />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {review.habits.best_habit
                        ? `${review.habits.best_habit} streak: ${review.habits.best_streak}d`
                        : `${review.habits.completed_logs} completions`}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-surface-1/50 p-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Spending
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-4xl font-extrabold tracking-tight text-foreground">
                        {money(review.spending.total, symbol)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {review.spending.change_pct <= 0 ? (
                        <span className="text-emerald-500 font-medium">
                          {Math.abs(review.spending.change_pct)}% less than prior week
                        </span>
                      ) : (
                        <span className="text-rose-500 font-medium">
                          +{review.spending.change_pct}% vs prior week
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Categories and Contacts */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/40 bg-surface-1/30 p-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Top Spend Categories
                    </span>
                    <div className="mt-2 space-y-1">
                      {review.spending.top_categories.slice(0, 3).map((c) => (
                        <div key={c.category} className="flex justify-between text-[11px]">
                          <span className="capitalize text-foreground">{c.category}</span>
                          <span className="text-muted-foreground">
                            {money(c.amount, symbol)} ({c.percent}%)
                          </span>
                        </div>
                      ))}
                      {review.spending.top_categories.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">No spend logged</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/40 bg-surface-1/30 p-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Connected Circles
                    </span>
                    <div className="mt-2 space-y-1">
                      {review.people.recent.slice(0, 3).map((p) => (
                        <div key={p.name} className="flex justify-between text-[11px]">
                          <span className="text-foreground">{p.name}</span>
                          <span className="text-muted-foreground text-[10px]">
                            {new Date(p.last_contacted).toLocaleDateString(undefined, {
                              weekday: 'short',
                            })}
                          </span>
                        </div>
                      ))}
                      {review.people.recent.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">No recent check-ins</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Quote */}
                <div className="mt-6 flex items-center justify-between border-t border-hairline pt-3 text-[10px] text-muted-foreground">
                  <span>Local-first · Zero cloud telemetry</span>
                  <span className="font-semibold text-primary">Context Personal OS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
