import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { format } from 'date-fns'
import { Plus, RefreshCw } from 'lucide-react'
import { fetchConfig, fetchToday } from '@/lib/api'
import { currencySymbol } from '@/lib/format'
import { useProfile } from '@/hooks/useProfile'
import { useConnectionCelebration } from '@/hooks/useConnectionCelebration'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorPanel } from '@/components/pages/PageChrome'
import ChronosphereHero from '@/components/dashboard/ChronosphereHero'
import TodayView from '@/components/dashboard/TodayView'
import TodayReminders from '@/components/notifications/TodayReminders'
import { cn } from '@/lib/utils'

export default function Dashboard({ preview = false }: { preview?: boolean }) {
  const navigate = useNavigate()
  const { name: profileName } = useProfile()
  // Match the visitor's calendar day, including after midnight in an open tab.
  const [day, setDay] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  useEffect(() => {
    const timer = window.setInterval(() => setDay(format(new Date(), 'yyyy-MM-dd')), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const today = useQuery({
    queryKey: ['home', 'today', day],
    queryFn: () => fetchToday(day),
    enabled: !preview,
    staleTime: 0,
    refetchInterval: 60_000,
  })
  const { data: config } = useQuery({
    queryKey: ['config'], queryFn: fetchConfig, enabled: !preview,
  })
  useConnectionCelebration(config)

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8"
      onClickCapture={preview ? event => {
        if ((event.target as HTMLElement).closest('button, input, textarea, select')) {
          event.preventDefault(); event.stopPropagation(); navigate('/auth');
        }
      } : undefined}>
      {/* Preserve the existing planetary horizon, greeting, and atmosphere controls. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mb-5"
      >
        <ChronosphereHero userName={profileName} />
      </motion.div>

      <section aria-labelledby="today-heading" className="mt-7 flex flex-col gap-6">
        <header className="grid grid-cols-1 items-center gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <h2 id="today-heading" className="text-2xl font-semibold tracking-tight">Today</h2>
            <p className="mt-1 text-sm text-muted-foreground">{format(new Date(`${day}T12:00:00`), 'EEEE, d MMMM')} · What needs your attention.</p>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-2 self-start">
            <Link to="/money" className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-surface-2">Log expense</Link>
            <Button size="sm" className="h-9" onClick={() => window.dispatchEvent(new Event('context:quick-capture'))}><Plus className="h-3.5 w-3.5" />Quick capture</Button>
            {!preview && <Button variant="ghost" size="iconSm" aria-label="Refresh today" disabled={today.isFetching} onClick={() => { void today.refetch() }}><RefreshCw className={cn('h-3.5 w-3.5', today.isFetching && 'animate-spin')} /></Button>}
          </div>
        </header>

        <TodayReminders preview={preview} />


        {!preview && today.isPending ? <div role="status" aria-label="Loading today" className="grid gap-5 lg:grid-cols-2">
          {[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-52 w-full rounded-2xl" />)}
        </div> : !preview && today.isError ? <ErrorPanel error={today.error} onRetry={() => { void today.refetch() }} retrying={today.isFetching} />
          : <TodayView data={preview ? undefined : today.data} date={day} preview={preview} symbol={currencySymbol(config?.symbol)} />}
      </section>
    </div>
  )
}
