import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  ArrowRight,
  Briefcase,
  Handshake,
  Inbox,
  Mail,
  MailX,
  RefreshCw,
  Reply,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  User,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react'
import {
  fetchEmail,
  postGmailFetch,
  type Email,
  type EmailFilter,
  type Promise_,
} from '@/lib/api'
import { initials, relativeTime } from '@/lib/format'
import { PageHeader, ErrorPanel, EmptyCommand } from '@/components/pages/PageChrome'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SpinnerArc } from '@/components/motion/SpinnerArc'
import { useSound } from '@/hooks/useSound'
import { cn } from '@/lib/utils'

const FILTERS: { key: EmailFilter; label: string; icon: typeof Inbox }[] = [
  { key: 'all', label: 'All', icon: Inbox },
  { key: 'needs_reply', label: 'Needs reply', icon: Reply },
  { key: 'promises', label: 'Promises', icon: Handshake },
  { key: 'applications', label: 'Applications', icon: Briefcase },
]

const CATEGORY_COLORS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  application: { label: 'Job Application', bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  interview: { label: 'Interview Scheduled', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  offer: { label: 'Job Offer', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  rejection: { label: 'Application Status', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  newsletter: { label: 'Newsletter', bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  notification: { label: 'Notification', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
}

/**
 * Intelligent snippet parser that transforms plain text and long tracking URLs
 * into clean, readable paragraphs with interactive pill badges.
 */
function parseBodyWithLinks(text: string) {
  if (!text) {
    return <p className="text-muted-foreground/60 italic text-xs">No email content snippet available.</p>
  }

  const urlRegex = /(https?:\/\/[^\s]+)/g
  const paragraphs = text.split(/\n\s*\n/)

  return (
    <div className="space-y-3">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split('\n')
        return (
          <p key={pIdx} className="leading-relaxed text-[13px] text-foreground/90 font-normal selection:bg-primary/25">
            {lines.map((line, lIdx) => {
              const parts = line.split(urlRegex)
              return (
                <span key={lIdx} className="block last:inline">
                  {parts.map((part, idx) => {
                    if (part.match(urlRegex)) {
                      try {
                        const parsed = new URL(part)
                        const cleanDomain = parsed.hostname.replace(/^www\./, '')
                        const cleanPath =
                          parsed.pathname.length > 22
                            ? parsed.pathname.slice(0, 22) + '…'
                            : parsed.pathname === '/'
                              ? ''
                              : parsed.pathname

                        return (
                          <a
                            key={idx}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-lg border border-primary/25 bg-primary/10 hover:bg-primary/20 text-primary text-[12px] font-mono transition-colors group/link cursor-pointer shadow-xs"
                            title={part}
                          >
                            <span className="truncate max-w-[200px] sm:max-w-[320px]">
                              {cleanDomain}{cleanPath}
                            </span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-70 group-hover/link:opacity-100 transition-opacity" />
                          </a>
                        )
                      } catch {
                        return (
                          <a
                            key={idx}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:underline underline-offset-2 break-all cursor-pointer"
                          >
                            {part}
                          </a>
                        )
                      }
                    }
                    return <span key={idx}>{part}</span>
                  })}
                </span>
              )
            })}
          </p>
        )
      })}
    </div>
  )
}

function EmailRow({
  email,
  expanded,
  onToggle,
}: {
  email: Email
  expanded: boolean
  onToggle: () => void
}) {
  const [copiedBody, setCopiedBody] = useState(false)
  const [copiedSender, setCopiedSender] = useState(false)
  const playPop = useSound('pop')

  // Extract unique links for quick link drawer
  const extractedLinks = useMemo(() => {
    if (!email.body_snippet) return []
    const matches = email.body_snippet.match(/https?:\/\/[^\s]+/g) || []
    return Array.from(new Set(matches))
  }, [email.body_snippet])

  const handleCopyBody = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(email.body_snippet || '')
    setCopiedBody(true)
    playPop()
    toast.success('Email text copied to clipboard')
    setTimeout(() => setCopiedBody(false), 2000)
  }

  const handleCopySender = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(email.from_addr || '')
    setCopiedSender(true)
    playPop()
    toast.success('Sender email copied')
    setTimeout(() => setCopiedSender(false), 2000)
  }

  // Exact date formatted
  const formattedDate = useMemo(() => {
    if (!email.received_at) return ''
    try {
      const d = new Date(email.received_at)
      if (isNaN(d.getTime())) return relativeTime(email.received_at)
      return format(d, 'EEEE, d MMMM yyyy · h:mm a')
    } catch {
      return relativeTime(email.received_at)
    }
  }, [email.received_at])

  // Category styling
  const catStyle = email.category ? CATEGORY_COLORS[email.category.toLowerCase()] : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={cn(
        'group overflow-hidden rounded-2xl border transition-all duration-200',
        expanded
          ? 'border-primary/50 bg-[#121619] shadow-xl ring-1 ring-primary/20'
          : email.needs_reply
            ? 'border-transparent border-l-2 border-l-amber-500/80 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
            : 'border-transparent border-l-2 border-l-transparent hover:border-l-primary/40 hover:bg-surface-2'
      )}
    >
      {/* Row Header (Clickable) */}
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3.5 px-3.5 py-3 text-left cursor-pointer transition-colors"
      >
        {/* Avatar */}
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold shadow-xs transition-transform',
            email.source === 'sent'
              ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
              : 'bg-primary/15 text-primary ring-1 ring-primary/30',
            expanded && 'scale-105'
          )}
        >
          {initials(email.from_name || email.from_addr)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn('truncate text-[12.5px] font-semibold', expanded ? 'text-primary' : 'text-foreground/95')}>
              {email.source === 'sent' ? `To ${email.to_addr}` : email.from_name || email.from_addr}
            </p>
            <span className="shrink-0 text-[10.5px] font-mono text-muted-foreground/70">
              {relativeTime(email.received_at)}
            </span>
          </div>

          <p className="truncate text-[12px] font-medium text-foreground/80 mt-0.5">
            {email.subject || '(no subject)'}
          </p>

          {!expanded && (
            <p className="truncate text-[11px] text-muted-foreground/60 mt-0.5">
              {email.body_snippet}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {email.needs_reply === 1 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                needs reply
              </span>
            )}
            {catStyle ? (
              <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9.5px] font-medium capitalize', catStyle.bg, catStyle.text, catStyle.border)}>
                {catStyle.label}
              </span>
            ) : email.category ? (
              <Badge variant="secondary" className="px-1.5 py-0 text-[9.5px] capitalize">
                {email.category}
              </Badge>
            ) : null}
            {email.source === 'sent' && (
              <Badge variant="success" className="px-1.5 py-0 text-[9.5px]">
                sent
              </Badge>
            )}
          </div>
        </div>

        {/* Expand / Collapse Icon */}
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors',
            expanded ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground/50 group-hover:text-foreground'
          )}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </motion.span>
      </button>

      {/* Expanded Preview Pane */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mx-3.5 mb-3.5 space-y-3.5 pt-1 border-t border-border/60">
              {/* Detailed Header Card */}
              <div className="rounded-xl border border-border/80 bg-surface-2/60 p-3.5 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-semibold text-foreground text-[12.5px]">
                      {email.from_name || email.from_addr}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySender}
                      title="Copy sender email"
                      className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-surface-3/60 px-1.5 py-0.5 text-[10.5px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition cursor-pointer"
                    >
                      <span>{email.from_addr}</span>
                      {copiedSender ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5 opacity-60" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                    <Calendar className="h-3 w-3 text-muted-foreground/70" />
                    <span>{formattedDate}</span>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground/60">To:</span>
                    <span className="rounded bg-surface-3/80 px-1.5 py-0.5 font-mono text-[10.5px] text-foreground/80">
                      {email.to_addr || 'me'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] text-muted-foreground/60">
                      Received {relativeTime(email.received_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Subject Bar */}
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-2.5 flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <h4 className="text-[13px] font-semibold text-foreground tracking-tight">
                  {email.subject || '(no subject)'}
                </h4>
              </div>

              {/* Body Content Reading Pane with Smart URL linkification */}
              <div className="rounded-2xl border border-border/80 bg-[#0e1113] p-4.5 sm:p-5 shadow-inner">
                {parseBodyWithLinks(email.body_snippet)}
              </div>

              {/* Detected Links Tray (if any URLs in email) */}
              {extractedLinks.length > 0 && (
                <div className="rounded-xl border border-border/70 bg-surface-2/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground shrink-0">
                    <LinkIcon className="h-3.5 w-3.5 text-primary" />
                    <span>Links in email ({extractedLinks.length}):</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {extractedLinks.map((url, i) => {
                      let display = url
                      try {
                        const parsed = new URL(url)
                        display = parsed.hostname.replace(/^www\./, '')
                      } catch {}
                      return (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 hover:bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-foreground hover:text-primary transition shadow-xs cursor-pointer"
                        >
                          <span className="truncate max-w-[180px]">{display}</span>
                          <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:${email.source === 'sent' ? email.to_addr : email.from_addr}?subject=Re: ${encodeURIComponent(email.subject || '')}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 px-3.5 py-1.5 text-[12px] font-medium text-primary-foreground shadow-sm transition-all cursor-pointer"
                  >
                    <Reply className="h-3.5 w-3.5" />
                    <span>Reply</span>
                  </a>

                  <a
                    href={`https://mail.google.com/mail/u/0/#search/${encodeURIComponent(email.subject || email.from_addr)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 px-3 py-1.5 text-[12px] font-medium text-foreground transition-all cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Open in Gmail</span>
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyBody}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface-2 hover:bg-surface-3 px-3 py-1.5 text-[12px] font-medium text-foreground transition cursor-pointer"
                  >
                    {copiedBody ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied Text</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Copy Text</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggle()
                    }}
                    className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition cursor-pointer"
                  >
                    Collapse
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function PromiseRow({ promise }: { promise: Promise_ }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="rounded-xl border border-border/60 bg-card/50 p-3"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/10 text-[9px] font-semibold text-violet-300 ring-1 ring-inset ring-violet-400/20 light:text-violet-700">
          {initials(promise.who)}
        </span>
        <p className="truncate text-[12px] font-medium text-foreground/90">{promise.who}</p>
        <span className="ml-auto text-[10px] text-muted-foreground/60">
          {relativeTime(promise.created_at)}
        </span>
      </div>
      <p className="mt-1.5 pl-8 text-[11px] leading-relaxed text-muted-foreground">{promise.what}</p>
      {promise.by_when && (
        <p className="mt-0.5 pl-8 text-[10px] text-amber-400 light:text-amber-700">
          by {promise.by_when}
        </p>
      )}
    </motion.div>
  )
}

export default function EmailPage() {
  const [filter, setFilter] = useState<EmailFilter>('all')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [scanKey, setScanKey] = useState(0)
  const queryClient = useQueryClient()
  const playClick = useSound('click')
  const playChime = useSound('chime')
  const playThud = useSound('thud')

  const emailQuery = useQuery({
    queryKey: ['email', filter],
    queryFn: () => fetchEmail(filter),
  })

  const refresh = useMutation({
    mutationFn: postGmailFetch,
    onSuccess: () => {
      playChime()
      toast.success('Inbox refreshed')
      setScanKey((key) => key + 1)
      queryClient.invalidateQueries({ queryKey: ['email'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      queryClient.invalidateQueries({ queryKey: ['config'] })
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not fetch new mail')
    },
  })

  if (emailQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[200px_1fr]">
          <Skeleton className="h-56 rounded-2xl" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (emailQuery.isError || !emailQuery.data) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <PageHeader icon={Mail} eyebrow="Email" title="Inbox" />
        <ErrorPanel
          error={emailQuery.error}
          onRetry={() => emailQuery.refetch()}
          retrying={emailQuery.isFetching}
          className="mt-6"
        />
      </div>
    )
  }

  const data = emailQuery.data
  const counts = data.counts
  const emails = data.emails
  const promises = data.promises ?? []

  if (!data.connected) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <PageHeader icon={Mail} eyebrow="Email" title="Inbox" subtitle="Gmail is not connected" />
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/50">
          <EmptyCommand
            icon={MailX}
            title="No mailbox connected"
            hint="Connect Gmail in Settings to index inbox and sent mail."
          />
          <div className="flex justify-center pb-8">
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Connect Gmail <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={Mail}
        eyebrow="Email"
        title={`Email (${counts.all})`}
        subtitle={`${data.email} · ${counts.needs_reply} waiting on a reply`}
        actions={
          <Button
            size="sm"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            {refresh.isPending ? <SpinnerArc /> : <RefreshCw className="h-3.5 w-3.5" />}
            Fetch mail
          </Button>
        }
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-[200px_1fr]">
        {/* Filter rail */}
        <aside className="h-fit rounded-2xl border border-border/60 bg-card/50 p-2 backdrop-blur-xl">
          <div className="flex gap-1 overflow-x-auto lg:flex-col">
            {FILTERS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => {
                  playClick()
                  setFilter(key)
                  setExpanded(null)
                }}
                className={cn(
                  'relative flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium transition-colors cursor-pointer',
                  filter === key
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{label}</span>
                <span
                  className={cn(
                    'ml-auto rounded-full px-1.5 py-0.5 text-[9px] tabular-nums',
                    filter === key ? 'bg-primary/15 text-primary' : 'bg-surface-2 text-muted-foreground/70'
                  )}
                >
                  {counts[key]}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5 border-t border-hairline px-2.5 py-2 text-[10px] text-muted-foreground/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
            Connected
          </div>
        </aside>

        {/* List */}
        <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-2 backdrop-blur-xl">
          <AnimatePresence>
            {scanKey > 0 && filter === 'all' && (
              <motion.div
                key={scanKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10"
              >
                <div className="email-scan h-10 w-full" />
              </motion.div>
            )}
          </AnimatePresence>

          {filter === 'promises' ? (
            promises.length === 0 ? (
              <EmptyCommand
                icon={Handshake}
                title="No open promises"
                hint="Promises are detected from your sent mail."
                command="task send a follow-up with the notes"
              />
            ) : (
              <motion.div layout className="space-y-2 p-1">
                <AnimatePresence mode="popLayout">
                  {promises.map((promise) => (
                    <PromiseRow key={promise.id} promise={promise} />
                  ))}
                </AnimatePresence>
              </motion.div>
            )
          ) : emails.length === 0 ? (
            <EmptyCommand
              icon={filter === 'applications' ? Briefcase : Inbox}
              title={
                filter === 'needs_reply'
                  ? 'Inbox zero — nothing waiting on you'
                  : filter === 'applications'
                    ? 'No application emails'
                    : 'No emails indexed'
              }
              hint="Fetch mail again, or log an application."
              command="applied <company>"
            />
          ) : (
            <motion.div layout className="space-y-1.5">
              <AnimatePresence mode="popLayout" initial={false}>
                {emails.map((email) => (
                  <EmailRow
                    key={email.id}
                    email={email}
                    expanded={expanded === email.id}
                    onToggle={() => {
                      playClick()
                      setExpanded((current) => (current === email.id ? null : email.id))
                    }}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </section>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/35">
        <Sparkles className="h-2.5 w-2.5" />
        {counts.all} messages · {counts.applications} application-related
      </p>
    </div>
  )
}
