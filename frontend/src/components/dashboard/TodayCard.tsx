import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  MapPin,
  CalendarOff,
} from 'lucide-react'
import type { CalBrief } from '@/lib/api'
import { clockTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import CardHeading from './CardHeading'
import EmptyState from './EmptyState'
import { MotionCard } from './MotionCard'
import { itemEnter, staggerContainer } from '@/lib/animations'

const EMPTY: CalBrief = {
  today: [],
  upcoming: [],
  collisions: [],
  free_slots: [],
}

const CATEGORY_CLASS: Record<string, string> = {
  office: 'tag-office',
  academic: 'tag-academic',
  interview: 'tag-interview',
  personal: 'tag-personal',
  other: 'tag-other',
}

const DOT_CLASS: Record<string, string> = {
  office: 'bg-amber-400',
  academic: 'bg-blue-400',
  interview: 'bg-red-400',
  personal: 'bg-violet-400',
  other: 'bg-zinc-500',
}

const DAY_START = 8 * 60
const DAY_END = 22 * 60

interface TodayCardProps {
  cal?: CalBrief
  className?: string
}

export default function TodayCard({ cal = EMPTY, className }: TodayCardProps) {
  const events = cal.today ?? []
  const collisions = cal.collisions ?? []
  const freeSlots = cal.free_slots ?? []
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const minutes = now.getHours() * 60 + now.getMinutes()
  const nowVisible = minutes >= DAY_START && minutes <= DAY_END
  const nowPercent = ((minutes - DAY_START) / (DAY_END - DAY_START)) * 100

  return (
    <MotionCard className={className}>
      <CardHeading
        icon={CalendarDays}
        title="Today"
        subtitle={new Date().toLocaleDateString('en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
        })}
        action={
          <Badge variant="secondary" className="py-1">
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </Badge>
        }
      />

      {collisions.length > 0 && (
        <motion.div
          initial={{ boxShadow: '0 0 0 0 rgba(239,68,68,0)' }}
          animate={{
            boxShadow: [
              '0 0 0 0 rgba(239,68,68,0)',
              '0 0 26px 2px rgba(239,68,68,0.32)',
              '0 0 0 0 rgba(239,68,68,0)',
            ],
          }}
          transition={{ duration: 1.6, delay: 0.5, ease: 'easeInOut' }}
          className="mx-5 mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400 light:text-amber-700" />
          <p className="text-[11px] leading-relaxed text-amber-200/90 light:text-amber-800">
            <span className="font-medium">Overlap:</span>{' '}
            {collisions[0].a} and {collisions[0].b} share a time slot.
          </p>
        </motion.div>
      )}

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title="Nothing scheduled today"
          hint={
            cal.upcoming?.length
              ? `${cal.upcoming.length} event${
                  cal.upcoming.length === 1 ? '' : 's'
                } coming up this week.`
              : 'Your day is clear. Import a calendar to fill it in.'
          }
        />
      ) : (
        <div className="mt-4 flex-1 px-5">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="relative"
          >
            {/* Moving "now" line */}
            {nowVisible && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                animate={{ top: `${nowPercent}%` }}
                initial={false}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <span className="h-px flex-1 bg-gradient-to-r from-primary/50 to-transparent" />
              </motion.div>
            )}

            {events.map((event, index) => {
              const last = index === events.length - 1
              return (
                <motion.div
                  key={event.id ?? `${event.title}-${index}`}
                  variants={itemEnter}
                  className="grid grid-cols-[46px_14px_1fr] gap-x-2"
                >
                  <div className="pt-0.5 text-right text-[11px] font-medium tabular-nums text-muted-foreground">
                    {clockTime(event.start_at)}
                  </div>

                  <div className="relative flex justify-center">
                    {!last && (
                      <span className="absolute top-3 bottom-0 w-px bg-surface-3" />
                    )}
                    <span
                      className={cn(
                        'relative mt-1 h-2 w-2 shrink-0 rounded-full ring-4 ring-card',
                        DOT_CLASS[event.category] ?? DOT_CLASS.other
                      )}
                    />
                  </div>

                  <div className={cn('min-w-0', last ? 'pb-1' : 'pb-5')}>
                    <p className="truncate text-[13px] font-medium leading-snug text-foreground/90">
                      {event.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] capitalize',
                          CATEGORY_CLASS[event.category] ?? CATEGORY_CLASS.other
                        )}
                      >
                        {event.category}
                      </span>
                      {event.company && (
                        <span className="text-[10px] text-muted-foreground">
                          {event.company}
                        </span>
                      )}
                      {event.location && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <MapPin className="h-2.5 w-2.5" />
                          {event.location}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        <Clock className="h-2.5 w-2.5" />
                        {clockTime(event.start_at)}–{clockTime(event.end_at)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      )}

      {events.length > 0 && freeSlots.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline px-5 py-3">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
            Free
          </span>
          {freeSlots.slice(0, 3).map((slot, index) => (
            <motion.span
              key={`${slot.start}-${slot.end}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.05, duration: 0.2 }}
              className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.08] px-1.5 py-0.5 text-[10px] tabular-nums text-emerald-500 light:text-emerald-700"
            >
              {clockTime(slot.start)}–{clockTime(slot.end)}
            </motion.span>
          ))}
        </div>
      )}
    </MotionCard>
  )
}
