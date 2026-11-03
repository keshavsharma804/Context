import { motion } from 'motion/react'
import { Briefcase, CalendarClock, FileText } from 'lucide-react'
import type { JobApplication, JobBrief } from '@/lib/api'
import { shortDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import CardHeading from './CardHeading'
import EmptyState from './EmptyState'
import { MotionCard } from './MotionCard'

const EMPTY: JobBrief = {
  applications: [],
  interviews: [],
  detected_companies: [],
  cvs: [],
  forms: [],
  prep_by_company: {},
  portal_visits: [],
}

const COLUMNS = [
  { key: 'applied', label: 'Applied', dot: 'bg-amber-400', accent: 'border-l-amber-400/60' },
  {
    key: 'interview',
    label: 'Interview',
    dot: 'bg-indigo-400',
    accent: 'border-l-indigo-400/60',
  },
  {
    key: 'offer',
    label: 'Offer',
    dot: 'bg-emerald-400',
    accent: 'border-l-emerald-400/60',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    dot: 'bg-red-400',
    accent: 'border-l-red-400/60',
  },
] as const

function normalizeStatus(status?: string | null): string {
  const s = (status ?? '').toLowerCase()
  if (['interview', 'interviewing', 'screening'].includes(s)) return 'interview'
  if (['offer', 'offered', 'hired', 'accepted'].includes(s)) return 'offer'
  if (['rejected', 'declined', 'withdrawn'].includes(s)) return 'rejected'
  return 'applied'
}

interface JobSearchCardProps {
  job?: JobBrief
  className?: string
}

export default function JobSearchCard({ job = EMPTY, className }: JobSearchCardProps) {
  const applications = job.applications ?? []
  const interviews = job.interviews ?? []

  const grouped = COLUMNS.reduce<Record<string, JobApplication[]>>(
    (acc, column) => {
      acc[column.key] = applications.filter(
        (application) => normalizeStatus(application.status) === column.key
      )
      return acc
    },
    {}
  )

  return (
    <MotionCard className={className}>
      <CardHeading
        icon={Briefcase}
        title="Job search"
        subtitle={`${applications.length} application${
          applications.length === 1 ? '' : 's'
        } in flight`}
        action={
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <FileText className="h-3 w-3" />
            {job.cvs?.length ?? 0} CVs
          </span>
        }
      />

      {applications.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No applications tracked"
          hint="Job applications appear here once Context detects them in your files or mail."
        />
      ) : (
        <div className="mt-4 grid flex-1 grid-cols-2 gap-2 px-5 xl:grid-cols-4">
          {COLUMNS.map((column, columnIndex) => {
            const items = grouped[column.key] ?? []
            return (
              <motion.div
                key={column.key}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 0.15 + columnIndex * 0.1,
                  duration: 0.35,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="flex min-h-[132px] flex-col rounded-lg border border-hairline bg-surface-1 p-1.5"
              >
                <div className="mb-1.5 flex items-center gap-1.5 px-1 pt-0.5">
                  <motion.span
                    className={cn('h-1.5 w-1.5 rounded-full', column.dot)}
                    animate={
                      column.key === 'interview'
                        ? { scale: [1, 1.35, 1], opacity: [1, 0.7, 1] }
                        : undefined
                    }
                    transition={
                      column.key === 'interview'
                        ? {
                            duration: 0.9,
                            repeat: Infinity,
                            repeatDelay: 6,
                            ease: 'easeInOut',
                          }
                        : undefined
                    }
                  />
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {column.label}
                  </span>
                  <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/50">
                    {items.length}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {items.length === 0 ? (
                    <div className="rounded-md border border-dashed border-hairline px-2 py-3 text-center text-[10px] text-muted-foreground/30">
                      Empty
                    </div>
                  ) : (
                    items.map((application, index) => {
                      const isInterview =
                        normalizeStatus(application.status) === 'interview'
                      return (
                        <motion.div
                          key={`${application.company}-${index}`}
                          whileHover={{ y: -2, scale: 1.01 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                          className={cn(
                            'group relative rounded-md border border-hairline border-l-2 bg-card/80 px-2 py-1.5 transition-shadow hover:border-border hover:bg-surface-2 hover:shadow-md hover:shadow-primary/5',
                            column.accent
                          )}
                        >
                          <p className="truncate text-[11px] font-medium text-foreground/90">
                            {application.company}
                          </p>
                          {application.role && (
                            <p className="truncate text-[10px] text-muted-foreground">
                              {application.role}
                            </p>
                          )}
                          <div className="mt-0.5 flex items-center gap-1">
                            <p className="text-[9px] text-muted-foreground/50">
                              {shortDate(application.applied_at)}
                            </p>
                            {isInterview && (
                              <span className="pill-interview rounded-full px-1 py-0 text-[8px] font-medium">
                                interview
                              </span>
                            )}
                          </div>
                          <span className="pointer-events-none absolute bottom-1 right-1.5 text-[9px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                            open →
                          </span>
                        </motion.div>
                      )
                    })
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {interviews.length > 0 && (
        <div className="mt-4 flex items-center gap-2 border-t border-hairline px-5 py-3 text-[10px] text-muted-foreground">
          <CalendarClock className="h-3 w-3 text-primary/70" />
          Next interview: {interviews[0].company} ·{' '}
          {shortDate(interviews[0].scheduled_at)}
        </div>
      )}
    </MotionCard>
  )
}
