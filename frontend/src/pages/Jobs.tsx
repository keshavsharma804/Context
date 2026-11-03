import { useMemo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  FileText,
  Plus,
  Sparkles,
  X,
  ExternalLink,
  Link as LinkIcon,
  Trash2,
  Check,
  ChevronDown,
  LayoutGrid,
  Table as TableIcon,
  Search,
  MoveRight,
  Send,
  Eye,
} from 'lucide-react'
import {
  fetchJobs,
  postJobAdd,
  postJobScheduleInterview,
  postJobUpdateStatus,
  postJobDelete,
  type JobApplication,
  type JobBrief,
} from '@/lib/api'
import { shortDate, relativeTime, initials } from '@/lib/format'
import { PageHeader, ErrorPanel, EmptyCommand } from '@/components/pages/PageChrome'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SpinnerArc } from '@/components/motion/SpinnerArc'
import { PulseDot } from '@/components/motion/PulseDot'
import { useSound } from '@/hooks/useSound'
import { cn } from '@/lib/utils'

const COLUMNS = [
  { key: 'applied', label: 'Applied', accent: 'bg-violet-500', pill: 'pill-applied', color: '#8b5cf6' },
  { key: 'interview', label: 'Interview', accent: 'bg-amber-500', pill: 'pill-interview', color: '#f59e0b' },
  { key: 'offered', label: 'Offered', accent: 'bg-emerald-500', pill: 'pill-offered', color: '#10b981' },
  { key: 'rejected', label: 'Rejected', accent: 'bg-red-500', pill: 'pill-rejected', color: '#ef4444' },
] as const

type JobStatus = 'applied' | 'interview' | 'offered' | 'rejected'

function appKey(app: JobApplication) {
  return `${app.id ?? app.company}-${app.applied_at}`
}

function interviewFor(job: JobBrief, company: string) {
  return job.interviews.find((item) => item.company.toLowerCase() === company.toLowerCase())
}

/**
 * Natural language parser for quick-adding job applications
 */
function parseJobNaturalLanguage(input: string) {
  const text = input.trim()
  if (!text) return null

  let company = ''
  let role = ''
  let status: JobStatus = 'applied'
  let url = ''

  // 1. Detect URL
  const urlMatch = text.match(/https?:\/\/[^\s]+/)
  if (urlMatch) {
    url = urlMatch[0]
  }

  // 2. Detect status
  const lower = text.toLowerCase()
  if (lower.includes('interview') || lower.includes('scheduled')) {
    status = 'interview'
  } else if (lower.includes('offer') || lower.includes('offered') || lower.includes('accepted')) {
    status = 'offered'
  } else if (lower.includes('reject') || lower.includes('rejected')) {
    status = 'rejected'
  }

  // 3. Regex for "applied (for|to|as) [role] at [company]"
  const pat1 = /(?:applied|interview|offer|rejected)?\s*(?:for|as)\s+(.+?)\s+(?:at|in|with|to)\s+([A-Za-z0-9\s._&-]+)/i
  const pat2 = /(?:applied|interview|offer|rejected)?\s*(?:at|in|with|to)\s+([A-Za-z0-9\s._&-]+?)(?:\s+(?:for|as)\s+(.+))?$/i

  const m1 = text.match(pat1)
  if (m1 && m1[1] && m1[2]) {
    role = m1[1].replace(/^(applied|interview|offer|rejected)\s*/i, '').trim()
    company = m1[2].replace(/(yesterday|today|last week|via .*|on .*)/i, '').trim()
  } else {
    const m2 = text.match(pat2)
    if (m2 && m2[1]) {
      company = m2[1].replace(/(yesterday|today|last week|via .*|on .*)/i, '').trim()
      if (m2[2]) {
        role = m2[2].replace(/(yesterday|today|last week|via .*|on .*)/i, '').trim()
      }
    }
  }

  if (!company) {
    const words = text.split(/\s+/)
    company = words[0] || ''
  }

  return { company, role, status, url }
}

/**
 * Custom tactile Document selector (Portaled with compact height so no modal scroller appears)
 */
