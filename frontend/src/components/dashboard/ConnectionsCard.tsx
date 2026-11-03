import { motion } from 'motion/react'
import { ExternalLink, FileText, Link2, Waypoints } from 'lucide-react'
import type { Connection } from '@/lib/api'
import CardHeading from './CardHeading'
import EmptyState from './EmptyState'
import { MotionCard } from './MotionCard'
import { itemEnter, staggerContainer } from '@/lib/animations'

interface ConnectionsCardProps {
  connections: Connection[]
  className?: string
}

export default function ConnectionsCard({
  connections,
  className,
}: ConnectionsCardProps) {
  return (
    <MotionCard className={className}>
      <CardHeading
        icon={Waypoints}
        title="Connections"
        subtitle="Files and the pages they belong to"
        action={
          connections.length > 0 ? (
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {connections.length}
            </span>
          ) : null
        }
      />

      {connections.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No connections found"
          hint="Context links downloaded files to the pages you visited around the same time."
        />
      ) : (
        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="mt-4 flex-1 space-y-1.5 px-5 pb-5"
        >
          {connections.slice(0, 6).map((connection, index) => (
            <motion.li
              key={`${connection.file}-${connection.url}-${index}`}
              variants={itemEnter}
              className="group rounded-lg border border-transparent px-1.5 py-2 transition-colors hover:border-hairline hover:bg-surface-2"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/[0.08] text-primary/80 ring-1 ring-inset ring-primary/10 transition-shadow group-hover:shadow-[0_0_10px_hsl(var(--primary)/0.28)]">
                  <FileText className="h-3 w-3" strokeWidth={1.7} />
                </span>
                <p
                  className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/85"
                  title={connection.file}
                >
                  {connection.file}
                </p>

                {/* Dashed connector draws itself, then turns solid violet on hover */}
                <span className="relative flex w-7 shrink-0 items-center justify-center">
                  <svg
                    viewBox="0 0 28 4"
                    className="h-1.5 w-7 overflow-visible"
                    aria-hidden
                  >
                    <motion.path
                      d="M1 2 H27"
                      fill="none"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeDasharray="3 3"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.25 + index * 0.06 }}
                      className="stroke-muted-foreground/35 transition-colors duration-200 group-hover:stroke-primary group-hover:[stroke-dasharray:none]"
                    />
                    <circle cx="1.5" cy="2" r="1.4" className="fill-muted-foreground/30 transition-colors group-hover:fill-primary" />
                    <circle cx="26.5" cy="2" r="1.4" className="fill-muted-foreground/30 transition-colors group-hover:fill-primary" />
                  </svg>
                </span>

                <motion.a
                  href={connection.url}
                  target="_blank"
                  rel="noreferrer"
                  title={connection.page}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 + index * 0.06, duration: 0.3 }}
                  className="link-underline flex min-w-0 flex-1 items-center justify-end gap-1 text-[11px] text-muted-foreground transition-colors hover:text-primary"
                >
                  <span className="truncate">{connection.page}</span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-50" />
                </motion.a>

                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ duration: 0.45, delay: 0.35 + index * 0.06 }}
                  title="Match score"
                  className="shrink-0 rounded-full border border-primary/15 bg-primary/[0.08] px-1.5 py-0.5 text-[9px] font-medium tabular-nums text-primary/80"
                >
                  {connection.score.toFixed(1)}
                </motion.span>
              </div>

              {connection.shared?.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 pl-8">
                  {connection.shared.slice(0, 3).map((word) => (
                    <span
                      key={word}
                      className="rounded bg-surface-2 px-1 py-0.5 text-[9px] text-muted-foreground/60"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              )}
            </motion.li>
          ))}
        </motion.ul>
      )}
    </MotionCard>
  )
}
