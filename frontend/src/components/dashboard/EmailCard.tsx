import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowUpRight,
  Handshake,
  Inbox,
  Mail,
  MailX,
  Quote,
  RefreshCw,
  Reply,
} from 'lucide-react'
import type { GmailBrief } from '@/lib/api'
import { postGmailFetch } from '@/lib/api'
import { initials, relativeTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import CardHeading from './CardHeading'
import EmptyState from './EmptyState'
import { MotionCard } from './MotionCard'
import { SpinnerArc } from '../motion/SpinnerArc'
import { itemEnter, staggerContainer } from '@/lib/animations'
import { useSound } from '@/hooks/useSound'

const EMPTY: GmailBrief = {
  connected: false,
  email: null,
  total_emails: 0,
  unanswered: [],
  recent_promises: [],
  recent_app_email: [],
}

interface EmailCardProps {
  gmail?: GmailBrief
  className?: string
}

export default function EmailCard({ gmail = EMPTY, className }: EmailCardProps) {
  const queryClient = useQueryClient()
  const playClick = useSound('click')
  const playChime = useSound('chime')
  const playThud = useSound('thud')
  const [listKey, setListKey] = useState(0)

  const unanswered = gmail.unanswered ?? []
  const promises = gmail.recent_promises ?? []

  const refresh = useMutation({
    mutationFn: postGmailFetch,
    onSuccess: () => {
      playChime()
      toast.success('Inbox refreshed')
      setListKey((key) => key + 1)
      queryClient.invalidateQueries({ queryKey: ['home'] })
    },
    onError: (error) => {
      playThud()
      toast.error(
        error instanceof Error ? error.message : 'Could not fetch new mail'
      )
    },
  })

  return (
    <MotionCard className={className}>
      <CardHeading
        icon={Mail}
        title="Email"
        subtitle={
          gmail.connected
            ? gmail.email ?? 'Connected'
            : 'Gmail not connected'
        }
        action={
          gmail.connected ? (
            <div className="flex items-center gap-1.5">
              <Badge variant="info" className="gap-1 py-1">
                <span className="h-1 w-1 rounded-full bg-blue-400" />
                {gmail.total_emails} indexed
              </Badge>
              <Button
                variant="ghost"
                size="iconSm"
                aria-label="Fetch new emails"
                data-ui-tooltip="Fetch new emails"
                onClick={() => {
                  playClick()
                  refresh.mutate()
                }}
                disabled={refresh.isPending}
                sound={false}
              >
                {refresh.isPending ? (
                  <SpinnerArc className="h-3 w-3" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            </div>
          ) : (
            <Link
              to="/settings"
              className="link-underline inline-flex items-center gap-1 text-[11px] text-primary"
            >
              Connect Gmail <ArrowUpRight className="h-3 w-3" />
            </Link>
          )
        }
      />

      {!gmail.connected ? (
        <EmptyState
          icon={MailX}
          title="No mailbox connected"
          hint="Connect Gmail in Settings to see unanswered mail and promises here."
        />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={listKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-4 grid flex-1 grid-cols-1 divide-y divide-hairline px-5 pb-5 md:grid-cols-2 md:divide-x md:divide-y-0 md:gap-5"
          >
            {/* Needs reply */}
            <section className="pb-4 md:pb-0">
              <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                <Reply className="h-3 w-3" />
                Needs reply
                <Badge variant="secondary" className="ml-0.5 px-1.5 py-0">
                  {unanswered.length}
                </Badge>
              </div>

              {unanswered.length === 0 ? (
                <p className="flex items-center gap-2 py-3 text-[11px] text-muted-foreground/60">
                  <Inbox className="h-3.5 w-3.5" />
                  Inbox zero — nothing waiting on you.
                </p>
              ) : (
                <motion.ul
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-1"
                >
                  {unanswered.slice(0, 4).map((email, index) => (
                    <motion.li
                      variants={itemEnter}
                      key={`${email.from_addr}-${index}`}
                      className="group flex gap-2.5 rounded-lg border border-transparent border-l-2 border-l-transparent px-1.5 py-2 transition-colors hover:border-hairline hover:border-l-amber-500/70 hover:bg-surface-2"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-[10px] font-semibold text-blue-300 ring-1 ring-inset ring-blue-400/20 light:text-blue-700">
                        {initials(email.from_name || email.from_addr)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[12px] font-medium text-foreground/90">
                            {email.from_name || email.from_addr}
                          </p>
                          <span className="shrink-0 text-[10px] text-muted-foreground/60">
                            {relativeTime(email.received_at)}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-foreground/70">
                          {email.subject}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground/60">
                          {email.body_snippet}
                        </p>
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </section>

            {/* Promises */}
            <section className="pt-4 md:pt-0 md:pl-5">
              <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                <Handshake className="h-3 w-3" />
                Promises
                <Badge variant="secondary" className="ml-0.5 px-1.5 py-0">
                  {promises.length}
                </Badge>
              </div>

              {promises.length === 0 ? (
                <p className="flex items-center gap-2 py-3 text-[11px] text-muted-foreground/60">
                  <Handshake className="h-3.5 w-3.5" />
                  No open promises detected.
                </p>
              ) : (
                <motion.ul
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-1"
                >
                  {promises.slice(0, 4).map((promise, index) => (
                    <motion.li
                      variants={itemEnter}
                      key={`${promise.who}-${index}`}
                      className="group rounded-lg border border-transparent px-1.5 py-2 transition-colors hover:border-hairline hover:bg-surface-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[9px] font-semibold text-violet-300 ring-1 ring-inset ring-violet-400/20 light:text-violet-700">
                          {initials(promise.who)}
                        </span>
                        <p className="truncate text-[12px] font-medium text-foreground/90">
                          {promise.who}
                        </p>
                        <Quote className="ml-auto h-3 w-3 shrink-0 text-muted-foreground/25 transition-transform duration-300 group-hover:scale-125 group-hover:text-primary/70" />
                      </div>
                      <p className="mt-1 line-clamp-2 pl-7 text-[11px] leading-relaxed text-muted-foreground">
                        {promise.what}
                      </p>
                      {promise.by_when && (
                        <p className="mt-0.5 pl-7 text-[10px] text-amber-400 light:text-amber-700">
                          by {promise.by_when}
                        </p>
                      )}
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </section>
          </motion.div>
        </AnimatePresence>
      )}
    </MotionCard>
  )
}