function DocumentSelector({
  value,
  onChange,
  docs,
}: {
  value: string
  onChange: (val: string) => void
  docs: { name: string; path: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [coords, setCoords] = useState<{ left: number; top: number; width: number; dropUp: boolean } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updateCoords = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const dropUp = spaceBelow < 180
      setCoords({
        left: rect.left,
        width: rect.width,
        top: dropUp ? rect.top : rect.bottom,
        dropUp,
      })
    }
  }

  const handleToggle = () => {
    if (!open) {
      updateCoords()
      setOpen(true)
    } else {
      setOpen(false)
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        ref.current && !ref.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleScrollOrResize = () => updateCoords()
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [open])

  const selectedDoc = docs.find((d) => d.name === value)

  const filteredDocs = useMemo(() => {
    if (!search.trim()) return docs
    return docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
  }, [docs, search])

  return (
    <div ref={ref} className="relative w-full">
      <div className="flex w-full items-center gap-2 rounded-xl border border-border/80 bg-surface-inset px-3 py-2 text-xs transition-all hover:border-primary/40 focus-within:border-primary/50">
        <button
          type="button"
          onClick={handleToggle}
          className="flex flex-1 items-center gap-2 truncate text-left cursor-pointer focus:outline-none"
        >
          <FileText className={cn('h-3.5 w-3.5 shrink-0', selectedDoc ? 'text-primary' : 'text-muted-foreground/60')} />
          <span className={cn('truncate', selectedDoc ? 'text-foreground font-semibold' : 'text-muted-foreground/70')}>
            {selectedDoc ? selectedDoc.name : 'No CV attached (Click to select from detected resumes)'}
          </span>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {selectedDoc && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
              className="rounded-md p-0.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition cursor-pointer"
              title="Remove CV attachment"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={handleToggle}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground transition cursor-pointer focus:outline-none"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-150', open && 'rotate-180')} />
          </button>
        </div>
      </div>

      {typeof document !== 'undefined' && open && coords && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            top: coords.dropUp ? undefined : `${coords.top + 4}px`,
            bottom: coords.dropUp ? `${window.innerHeight - coords.top + 4}px` : undefined,
            zIndex: 150,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: coords.dropUp ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: coords.dropUp ? 4 : -4 }}
            transition={{ duration: 0.12 }}
            className="max-h-36 overflow-hidden rounded-xl border border-border/90 bg-[#14171a] shadow-2xl backdrop-blur-2xl flex flex-col"
          >
            {docs.length > 3 && (
              <div className="p-1.5 border-b border-border/60 bg-surface-1/60 shrink-0">
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter documents…"
                  className="w-full rounded-lg border border-border/70 bg-surface-inset px-2.5 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-1 space-y-0.5 max-h-32">
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-xs transition text-left cursor-pointer',
                  !value ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                )}
              >
                <span>None (No CV attached)</span>
                {!value && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>

              {filteredDocs.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-muted-foreground/60 italic">
                  No matching documents
                </p>
              ) : (
                filteredDocs.map((doc) => {
                  const isSelected = value === doc.name
                  return (
                    <button
                      key={doc.path}
                      type="button"
                      onClick={() => {
                        onChange(doc.name)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-xs transition text-left cursor-pointer',
                        isSelected ? 'bg-primary/15 text-primary font-semibold' : 'text-foreground hover:bg-surface-2'
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{doc.name}</span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  )
}

/**
 * Quick status switcher dropdown on Card
 */
function StatusQuickSwitch({
  currentStatus,
  onSelect,
}: {
  currentStatus: string
  onSelect: (st: JobStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'pill-' + currentStatus,
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-medium capitalize leading-none hover:opacity-90 cursor-pointer shadow-xs transition'
        )}
        title="Click to move status"
      >
        <span>{currentStatus}</span>
        <ChevronDown className="h-2.5 w-2.5 opacity-60" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1.5 z-40 w-32 rounded-xl border border-border/90 bg-[#14171a] p-1 shadow-2xl backdrop-blur-2xl"
          >
            <div className="px-2 py-1 text-[9px] font-mono uppercase text-muted-foreground/70">
              Move to:
            </div>
            {COLUMNS.map((col) => (
              <button
                key={col.key}
                type="button"
                onClick={() => {
                  onSelect(col.key)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2 py-1 text-[11px] font-medium capitalize transition cursor-pointer',
                  col.key === currentStatus
                    ? 'bg-surface-3 text-primary font-semibold'
                    : 'text-foreground hover:bg-surface-2'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-1.5 w-1.5 rounded-full', col.accent)} />
                  <span>{col.label}</span>
                </div>
                {col.key === currentStatus && <Check className="h-3 w-3 text-primary" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Kanban Job Card (Draggable, with quick status moves & rich tags)
 */
function JobCard({
  app,
  job,
  onOpen,
  onStatusChange,
  shared = true,
}: {
  app: JobApplication
  job: JobBrief
  onOpen: () => void
  onStatusChange: (newStatus: JobStatus) => void
  shared?: boolean
}) {
  const interview = interviewFor(job, app.company)
  const prepCount = interview?.prep_docs?.length ?? 0

  return (
    <motion.div
      layout
      layoutId={shared ? `job-${appKey(app)}` : undefined}
      initial={{ opacity: 0, y: -18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      draggable
      onDragStart={(e: any) => {
        e.dataTransfer.setData(
          'application/json',
          JSON.stringify({ id: app.id, company: app.company, currentStatus: app.status })
        )
      }}
      onClick={onOpen}
      className="group relative w-full rounded-2xl border border-border/70 bg-card/60 p-3.5 text-left transition-all hover:border-primary/40 hover:bg-surface-2 hover:shadow-[0_10px_28px_-14px_hsl(var(--primary)/0.35)] cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">
            {app.company}
          </p>
          <p className="truncate text-[11px] text-muted-foreground mt-0.5">
            {app.role || 'Role not set'}
          </p>
        </div>

        {/* Quick status dropdown on card */}
        <StatusQuickSwitch
          currentStatus={app.status}
          onSelect={(newSt) => onStatusChange(newSt)}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/75">
        <span className="flex items-center gap-1 font-mono">
          <CalendarDays className="h-2.5 w-2.5" />
          {shortDate(app.applied_at)}
        </span>

        {app.cv_file && (
          <span className="flex items-center gap-1 rounded bg-surface-3/80 px-1.5 py-0.5 font-mono text-foreground/80 truncate max-w-[150px]">
            <FileText className="h-2.5 w-2.5 text-primary shrink-0" />
            <span className="truncate">{app.cv_file}</span>
          </span>
        )}

        {app.url && (
          <a
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-0.5 text-primary hover:underline"
            title="Open job post"
          >
            <LinkIcon className="h-2.5 w-2.5" />
            <span>Link</span>
          </a>
        )}
      </div>

      {app.status === 'interview' && prepCount > 0 && (
        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[9.5px] font-medium text-amber-400">
          <PulseDot color="bg-amber-400" size="w-1.5 h-1.5" />
          <span>📄 {prepCount} prep {prepCount === 1 ? 'doc' : 'docs'}</span>
        </div>
      )}

      {interview?.scheduled_at && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
          <span className="flex items-center gap-1 font-mono truncate">
            <CalendarDays className="h-3 w-3 shrink-0 text-amber-400" />
            <span className="truncate">{interview.scheduled_at}</span>
          </span>
          <a
            href="/calendar"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 ml-1 text-primary hover:underline font-semibold"
            title="View in Calendar"
          >
            Cal ↗
          </a>
        </div>
      )}

      {/* Quick Move Next Pill on Hover */}
      <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] text-primary flex items-center gap-1 font-medium">
          Open details <ArrowRight className="h-2.5 w-2.5" />
        </span>
        <span className="text-[9.5px] font-mono text-muted-foreground/50">
          drag to move
        </span>
      </div>
    </motion.div>
  )
}

/**
 * Job Detail Modal
 */
function JobDetailModal({
  app,
  job,
  onClose,
  onStatusChange,
  onDelete,
}: {
  app: JobApplication
  job: JobBrief
  onClose: () => void
  onStatusChange: (status: JobStatus) => void
  onDelete: (id: number | undefined, company: string) => void
}) {
  const queryClient = useQueryClient()
  const playChime = useSound('chime')
  const interview = interviewFor(job, app.company)
  const prepDocs = interview?.prep_docs ?? []

  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [interviewTime, setInterviewTime] = useState(interview?.scheduled_at || '')
  const [interviewNote, setInterviewNote] = useState('')

  const scheduleMutation = useMutation({
    mutationFn: () =>
      postJobScheduleInterview({
        company: app.company,
        role: app.role || undefined,
        scheduled_at: interviewTime,
        notes: interviewNote || undefined,
      }),
    onSuccess: (res) => {
      playChime()
      toast.success(res.message || 'Interview scheduled & linked to Calendar!')
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      setShowScheduleForm(false)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to schedule interview')
    },
  })

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start sm:justify-center overflow-y-auto p-3 sm:p-4 pt-16 sm:pt-20 pb-6">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
      />
      <div className="relative my-auto w-full max-w-lg max-h-[calc(100vh-6rem)] flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-[#121518] shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3.5 bg-surface-1/40 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-primary font-semibold">
                {app.role || 'Job Application'}
              </span>
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-foreground">{app.company}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3.5 p-4 sm:p-5">
          {/* Status Segmented Control */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground/75 mb-1.5">
              Current Application Status:
            </label>
            <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-border/80 bg-surface-inset p-1">
              {COLUMNS.map((col) => {
                const isSelected = app.status === col.key
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => onStatusChange(col.key)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold capitalize transition cursor-pointer',
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', isSelected ? 'bg-primary-foreground' : col.accent)} />
                    <span>{col.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Meta Bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-muted-foreground">
              Applied on {shortDate(app.applied_at)} ({relativeTime(app.applied_at)})
            </span>

            {app.cv_file && (
              <span className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-foreground">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>{app.cv_file}</span>
              </span>
            )}

            {app.url && (
              <a
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-primary hover:bg-primary/20 transition cursor-pointer"
              >
                <LinkIcon className="h-3 w-3" />
                <span>Open Job Post ↗</span>
              </a>
            )}
          </div>

          {/* Job Description (JD) if set */}
          {app.jd && (
            <div className="rounded-xl border border-border/70 bg-[#0e1113] p-3.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/75 block mb-1.5">
                Job Description & Notes
              </span>
              <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap font-sans">
                {app.jd}
              </p>
            </div>
          )}

          {app.notes && !app.jd && (
            <div className="rounded-xl border border-border/70 bg-surface-inset p-3 text-xs leading-relaxed text-muted-foreground">
              {app.notes}
            </div>
          )}

          {/* Interview & Calendar Sync Section */}
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                <CalendarDays className="h-4 w-4" />
                <span>{interview ? 'Interview Scheduled' : 'Calendar & Interview'}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/calendar"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <span>Open Calendar ↗</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowScheduleForm((v) => !v)}
                  className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/30 transition cursor-pointer"
                >
                  {interview ? (showScheduleForm ? 'Hide' : 'Reschedule') : (showScheduleForm ? 'Hide' : '+ Schedule')}
                </button>
              </div>
            </div>

            {interview && !showScheduleForm && (
              <div className="flex items-center justify-between bg-black/20 rounded-xl px-3 py-2 text-xs">
                <span className="font-mono text-amber-200 font-medium">{interview.scheduled_at}</span>
                <span className="text-[10px] text-muted-foreground">Synced with Calendar</span>
              </div>
            )}

            {showScheduleForm && (
              <div className="space-y-2 pt-1 border-t border-amber-500/20">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-amber-300/80">
                  Select Interview Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                  className="w-full rounded-xl border border-amber-500/30 bg-surface-inset px-3 py-2 text-xs text-foreground focus:outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  placeholder="Notes (e.g. Round 1 Technical, Zoom link)"
                  value={interviewNote}
                  onChange={(e) => setInterviewNote(e.target.value)}
                  className="w-full rounded-xl border border-border/80 bg-surface-inset px-3 py-1.5 text-xs text-foreground focus:outline-none"
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowScheduleForm(false)}
                    className="text-xs h-7 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!interviewTime || scheduleMutation.isPending}
                    onClick={() => scheduleMutation.mutate()}
                    className="bg-amber-500 text-black hover:bg-amber-400 font-bold text-xs h-7 cursor-pointer"
                  >
                    {scheduleMutation.isPending ? 'Scheduling…' : 'Save to Calendar 📅'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Prep Documents */}
          <div>
            <p className="mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
              Prep Documents ({prepDocs.length})
            </p>
            {prepDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic rounded-lg border border-dashed border-border/60 p-3 text-center">
                No prep documents detected for this company.
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {prepDocs.map((doc: { name?: string; path?: string }, index: number) => (
                  <li
                    key={`${doc.path ?? doc.name}-${index}`}
                    className="flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2 text-xs"
                  >
                    <FileText className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-foreground/90 font-medium">
                      {doc.name ?? doc.path ?? 'Document'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="px-5 py-3 flex items-center justify-between border-t border-border/60 bg-surface-1/30 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete application for ${app.company}?`)) {
                onDelete(app.id, app.company)
                onClose()
              }
            }}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Application</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-surface-2 hover:bg-surface-3 px-4 py-1.5 text-xs font-medium text-foreground transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/**
 * Add Job Application Modal (With Natural Language Fast-Add, Title, JD, URL, Tactile CV Selector)
 */
function AddJobDialog({
  job,
  onClose,
}: {
  job: JobBrief
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const playChime = useSound('chime')
  const playThud = useSound('thud')
  const playPop = useSound('pop')

  // Form states
  const [naturalInput, setNaturalInput] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [url, setUrl] = useState('')
  const [jd, setJd] = useState('')
  const [status, setStatus] = useState<JobStatus>('applied')
  const [cv, setCv] = useState('') // Optional!
  const [interviewAt, setInterviewAt] = useState('')

  const add = useMutation({
    mutationFn: () =>
      postJobAdd({
        company: company.trim(),
        role: role.trim() || undefined,
        cv_file: cv.trim() || undefined,
        url: url.trim() || undefined,
        jd: jd.trim() || undefined,
        status,
        interview_at: status === 'interview' && interviewAt ? interviewAt : undefined,
      }),
    onSuccess: (result) => {
      playChime()
      toast.success(result.message || 'Application added')
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      queryClient.invalidateQueries({ queryKey: ['config'] })
      onClose()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not add application')
    },
  })

  // Handle Natural Language Fast-Fill
  const handleNaturalParse = () => {
    if (!naturalInput.trim()) return
    const parsed = parseJobNaturalLanguage(naturalInput)
    if (parsed) {
      if (parsed.company) setCompany(parsed.company)
      if (parsed.role) setRole(parsed.role)
      if (parsed.status) setStatus(parsed.status)
      if (parsed.url) setUrl(parsed.url)
      playPop()
      toast.success('Extracted application details!')
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start sm:justify-center overflow-y-auto p-3 sm:p-4 pt-16 sm:pt-20 pb-6">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
      />
      <motion.form
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        onSubmit={(event) => {
          event.preventDefault()
          if (!company.trim() || add.isPending) return
          add.mutate()
        }}
        className="relative my-auto w-full max-w-xl max-h-[calc(100vh-6rem)] flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-[#121518] shadow-2xl backdrop-blur-2xl z-10"
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3 bg-surface-1/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Briefcase className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Add Job Application</h2>
              <p className="text-[10.5px] text-muted-foreground">Track roles, JDs, links, and interview prep</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3.5 space-y-3">
          {/* Natural Language AI Fast-Fill Bar */}
          <div className="rounded-xl border border-primary/25 bg-primary/[0.05] p-2.5">
            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-primary mb-1">
              <Sparkles className="h-3 w-3" />
              <span>AI Fast-Add with Natural Language</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={naturalInput}
                onChange={(e) => setNaturalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleNaturalParse()
                  }
                }}
                placeholder="e.g. Applied to Stripe for Senior Frontend Engineer via LinkedIn"
                className="flex-1 rounded-lg border border-border/80 bg-surface-inset px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleNaturalParse}
                disabled={!naturalInput.trim()}
                className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition cursor-pointer shrink-0"
              >
                <span>Auto-Fill</span>
              </button>
            </div>
          </div>

          {/* Company Name & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1">
                Company Name *
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                <input
                  required
                  autoFocus
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Google, Stripe, Uber"
                  className="w-full rounded-xl border border-border/80 bg-surface-inset pl-9 pr-3 py-2 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1">
                Role / Title
              </label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                className="w-full rounded-xl border border-border/80 bg-surface-inset px-3 py-2 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1">
              Initial Status
            </label>
            <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-border/80 bg-surface-inset p-1">
              {COLUMNS.map((col) => (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => setStatus(col.key)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold capitalize transition cursor-pointer',
                    status === col.key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', status === col.key ? 'bg-primary-foreground' : col.accent)} />
                  <span>{col.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* If Status is Interview, show Interview Date & Time */}
          {status === 'interview' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-2.5 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Interview Date & Time (Calendar Sync)</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                📅 Automatically schedules this interview into your Calendar
              </p>
              <input
                type="datetime-local"
                value={interviewAt}
                onChange={(e) => setInterviewAt(e.target.value)}
                className="w-full rounded-xl border border-amber-500/30 bg-surface-inset px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-amber-400"
              />
            </div>
          )}

          {/* Connected Document / CV (Full Width Dedicated Row) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Connected Document / CV
              </label>
              <span className="text-[9.5px] text-muted-foreground/60">Optional</span>
            </div>
            <DocumentSelector
              value={cv}
              onChange={(val) => setCv(val)}
              docs={job.cvs}
            />
          </div>

          {/* Job Post URL */}
          <div>
            <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1">
              Job Post URL (optional)
            </label>
            <div className="relative">
              <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://jobs.lever.co/company/... or LinkedIn URL"
                className="w-full rounded-xl border border-border/80 bg-surface-inset pl-9 pr-3 py-2 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Job Description (JD) / Requirements */}
          <div>
            <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1">
              Job Description (JD) / Key Notes (optional)
            </label>
            <textarea
              rows={2}
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste job requirements, tech stack, salary range, or notes here…"
              className="w-full rounded-xl border border-border/80 bg-surface-inset p-2.5 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 leading-relaxed font-sans"
            />
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-border/60 bg-surface-1/40 shrink-0">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} sound={false} className="cursor-pointer text-xs h-8">
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!company.trim() || add.isPending} className="cursor-pointer text-xs h-8">
            {add.isPending ? <SpinnerArc /> : <Sparkles className="h-3.5 w-3.5" />}
            <span>Add Application</span>
          </Button>
        </div>
      </motion.form>
    </div>,
    document.body
  )
}

/**
 * Main Job Search Page with Kanban & Table Views, Drag-and-Drop, and Quick Actions
 */
export default function Jobs() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')
  const [tableFilter, setTableFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<JobApplication | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const playClick = useSound('click')
  const playChime = useSound('chime')
  const playThud = useSound('thud')

  const jobsQuery = useQuery({ queryKey: ['jobs'], queryFn: fetchJobs })

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: (payload: { id?: number; company: string; status: JobStatus }) =>
      postJobUpdateStatus(payload),
    onSuccess: (data, vars) => {
      playChime()
      toast.success(`Moved ${vars.company} to ${vars.status}`)
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
    },
    onError: (err: any) => {
      playThud()
      toast.error(err.message || 'Failed to update status')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (payload: { id?: number; company: string }) => postJobDelete(payload),
    onSuccess: (_, vars) => {
      playChime()
      toast.success(`Deleted application for ${vars.company}`)
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
    },
    onError: (err: any) => {
      playThud()
      toast.error(err.message || 'Failed to delete application')
    },
  })

  // Group applications for Kanban
  const grouped = useMemo(() => {
    const job = jobsQuery.data
    const map: Record<string, JobApplication[]> = {
      applied: [],
      interview: [],
      offered: [],
      rejected: [],
    }
    job?.applications.forEach((app) => {
      const key = map[app.status] ? app.status : 'applied'
      map[key].push(app)
    })
    return map
  }, [jobsQuery.data])

  // Filtered applications for Table view
  const tableApplications = useMemo(() => {
    const apps = jobsQuery.data?.applications || []
    return apps.filter((app) => {
      const matchesStatus = tableFilter === 'all' || app.status === tableFilter
      const matchesSearch =
        !searchQuery.trim() ||
        app.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.role && app.role.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchesStatus && matchesSearch
    })
  }, [jobsQuery.data?.applications, tableFilter, searchQuery])

  // Drag-and-drop drop handler
  const handleDrop = (targetCol: JobStatus, e: React.DragEvent) => {
    e.preventDefault()
    setDragOverCol(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      if (data && data.company && data.currentStatus !== targetCol) {
        updateStatusMutation.mutate({
          id: data.id,
          company: data.company,
          status: targetCol,
        })
      }
    } catch {}
  }

  if (jobsQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (jobsQuery.isError || !jobsQuery.data) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <PageHeader icon={Briefcase} eyebrow="Jobs" title="Job search" />
        <ErrorPanel
          error={jobsQuery.error}
          onRetry={() => jobsQuery.refetch()}
          retrying={jobsQuery.isFetching}
          className="mt-6"
        />
      </div>
    )
  }

  const job = jobsQuery.data
  const total = job.applications.length

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
      {/* Page Header with View Switcher */}
      <PageHeader
        icon={Briefcase}
        eyebrow="Jobs"
        title="Job search"
        subtitle={`${total} applications · ${job.interviews.length} interviews · ${job.detected_companies.length} companies detected`}
        actions={
          <div className="flex items-center gap-2.5">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-border/80 bg-surface-1 p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => {
                  playClick()
                  setViewMode('kanban')
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer',
                  viewMode === 'kanban'
                    ? 'bg-foreground text-background shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Board Kanban View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Board</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClick()
                  setViewMode('table')
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer',
                  viewMode === 'table'
                    ? 'bg-foreground text-background shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Spreadsheet Table View"
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            <Button
              size="sm"
              onClick={() => {
                playClick()
                setAdding(true)
              }}
              className="cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add application</span>
            </Button>
          </div>
        }
      />

      {total === 0 ? (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/50">
          <EmptyCommand
            icon={Briefcase}
            title="No applications yet"
            hint="Add one with the button above or use natural language fast-add."
            command="applied <company>"
          />
        </div>
      ) : viewMode === 'kanban' ? (
        /* ========================================================================= */
        /* VIEW 1: KANBAN BOARD VIEW (Drag & Drop + Quick Status Move)               */
        /* ========================================================================= */
        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          {COLUMNS.map((column, columnIndex) => {
            const isDragOver = dragOverCol === column.key
            return (
              <motion.section
                key={column.key}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: columnIndex * 0.08, duration: 0.35 }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOverCol(column.key)
                }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => handleDrop(column.key, e)}
                className={cn(
                  'flex min-h-[320px] flex-col rounded-2xl border bg-card/35 p-2.5 backdrop-blur-xl transition-all duration-200',
                  isDragOver
                    ? 'border-primary bg-primary/[0.08] ring-2 ring-primary/30 scale-[1.01]'
                    : 'border-border/60'
                )}
              >
                <div className="flex items-center gap-2 px-1.5 py-2 mb-1">
                  <span className={cn('h-2 w-2 rounded-full', column.accent)} />
                  <h2 className="text-xs font-bold text-foreground">{column.label}</h2>
                  <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-mono tabular-nums text-muted-foreground">
                    {grouped[column.key].length}
                  </span>
                </div>

                <div className="space-y-2 flex-1">
                  <AnimatePresence mode="popLayout">
                    {grouped[column.key].map((app) => (
                      <JobCard
                        key={appKey(app)}
                        app={app}
                        job={job}
                        shared={!selected || appKey(selected) !== appKey(app)}
                        onOpen={() => {
                          playClick()
                          setSelected(app)
                        }}
                        onStatusChange={(newSt) => {
                          updateStatusMutation.mutate({
                            id: app.id,
                            company: app.company,
                            status: newSt,
                          })
                        }}
                      />
                    ))}
                  </AnimatePresence>

                  {grouped[column.key].length === 0 && (
                    <div
                      className={cn(
                        'flex flex-col items-center justify-center h-44 rounded-xl border border-dashed text-center p-4 transition-colors',
                        isDragOver
                          ? 'border-primary/60 bg-primary/10 text-primary'
                          : 'border-border/60 text-muted-foreground/40'
                      )}
                    >
                      <p className="text-xs font-medium">
                        {isDragOver ? `Drop to move to ${column.label}` : 'Nothing here yet'}
                      </p>
                      <span className="text-[10px] mt-0.5">Drag cards here</span>
                    </div>
                  )}
                </div>
              </motion.section>
            )
          })}
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW 2: TABLE SPREADSHEET VIEW                                            */
        /* ========================================================================= */
        <div className="mt-5 space-y-3">
          {/* Table Search & Status Filter Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-2xl border border-border/80 bg-card/60 p-2.5 backdrop-blur-xl">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setTableFilter('all')}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer',
                  tableFilter === 'all'
                    ? 'bg-foreground text-background font-semibold shadow-xs'
                    : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                )}
              >
                All ({total})
              </button>
              {COLUMNS.map((col) => (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => setTableFilter(col.key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition cursor-pointer',
                    tableFilter === col.key
                      ? 'bg-foreground text-background font-semibold shadow-xs'
                      : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', col.accent)} />
                  <span>{col.label} ({grouped[col.key].length})</span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search company or role…"
                className="w-full rounded-xl border border-border/80 bg-surface-inset pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card/40 backdrop-blur-xl shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-surface-1/60 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Company & Role</th>
                  <th className="px-4 py-3 font-semibold">Status (Click to Move)</th>
                  <th className="px-4 py-3 font-semibold">Applied Date</th>
                  <th className="px-4 py-3 font-semibold">Connected CV</th>
                  <th className="px-4 py-3 font-semibold">Job Post</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {tableApplications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground text-xs">
                      No applications match your filter.
                    </td>
                  </tr>
                ) : (
                  tableApplications.map((app) => (
                    <tr
                      key={appKey(app)}
                      onClick={() => setSelected(app)}
                      className="group hover:bg-surface-2/70 transition-colors cursor-pointer"
                    >
                      {/* Company & Role */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-[10px] shrink-0">
                            {initials(app.company)}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors block truncate">
                              {app.company}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate block">
                              {app.role || 'Role not set'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusQuickSwitch
                          currentStatus={app.status}
                          onSelect={(newSt) => {
                            updateStatusMutation.mutate({
                              id: app.id,
                              company: app.company,
                              status: newSt,
                            })
                          }}
                        />
                      </td>

                      {/* Applied Date */}
                      <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                        {shortDate(app.applied_at)}
                      </td>

                      {/* Connected CV */}
                      <td className="px-4 py-3">
                        {app.cv_file ? (
                          <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-[10.5px] font-mono text-foreground/80 max-w-[180px] truncate">
                            <FileText className="h-2.5 w-2.5 text-primary shrink-0" />
                            <span className="truncate">{app.cv_file}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 italic text-[11px]">None</span>
                        )}
                      </td>

                      {/* Job Post URL */}
                      <td className="px-4 py-3">
                        {app.url ? (
                          <a
                            href={app.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-[11px]"
                          >
                            <span>Link</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/40 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {interviewFor(job, app.company)?.scheduled_at && (
                            <a
                              href="/calendar"
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-lg p-1 text-amber-400 hover:bg-amber-500/15 transition cursor-pointer"
                              title={`Interview: ${interviewFor(job, app.company)?.scheduled_at}. View in Calendar`}
                            >
                              <CalendarDays className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelected(app)}
                            className="rounded-lg p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground transition cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete application for ${app.company}?`)) {
                                deleteMutation.mutate({ id: app.id, company: app.company })
                              }
                            }}
                            className="rounded-lg p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detected Companies Chips */}
      {job.detected_companies.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-card/40 px-3.5 py-2.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70">
            Detected:
          </span>
          {job.detected_companies.slice(0, 10).map((company) => (
            <Badge key={company} variant="secondary" className="cursor-pointer hover:border-primary/40">
              {company}
            </Badge>
          ))}
          {job.detected_companies.length > 10 && (
            <span className="text-[10px] text-muted-foreground/60">
              +{job.detected_companies.length - 10} more
            </span>
          )}
        </div>
      )}

      {/* Add / Detail Modals */}
      <AnimatePresence>
        {adding && <AddJobDialog job={job} onClose={() => setAdding(false)} />}
        {selected && (
          <JobDetailModal
            app={selected}
            job={job}
            onClose={() => setSelected(null)}
            onStatusChange={(newSt) => {
              updateStatusMutation.mutate({
                id: selected.id,
                company: selected.company,
                status: newSt,
              })
              setSelected((prev) => (prev ? { ...prev, status: newSt } : null))
            }}
            onDelete={(id, comp) => {
              deleteMutation.mutate({ id, company: comp })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
