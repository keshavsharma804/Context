import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity,
  AppWindow,
  FileText,
  Globe,
  History,
} from 'lucide-react'
import type { ActivityEntry } from '@/lib/api'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import CardHeading from './CardHeading'
import EmptyState from './EmptyState'
import { MotionCard } from './MotionCard'
import { PulseDot } from '../motion/PulseDot'

const KIND = {
  file_open: {
    icon: FileText,
    label: 'Opened file',
    tone: 'bg-amber-500/[0.08] text-amber-400 light:text-amber-700 ring-amber-500/10',
  },
  page_visit: {
    icon: Globe,
    label: 'Visited page',
    tone: 'bg-blue-500/[0.08] text-blue-400 light:text-blue-700 ring-blue-500/10',
  },
  window: {
    icon: AppWindow,
    label: 'Focused window',
    tone: 'bg-violet-500/[0.08] text-violet-400 light:text-violet-700 ring-violet-500/10',
  },
} as const

function entryKey(entry: ActivityEntry) {
  return `${entry.kind}-${entry.timestamp}-${entry.target}`
}

interface ActivityCardProps {
  activity?: ActivityEntry[]
  className?: string
}

export default function ActivityCard({
  activity = [],
  className,
}: ActivityCardProps) {
  const [newKey, setNewKey] = useState<string | null>(null)
  const previousFirst = useRef<string | null>(null)

  useEffect(() => {
    const first = activity[0] ? entryKey(activity[0]) : null
    if (previousFirst.current !== null && first !== null && first !== previousFirst.current) {
      setNewKey(first)
      const timer = window.setTimeout(() => setNewKey(null), 3000)
      previousFirst.current = first
      return () => window.clearTimeout(timer)
    }
    previousFirst.current = first
  }, [activity])

  return (
    <MotionCard className={className}>
      <CardHeading
        icon={History}
        title="Activity"
        subtitle="What you've touched recently"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-2 py-0.5 text-[10px] text-emerald-400 light:text-emerald-700">
            <span className="pulse-dot h-1 w-1 rounded-full bg-emerald-400" />
            Live
          </span>
        }
      />

      {activity.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          hint="Open a file or visit a page — Context will start noticing."
        />
      ) : (
        <ul className="mt-4 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-5 pb-5">
          <AnimatePresence initial={false} mode="popLayout">
            {activity.slice(0, 8).map((entry) => {
              const meta = KIND[entry.kind as keyof typeof KIND] ?? {
                icon: Activity,
                label: entry.kind,
                tone: 'bg-surface-2 text-muted-foreground ring-hairline',
              }
              const Icon = meta.icon
              const key = entryKey(entry)
              return (
                <motion.li
                  key={key}
                  layout
                  initial={{ opacity: 0, y: -10, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="group flex items-start gap-2.5 rounded-lg border border-transparent px-1.5 py-1.5 transition-colors hover:border-hairline hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset transition-transform group-hover:scale-105',
                      meta.tone
                    )}
                  >
                    <Icon className="h-3 w-3" strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[11px] font-medium text-foreground/85">
                      <span className="truncate">
                        {entry.detail || entry.target}
                      </span>
                      {newKey === key && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1 py-0.5 text-[8px] font-medium uppercase tracking-wider text-primary">
                          <PulseDot size="w-1 h-1" /> new
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground/60">
                      <span className="capitalize">{meta.label}</span>
                      {entry.detail ? ` · ${entry.target}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 pt-0.5 text-[9px] text-muted-foreground/40">
                    {relativeTime(entry.timestamp)}
                  </span>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
    </MotionCard>
  )
}
