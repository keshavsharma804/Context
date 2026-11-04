import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  MapPin,
  Plus,
  RefreshCw,
  Upload,
  X,
  Receipt,
  HandCoins,
  Coins,
  Sparkles,
  Trash2,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  Briefcase,
} from 'lucide-react'
import {
  fetchCalendar,
  postCalendarUpload,
  postCalendarEvent,
  deleteCalendarEvent,
  postMoneyAdd,
  postDebtAdd,
  postJobAdd,
  fetchConfig,
  type CalEvent,
  type CalSpend,
  type CalDebt,
  type JobApplication,
} from '@/lib/api'
import { PageHeader, ErrorPanel, EmptyCommand } from '@/components/pages/PageChrome'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SpinnerArc } from '@/components/motion/SpinnerArc'
import { useSound } from '@/hooks/useSound'
import { cn } from '@/lib/utils'
import { money, parseLocalDay } from '@/lib/format'

const HOURS = Array.from({ length: 15 }, (_, index) => index + 8) // 8am → 10pm
const PX_PER_HOUR = 48

const CATEGORY_TONE: Record<string, { block: string; dot: string; text: string }> = {
  office: {
    block: 'border-amber-500/50 bg-amber-500/12 hover:bg-amber-500/20',
    dot: 'bg-amber-400',
    text: 'text-amber-300 light:text-amber-700',
  },
  academic: {
    block: 'border-blue-500/50 bg-blue-500/12 hover:bg-blue-500/20',
    dot: 'bg-blue-400',
    text: 'text-blue-300 light:text-blue-700',
  },
  interview: {
    block: 'border-red-500/50 bg-red-500/12 hover:bg-red-500/20',
    dot: 'bg-red-400',
    text: 'text-red-300 light:text-red-700',
  },
  personal: {
    block: 'border-emerald-500/50 bg-emerald-500/12 hover:bg-emerald-500/20',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300 light:text-emerald-700',
  },
  other: {
    block: 'border-violet-500/50 bg-violet-500/12 hover:bg-violet-500/20',
    dot: 'bg-violet-400',
    text: 'text-violet-300 light:text-violet-700',
  },
}

function tone(category?: string | null) {
  return CATEGORY_TONE[(category || 'other').toLowerCase()] ?? CATEGORY_TONE.other
}

function sameDay(value: string, day: Date) {
  try {
    return isSameDay(new Date(value), day)
  } catch {
    return false
  }
}

function clock(value: string) {
  try {
    return format(new Date(value), 'HH:mm')
  } catch {
    return ''
  }
}

function minutesOfDay(value: string) {
  const date = new Date(value)
  return date.getHours() * 60 + date.getMinutes()
}

function eventTop(event: CalEvent) {
  const minutes = minutesOfDay(event.start_at) - 8 * 60
  return Math.max(0, (minutes / 60) * PX_PER_HOUR)
}

function eventHeight(event: CalEvent) {
  const start = new Date(event.start_at).getTime()
  const end = new Date(event.end_at).getTime()
  const minutes = Math.max(20, (end - start) / 60_000)
  return Math.max(22, (minutes / 60) * PX_PER_HOUR - 2)
}

/** Side-by-side lanes so colliding events stay readable instead of stacking. */
function layoutEvents(events: CalEvent[]) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  )
  const laneEnds: number[] = []
  const placed = sorted.map((event) => {
    const start = new Date(event.start_at).getTime()
    const end = Math.max(start + 1, new Date(event.end_at).getTime())
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }
    return { event, lane }
  })
  return placed.map(({ event, lane }) => {
    const start = new Date(event.start_at).getTime()
    const end = new Date(event.end_at).getTime()
    const overlaps = sorted.filter((other) => {
      if (other === event) return false
      const otherStart = new Date(other.start_at).getTime()
      const otherEnd = new Date(other.end_at).getTime()
      return otherStart < end && otherEnd > start
    }).length
    return { event, lane, lanes: overlaps + 1 }
  })
}

// ─── AI NATURAL LANGUAGE PARSER FOR CALENDAR ITEMS ───────────────────────────

function parseCalendarItemNLP(raw: string) {
  const text = raw.trim()
  if (!text) return null
  const lower = text.toLowerCase()

  // 1. Debt Detection: 'lent ... to', 'borrowed ... from', 'owe', etc.
  if (/(?:lent|lend|gave|loaned|borrowed|borrow|got loan|owe)\b/i.test(lower)) {
    const isLent = /(?:lent|lend|gave|loaned)\b/i.test(lower)
    const amountMatch = text.match(/(?:(?:rs\.?|inr|₹)\s*)?(\d+(?:\.\d{1,2})?)/i)
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0

    let person = ''
    const personMatch = text.match(/(?:to|from|with)\s+([A-Za-z]+)/i)
    if (personMatch) {
      person = personMatch[1].trim()
    } else {
      const words = text.split(/\s+/)
      const candidate = words.find(
        (w) => /^[A-Z][a-z]+$/.test(w) && !['Lent', 'Borrowed', 'Rs', 'Inr', 'For'].includes(w)
      )
      if (candidate) person = candidate
    }

    return {
      type: 'debt' as const,
      direction: (isLent ? 'lent' : 'borrowed') as 'lent' | 'borrowed',
      amount,
      person: person ? person.charAt(0).toUpperCase() + person.slice(1) : 'Friend',
      notes: text,
    }
  }

  // 2. Spend Detection: starts with amount or has currency or mentions expense keywords
  const isSpend =
    /(?:paid|spent|bought|buy|coffee|lunch|dinner|uber|swiggy|zomato|amazon|grocery|tea|chai|food)\b/i.test(lower) ||
    /^(?:(?:rs\.?|inr|₹)\s*)?\d+(?:\.\d{1,2})?\s+[a-z]/i.test(lower)

  if (isSpend) {
    const amountMatch = text.match(/(?:(?:rs\.?|inr|₹)\s*)?(\d+(?:\.\d{1,2})?)/i)
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0
    let merchant = text
      .replace(/(?:(?:rs\.?|inr|₹)\s*)?\d+(?:\.\d{1,2})?/gi, '')
      .replace(/\b(?:paid|spent|bought|buy|for|at|on)\b/gi, '')
      .replace(/^[,\s.-]+|[,\s.-]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    let category = 'food'
    if (/(?:uber|ola|cab|auto|flight|train|metro|travel|petrol|fuel)/i.test(lower)) category = 'transport'
    else if (/(?:amazon|flipkart|myntra|clothes|shirt|shoes|shopping|gear)/i.test(lower)) category = 'shopping'
    else if (/(?:bill|electricity|water|wifi|recharge|rent)/i.test(lower)) category = 'bills'

    return {
      type: 'spend' as const,
      amount,
      merchant: merchant ? merchant.charAt(0).toUpperCase() + merchant.slice(1) : 'Expense',
      category,
    }
  }

  // 3. Job Application / Interview Logging
  if (/(?:applied|applied to|interview with|interview at|job offer|got offer)\s+/i.test(lower)) {
    let company = ''
    let role = ''
    let jobStatus = 'applied'
    if (/interview/i.test(lower)) jobStatus = 'interview'
    else if (/offer/i.test(lower)) jobStatus = 'offered'
    else if (/reject/i.test(lower)) jobStatus = 'rejected'

    const m = text.match(/(?:applied|interview|offer|rejected)?\s*(?:for|as)?\s*(.+?)\s+(?:at|to|in|with)\s+([A-Za-z0-9\s._&-]+)/i)
    if (m && m[1] && m[2]) {
      role = m[1].replace(/^(applied|interview|offer|rejected)\s*/i, '').trim()
      company = m[2].replace(/(today|yesterday|tomorrow|at \d+.*)/i, '').trim()
    } else {
      const cleaned = text.replace(/^(?:applied\s+(?:to\s+)?|interview\s+(?:at\s+|with\s+)?|offer\s+(?:from\s+)?)/i, '').trim()
      const parts = cleaned.split(/\s+/)
      company = parts[0] || 'Company'
      if (parts.length > 1) role = parts.slice(1).join(' ')
    }

    return {
      type: 'job' as const,
      company: company.charAt(0).toUpperCase() + company.slice(1),
      role,
      status: jobStatus,
    }
  }

  // 4. Otherwise Default: Scheduled Event / Appointment
  let startTime = '10:00'
  let endTime = '11:00'

  const timeMatch = lower.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10)
    const m = timeMatch[2] ? timeMatch[2] : '00'
    const ampm = timeMatch[3]
    if (ampm === 'pm' && h < 12) h += 12
    if (ampm === 'am' && h === 12) h = 0
    startTime = String(h).padStart(2, '0') + ':' + m
    const endH = (h + 1) % 24
    endTime = String(endH).padStart(2, '0') + ':' + m
  }

  let title = text
    .replace(/(?:at|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, '')
    .replace(/\b(?:today|tomorrow)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  let category = 'personal'
  if (/(?:meeting|standup|review|call|sync|client|office|work|sprint)/i.test(lower)) category = 'office'
  else if (/(?:interview|screening|round)/i.test(lower)) category = 'interview'
  else if (/(?:class|lecture|lab|exam|viva|assignment|college)/i.test(lower)) category = 'academic'

  return {
    type: 'event' as const,
    title: title ? title.charAt(0).toUpperCase() + title.slice(1) : 'Scheduled Event',
    startTime,
    endTime,
    category,
    location: '',
  }
}

// ─── UPLOAD ICS MODAL ────────────────────────────────────────────────────────

function UploadDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const playChime = useSound('chime')
  const playThud = useSound('thud')
  const [file, setFile] = useState<File | null>(null)

  const upload = useMutation({
    mutationFn: (next: File) => postCalendarUpload(next),
    onSuccess: (result) => {
      playChime()
      toast.success(result.message)
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['config'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      onClose()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    },
  })

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start sm:justify-center overflow-y-auto p-4 sm:p-6 pt-20 sm:pt-24 pb-12">
      <motion.div
        aria-label="Close"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative my-auto w-full max-w-sm rounded-2xl border border-border/80 bg-[#121518] p-5 shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Upload calendar</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Import an <span className="font-mono text-foreground/80">.ics</span> file. Events are
          categorised locally.
        </p>

        <button
          onClick={() => inputRef.current?.click()}
          className="mt-4 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-1 px-4 py-7 text-center transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
        >
          <Upload className="h-5 w-5 text-primary/70" />
          <span className="text-[12px] font-medium text-foreground">
            {file ? file.name : 'Choose an .ics file'}
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {file ? `${Math.round(file.size / 1024)} KB ready` : 'click to browse'}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".ics,text/calendar"
          className="hidden"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} sound={false}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!file || upload.isPending}
            onClick={() => file && upload.mutate(file)}
          >
            {upload.isPending ? <SpinnerArc /> : <Upload className="h-3 w-3" />}
            Import
          </Button>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}

// ─── INTERACTIVE DAY ACTION & FAST-LOG MODAL ──────────────────────────────────

function DayActionModal({
  day,
  events,
  spends,
  debts,
  applications = [],
  interviews = [],
  symbol,
  onClose,
}: {
  day: Date
  events: CalEvent[]
  spends: CalSpend[]
  debts: CalDebt[]
  applications?: JobApplication[]
  interviews?: { id?: number; company: string; scheduled_at: string; prep_docs?: any[] }[]
  symbol: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const playClick = useSound('click')
  const playChime = useSound('chime')

  const dayStr = format(day, 'yyyy-MM-dd')
  const [activeTab, setActiveTab] = useState<'nlp' | 'event' | 'spend' | 'debt' | 'job'>('nlp')

  // 4. Job Application State
  const [jobCompany, setJobCompany] = useState('')
  const [jobRole, setJobRole] = useState('')
  const [jobStatus, setJobStatus] = useState<string>('applied')
  const [jobInterviewTime, setJobInterviewTime] = useState('11:00')

  // Natural Language State
  const [nlpInput, setNlpInput] = useState('')
  const nlpParsed = useMemo(() => parseCalendarItemNLP(nlpInput), [nlpInput])

  // 1. Event State
  const [eventTitle, setEventTitle] = useState('')
  const [eventCategory, setEventCategory] = useState('personal')
  const [eventStartTime, setEventStartTime] = useState('10:00')
  const [eventEndTime, setEventEndTime] = useState('11:00')
  const [eventLocation, setEventLocation] = useState('')

  // 2. Spend State (Money Paid / Bought Something)
  const [spendAmount, setSpendAmount] = useState('')
  const [spendMerchant, setSpendMerchant] = useState('')
  const [spendCategory, setSpendCategory] = useState('food')

  // 3. Debt State (Money Lent / Borrowed)
  const [debtPerson, setDebtPerson] = useState('')
  const [debtDirection, setDebtDirection] = useState<'lent' | 'borrowed'>('lent')
  const [debtAmount, setDebtAmount] = useState('')
  const [debtNotes, setDebtNotes] = useState('')

  // Add Event Mutation
  const addEventMutation = useMutation({
    mutationFn: (payload: { title: string; start_at: string; end_at?: string; category?: string; location?: string }) =>
      postCalendarEvent(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      toast.success(res.message || 'Event scheduled')
      setEventTitle('')
      setEventLocation('')
      setNlpInput('')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to schedule event')
    },
  })

  // Delete Event Mutation
  const deleteEventMutation = useMutation({
    mutationFn: (id: number) => deleteCalendarEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      toast.success('Event deleted')
    },
  })

  // Add Spend Mutation (Connects to /money and updates budgets & savings surplus)
  const addSpendMutation = useMutation({
    mutationFn: (payload: { amount: number; merchant: string; category: string; spent_at: string }) =>
      postMoneyAdd(payload.amount, payload.merchant, payload.category, payload.spent_at),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['money-summary'] })
      queryClient.invalidateQueries({ queryKey: ['savings'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      toast.success(`Logged ${symbol}${spendAmount || nlpParsed?.amount} spend on ${format(day, 'MMM d')}`)
      setSpendAmount('')
      setSpendMerchant('')
      setNlpInput('')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to log spend')
    },
  })

  // Add Job Mutation (Connects to /jobs)
  const addJobMutation = useMutation({
    mutationFn: (payload: { company: string; role?: string; status?: string; interview_at?: string }) =>
      postJobAdd(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      toast.success(res.message || 'Job application logged!')
      setJobCompany('')
      setJobRole('')
      setNlpInput('')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to log job application')
    },
  })

  // Add Debt Mutation (Connects to /debts)
  const addDebtMutation = useMutation({
    mutationFn: (payload: { person: string; direction: 'lent' | 'borrowed'; amount: number; taken_at: string; notes?: string }) =>
      postDebtAdd(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['debts'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      toast.success(`Recorded IOU with ${debtPerson || nlpParsed?.person}`)
      setDebtPerson('')
      setDebtAmount('')
      setDebtNotes('')
      setNlpInput('')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to record debt')
    },
  })

  // AI Fast-Submit Handler
  const handleAIFastSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nlpParsed) {
      toast.error('Please enter details e.g. "Meeting at 3pm" or "250 lunch"')
      return
    }

    if (nlpParsed.type === 'event') {
      addEventMutation.mutate({
        title: nlpParsed.title,
        start_at: `${dayStr}T${nlpParsed.startTime}`,
        end_at: `${dayStr}T${nlpParsed.endTime}`,
        category: nlpParsed.category,
        location: nlpParsed.location,
      })
    } else if (nlpParsed.type === 'spend') {
      if (!nlpParsed.amount || nlpParsed.amount <= 0) {
        toast.error('Please specify expense amount e.g. "250 lunch"')
        return
      }
      addSpendMutation.mutate({
        amount: nlpParsed.amount,
        merchant: nlpParsed.merchant,
        category: nlpParsed.category,
        spent_at: dayStr,
      })
    } else if (nlpParsed.type === 'job') {
      if (!nlpParsed.company) {
        toast.error('Please specify company name e.g. "Applied Google"')
        return
      }
      addJobMutation.mutate({
        company: nlpParsed.company,
        role: nlpParsed.role || undefined,
        status: nlpParsed.status,
      })
    } else if (nlpParsed.type === 'debt') {
      if (!nlpParsed.amount || nlpParsed.amount <= 0) {
        toast.error('Please specify debt amount e.g. "Lent 500 to Rahul"')
        return
      }
      addDebtMutation.mutate({
        person: nlpParsed.person,
        direction: nlpParsed.direction,
        amount: nlpParsed.amount,
        taken_at: dayStr,
        notes: nlpParsed.notes,
      })
    }
  }

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventTitle.trim()) {
      toast.error('Please enter an event title')
      return
    }
    const start_at = `${dayStr}T${eventStartTime}`
    const end_at = `${dayStr}T${eventEndTime}`
    addEventMutation.mutate({
      title: eventTitle.trim(),
      start_at,
      end_at,
      category: eventCategory,
      location: eventLocation.trim(),
    })
  }

  const handleSpendSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(spendAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid expense amount')
      return
    }
    addSpendMutation.mutate({
      amount: amt,
      merchant: spendMerchant.trim(),
      category: spendCategory,
      spent_at: dayStr,
    })
  }

  const handleJobSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!jobCompany.trim()) {
      toast.error('Please enter company name')
      return
    }
    const interviewAt = jobStatus === 'interview' && jobInterviewTime ? `${dayStr}T${jobInterviewTime}` : undefined
    addJobMutation.mutate({
      company: jobCompany.trim(),
      role: jobRole.trim() || undefined,
      status: jobStatus,
      interview_at: interviewAt,
    })
  }

  const handleDebtSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!debtPerson.trim()) {
      toast.error('Please enter person name')
      return
    }
    const amt = parseFloat(debtAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid debt amount')
      return
    }
    addDebtMutation.mutate({
      person: debtPerson.trim(),
      direction: debtDirection,
      amount: amt,
      taken_at: dayStr,
      notes: debtNotes.trim(),
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto p-4 sm:p-6 pt-24 sm:pt-28 pb-12">
      {/* Backdrop */}
      <motion.div
        aria-label="Close"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-md"
      />

      {/* Modal Card - Centered with safe top navbar clearance and max-h */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative mt-2 sm:mt-4 mb-8 w-full max-w-2xl sm:max-w-3xl max-h-[calc(100vh-8.5rem)] flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-[#121518] shadow-2xl backdrop-blur-2xl z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-surface-1/60 px-5 py-3.5 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-primary font-bold">
                {format(day, 'EEEE')}
              </span>
              <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                {events.length} Events · {spends.length} Spends · {debts.length} Debts · {applications.length + interviews.length} Jobs
              </span>
            </div>
            <h2 className="text-base font-bold text-foreground mt-0.5">{format(day, 'd MMMM yyyy')}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Section A: Active Items Already On This Day */}
          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Logged On This Date
            </h3>

            {events.length === 0 && spends.length === 0 && debts.length === 0 && applications.length === 0 && interviews.length === 0 ? (
              <p className="mt-1.5 text-xs text-muted-foreground/70 italic py-1">
                Nothing recorded for this day yet. Use the quick fast-log below to schedule an event or log money!
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Events list */}
                {events.map((ev) => {
                  const cat = tone(ev.category)
                  return (
                    <div
                      key={`ev-${ev.id}`}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-1/70 px-3 py-2 text-xs shadow-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={cn('h-2 w-2 rounded-full shrink-0', cat.dot)} />
                        <div className="truncate">
                          <p className="font-semibold text-foreground truncate">{ev.title}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                            <Clock className="h-2.5 w-2.5" />
                            {clock(ev.start_at)} – {clock(ev.end_at)}
                            {ev.location && <span className="truncate">· {ev.location}</span>}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteEventMutation.mutate(ev.id)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 transition shrink-0 ml-1"
                        title="Delete Event"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })}

                {/* Spends list (Money Paid) */}
                {spends.map((sp) => (
                  <div
                    key={`sp-${sp.id}`}
                    className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-500/20 text-amber-400">
                        <Receipt className="h-3 w-3" />
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-foreground truncate">{sp.merchant || 'Expense'}</p>
                        <p className="text-[10px] text-amber-400 font-mono capitalize">💸 Paid ({sp.category})</p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-foreground shrink-0 ml-2">
                      -{money(sp.amount, symbol)}
                    </span>
                  </div>
                ))}

                {/* Debts list (Lent / Borrowed) */}
                {debts.map((db) => (
                  <div
                    key={`db-${db.id}`}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-3 py-2 text-xs shadow-xs',
                      db.direction === 'lent'
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-blue-500/30 bg-blue-500/5'
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded',
                          db.direction === 'lent' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                        )}
                      >
                        <HandCoins className="h-3 w-3" />
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-foreground truncate">
                          {db.direction === 'lent' ? 'Lent to' : 'Borrowed from'} {db.person}
                        </p>
                        {db.notes && <p className="text-[10px] text-muted-foreground truncate italic">{db.notes}</p>}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'font-mono text-xs font-bold shrink-0 ml-2',
                        db.direction === 'lent' ? 'text-emerald-400' : 'text-blue-400'
                      )}
                    >
                      {db.direction === 'lent' ? '+' : '-'}{money(db.amount, symbol)}
                    </span>
                  </div>
                ))}

                {/* Job Applications list */}
                {applications.map((app) => (
                  <div
                    key={`job-app-${app.id || app.company}`}
                    className="flex items-center justify-between rounded-xl border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-500/20 text-violet-400">
                        <Briefcase className="h-3 w-3" />
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-foreground truncate">{app.company}</p>
                        <p className="text-[10px] text-violet-400 font-mono">
                          💼 {app.role || 'Application'} · <span className="capitalize">{app.status}</span>
                        </p>
                      </div>
                    </div>
                    <a
                      href="/jobs"
                      className="text-[10px] text-violet-400 hover:underline shrink-0 ml-2 font-medium"
                    >
                      Jobs ↗
                    </a>
                  </div>
                ))}

                {/* Scheduled Interviews list */}
                {interviews.map((int) => (
                  <div
                    key={`job-int-${int.id || int.company}`}
                    className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-500/20 text-amber-400">
                        <Clock className="h-3 w-3" />
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-foreground truncate">{int.company}</p>
                        <p className="text-[10px] text-amber-400 font-mono">
                          🎯 Interview at {int.scheduled_at.slice(11, 16) || int.scheduled_at}
                        </p>
                      </div>
                    </div>
                    <a
                      href="/jobs"
                      className="text-[10px] text-amber-300 hover:underline shrink-0 ml-2 font-semibold"
                    >
                      Prep ↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Interactive Fast-Log Form */}
          <div className="rounded-2xl border border-border/80 bg-surface-1/50 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/50">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Add to {format(day, 'MMMM d')}
              </span>

              {/* Segmented Mode Selector */}
              <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-surface-2 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setActiveTab('nlp')
                  }}
                  className={cn(
                    'flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition',
                    activeTab === 'nlp'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  AI Natural
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setActiveTab('event')
                  }}
                  className={cn(
                    'rounded-lg px-2 py-1 text-[11px] font-semibold transition',
                    activeTab === 'event'
                      ? 'bg-blue-500 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  📅 Event
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setActiveTab('spend')
                  }}
                  className={cn(
                    'rounded-lg px-2 py-1 text-[11px] font-semibold transition',
                    activeTab === 'spend'
                      ? 'bg-amber-500 text-black shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  💸 Paid
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setActiveTab('debt')
                  }}
                  className={cn(
                    'rounded-lg px-2 py-1 text-[11px] font-semibold transition',
                    activeTab === 'debt'
                      ? 'bg-emerald-500 text-black shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  🤝 IOU
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setActiveTab('job')
                  }}
                  className={cn(
                    'rounded-lg px-2 py-1 text-[11px] font-semibold transition',
                    activeTab === 'job'
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  💼 Job / App
                </button>
              </div>
            </div>

            {/* Tab 1: AI Natural Language Fast-Add */}
            {activeTab === 'nlp' && (
              <form onSubmit={handleAIFastSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder='e.g. "Meeting with client at 3pm", "250 lunch at subway", or "Lent 1500 to Rahul"...'
                    value={nlpInput}
                    onChange={(e) => setNlpInput(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-surface-2 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[10px] text-muted-foreground/70">
                    Type naturally — Context automatically detects if it's an event, an expense, or an IOU!
                  </p>
                </div>

                {/* Parsed Live Preview */}
                {nlpParsed && (
                  <div className="rounded-xl border border-border/60 bg-[#16191d] p-3 text-xs space-y-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      Parsed AI Preview
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {nlpParsed.type === 'event' && (
                        <>
                          <span className="rounded bg-blue-500/20 px-2 py-0.5 text-blue-300 font-semibold">
                            📅 Event
                          </span>
                          <span className="rounded bg-surface-2 px-2 py-0.5 font-semibold text-foreground">
                            Title: {nlpParsed.title}
                          </span>
                          <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-foreground">
                            Time: {nlpParsed.startTime} – {nlpParsed.endTime}
                          </span>
                          <span className="rounded bg-surface-2 px-2 py-0.5 capitalize text-muted-foreground">
                            {nlpParsed.category}
                          </span>
                        </>
                      )}

                      {nlpParsed.type === 'spend' && (
                        <>
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300 font-semibold">
                            💸 Money Paid
                          </span>
                          <span className="rounded bg-surface-2 px-2 py-0.5 font-mono font-bold text-foreground">
                            Amount: {symbol}{nlpParsed.amount}
                          </span>
                          <span className="rounded bg-surface-2 px-2 py-0.5 font-semibold text-foreground">
                            Merchant: {nlpParsed.merchant}
                          </span>
                          <span className="rounded bg-surface-2 px-2 py-0.5 capitalize text-muted-foreground">
                            {nlpParsed.category}
                          </span>
                        </>
                      )}

                      {nlpParsed.type === 'debt' && (
                        <>
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300 font-semibold">
                            🤝 Debt / IOU
                          </span>
                          <span className="rounded bg-surface-2 px-2 py-0.5 font-semibold text-foreground">
                            {nlpParsed.direction === 'lent' ? 'Lent to' : 'Borrowed from'} {nlpParsed.person}
                          </span>
                          <span className="rounded bg-surface-2 px-2 py-0.5 font-mono font-bold text-foreground">
                            {symbol}{nlpParsed.amount}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground">
                    ⚡ Auto-syncs across Calendar, Spends, and IOUs
                  </span>
                  <button
                    type="submit"
                    disabled={!nlpParsed || addEventMutation.isPending || addSpendMutation.isPending || addDebtMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 active:scale-95 transition disabled:opacity-40"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Log via AI ↵</span>
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: Manual Event */}
            {activeTab === 'event' && (
              <form onSubmit={handleEventSubmit} className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-foreground">Event Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Project Review, Doctor Appointment, Flight"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-foreground">Start Time</label>
                    <input
                      type="time"
                      value={eventStartTime}
                      onChange={(e) => setEventStartTime(e.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-foreground">End Time</label>
                    <input
                      type="time"
                      value={eventEndTime}
                      onChange={(e) => setEventEndTime(e.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-foreground">Category</label>
                    <select
                      value={eventCategory}
                      onChange={(e) => setEventCategory(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="personal">Personal</option>
                      <option value="office">Office / Work</option>
                      <option value="academic">Academic</option>
                      <option value="interview">Interview</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-foreground">Location (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Office, Zoom, Home"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={addEventMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 active:scale-95 transition disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Schedule Event ↵</span>
                  </button>
                </div>
              </form>
            )}

            {/* Tab 3: Manual Spend */}
            {activeTab === 'spend' && (
              <form onSubmit={handleSpendSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-foreground">Amount Paid ({symbol})</label>
                    <div className="relative mt-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                        {symbol}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 250"
                        value={spendAmount}
                        onChange={(e) => setSpendAmount(e.target.value)}
                        required
                        className="w-full rounded-xl border border-border/80 bg-surface-2 py-2 pl-7 pr-3 text-xs font-mono text-foreground focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-foreground">Where did you spend it?</label>
                    <input
                      type="text"
                      placeholder="e.g. Starbucks, Uber, Groceries"
                      value={spendMerchant}
                      onChange={(e) => setSpendMerchant(e.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-foreground">Category</label>
                  <select
                    value={spendCategory}
                    onChange={(e) => setSpendCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs font-medium text-foreground focus:border-amber-400 focus:outline-none"
                  >
                    <option value="food">Food & Dining</option>
                    <option value="transport">Transport & Travel</option>
                    <option value="shopping">Shopping</option>
                    <option value="bills">Bills & Utilities</option>
                    <option value="subscriptions">Subscriptions</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground">
                    ⚡ Auto-syncs to your Spends & Budgets ledger
                  </span>
                  <button
                    type="submit"
                    disabled={addSpendMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-black shadow-sm hover:bg-amber-400 active:scale-95 transition disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Log Expense ↵</span>
                  </button>
                </div>
              </form>
            )}

            {/* Tab 4: Manual Debt */}
            {activeTab === 'debt' && (
              <form onSubmit={handleDebtSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/80 bg-surface-2 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      playClick()
                      setDebtDirection('lent')
                    }}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition',
                      debtDirection === 'lent'
                        ? 'bg-emerald-500 text-black shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    I Lent Money
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playClick()
                      setDebtDirection('borrowed')
                    }}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition',
                      debtDirection === 'borrowed'
                        ? 'bg-blue-500 text-black shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                    I Borrowed Money
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-foreground">Person Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul, Alex, Maya"
                      value={debtPerson}
                      onChange={(e) => setDebtPerson(e.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-foreground">Amount ({symbol})</label>
                    <div className="relative mt-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                        {symbol}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 1500"
                        value={debtAmount}
                        onChange={(e) => setDebtAmount(e.target.value)}
                        required
                        className="w-full rounded-xl border border-border/80 bg-surface-2 py-2 pl-7 pr-3 text-xs font-mono text-foreground focus:border-emerald-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-foreground">Notes / Reason (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Dinner bill split, Uber ride, Concert ticket"
                    value={debtNotes}
                    onChange={(e) => setDebtNotes(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground">
                    🤝 Auto-syncs to your Debts & IOUs deck
                  </span>
                  <button
                    type="submit"
                    disabled={addDebtMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-black shadow-sm hover:bg-emerald-400 active:scale-95 transition disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Record IOU ↵</span>
                  </button>
                </div>
              </form>
            )}

            {/* Mode 4: Job Application / Interview Logging */}
            {activeTab === 'job' && (
              <form onSubmit={handleJobSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-foreground">Company Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Google, Stripe, Microsoft"
                      value={jobCompany}
                      onChange={(e) => setJobCompany(e.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-violet-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-foreground">Role / Position (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Frontend Engineer, SDE"
                      value={jobRole}
                      onChange={(e) => setJobRole(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-violet-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-foreground">Status</label>
                    <select
                      value={jobStatus}
                      onChange={(e) => setJobStatus(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs text-foreground focus:border-violet-400 focus:outline-none"
                    >
                      <option value="applied">Applied</option>
                      <option value="interview">Interview</option>
                      <option value="offered">Offered</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  {jobStatus === 'interview' && (
                    <div>
                      <label className="text-[11px] font-medium text-amber-400">Interview Time</label>
                      <input
                        type="time"
                        value={jobInterviewTime}
                        onChange={(e) => setJobInterviewTime(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-amber-500/40 bg-surface-2 px-3 py-2 text-xs text-foreground focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground">
                    💼 Auto-syncs across Calendar and Job Search board
                  </span>
                  <button
                    type="submit"
                    disabled={addJobMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-500 active:scale-95 transition disabled:opacity-40 cursor-pointer"
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>Log Application ↵</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}

// ─── MAIN CALENDAR PAGE ──────────────────────────────────────────────────────

export default function CalendarPage() {
  const [params] = useSearchParams()
  const selectedDate = params.get('date')
  const [view, setView] = useState<'month' | 'week'>('month')
  const [anchor, setAnchor] = useState(() => parseLocalDay(selectedDate) || new Date())
  const [now, setNow] = useState(() => new Date())
  const [uploading, setUploading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => parseLocalDay(selectedDate))
  useEffect(() => {
    const day = parseLocalDay(selectedDate)
    if (day) { setAnchor(day); setSelectedDay(day) }
  }, [selectedDate])
  const playClick = useSound('click')
  const reduced = useReducedMotionSafe()

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
  })
  const symbol = config?.symbol || '₹'

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const range = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(anchor, { weekStartsOn: 1 })
      const end = endOfWeek(anchor, { weekStartsOn: 1 })
      return { start, end }
    }
    const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
    const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 })
    return { start: gridStart, end: gridEnd }
  }, [anchor, view])

  const calendarQuery = useQuery({
    queryKey: ['calendar', view, format(range.start, 'yyyy-MM-dd'), format(range.end, 'yyyy-MM-dd')],
    queryFn: () =>
      fetchCalendar({
        start: format(range.start, 'yyyy-MM-dd'),
        end: format(range.end, 'yyyy-MM-dd'),
      }),
  })

  const events = calendarQuery.data?.events ?? []
  const spends = calendarQuery.data?.spends ?? []
  const debts = calendarQuery.data?.debts ?? []
  const applications = calendarQuery.data?.applications ?? []
  const interviews = calendarQuery.data?.interviews ?? []

  const days = useMemo(() => {
    return eachDayOfInterval({ start: range.start, end: range.end })
  }, [range])

  const collisions = calendarQuery.data?.collisions ?? []
  const collisionKeys = useMemo(() => {
    const keys = new Set<string>()
    collisions.forEach((collision) => {
      keys.add(`${(collision.a_start || '').slice(0, 10)}|${collision.a_start}`)
      keys.add(`${(collision.b_start || '').slice(0, 10)}|${collision.b_start}`)
    })
    return keys
  }, [collisions])

  const eventsFor = (day: Date) =>
    events.filter((event) => sameDay(event.start_at, day))

  const spendsFor = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return spends.filter((s) => s.spent_at === dayStr)
  }

  const debtsFor = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return debts.filter((d) => {
      const taken = (d.taken_at || '').slice(0, 10)
      const due = (d.due_date || '').slice(0, 10)
      return taken === dayStr || due === dayStr
    })
  }

  const applicationsFor = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return applications.filter((a) => (a.applied_at || '').slice(0, 10) === dayStr)
  }

  const interviewsFor = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return interviews.filter((i) => (i.scheduled_at || '').slice(0, 10) === dayStr)
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const showNow = nowMinutes >= 8 * 60 && nowMinutes <= 22 * 60
  const nowTop = ((nowMinutes - 8 * 60) / 60) * PX_PER_HOUR
  const weekContainsNow = days.some((day) => isSameDay(day, now))

  if (calendarQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="mt-6 h-[360px] w-full rounded-2xl sm:h-[420px]" />
      </div>
    )
  }

  if (calendarQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <PageHeader icon={CalendarIcon} eyebrow="Calendar" title="Your schedule & timeline" />
        <ErrorPanel
          error={calendarQuery.error}
          onRetry={() => calendarQuery.refetch()}
          retrying={calendarQuery.isFetching}
          className="mt-6"
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={CalendarIcon}
        eyebrow="Timeline & Activity"
        title={view === 'week' ? format(range.start, 'MMMM yyyy') : format(anchor, 'MMMM yyyy')}
        subtitle={`${events.length} events · ${spends.length} spends · ${debts.length} IOUs · Tap any date to add via AI`}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-0.5">
              <button
                onClick={() => setAnchor((value) => (view === 'week' ? new Date(value.getTime() - 7 * 86_400_000) : subMonths(value, 1)))}
                aria-label="Previous"
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-3 hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  playClick()
                  setAnchor(new Date())
                }}
                className="rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              >
                Today
              </button>
              <button
                onClick={() => setAnchor((value) => (view === 'week' ? new Date(value.getTime() + 7 * 86_400_000) : addMonths(value, 1)))}
                aria-label="Next"
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-3 hover:text-foreground"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="relative flex rounded-lg border border-border bg-surface-2 p-0.5">
              {(['month', 'week'] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    playClick()
                    setView(item)
                  }}
                  className={cn(
                    'relative z-10 rounded-md px-2.5 py-1 text-[10px] font-medium capitalize transition-colors',
                    view === item ? 'text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {view === item && (
                    <motion.span
                      layoutId="calendar-view-pill"
                      className="absolute inset-0 -z-10 rounded-md bg-primary"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  {item}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              onClick={() => {
                playClick()
                setSelectedDay(new Date())
              }}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Log for Today</span>
            </Button>

            <Button size="sm" variant="outline" onClick={() => setUploading(true)}>
              <Upload className="h-3.5 w-3.5" />
              Upload .ics
            </Button>
          </>
        }
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="mt-5 overflow-hidden rounded-2xl border border-border/60 bg-card/50 backdrop-blur-xl shadow-sm"
        >
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-b border-border bg-surface-1/50">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
              <div
                key={label}
                className="border-r border-hairline py-2.5 text-center text-[10px] uppercase font-mono font-semibold tracking-wide text-muted-foreground/70 last:border-r-0"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Month View: High Density Interactive Grid */}
          {view === 'month' && (
            <div className="grid grid-cols-7">
              {days.map((day, index) => {
                const dayEvents = eventsFor(day)
                const daySpends = spendsFor(day)
                const dayDebts = debtsFor(day)
                const dayApps = applicationsFor(day)
                const dayInterviews = interviewsFor(day)
                const today = isSameDay(day, now)
                const inMonth = day.getMonth() === anchor.getMonth()
                const totalSpend = daySpends.reduce((acc, s) => acc + s.amount, 0)
                const totalItems = dayEvents.length + daySpends.length + dayDebts.length + dayApps.length + dayInterviews.length

                return (
                  <motion.div
                    key={day.toISOString()}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: reduced ? 0 : index * 0.003, duration: 0.2 }}
                    onClick={() => {
                      playClick()
                      setSelectedDay(day)
                    }}
                    className={cn(
                      'group relative h-[68px] min-w-0 sm:h-auto sm:min-h-[115px] border-b border-r border-hairline p-1 sm:p-2 text-left transition-colors hover:bg-surface-2/80 cursor-pointer [&:nth-child(7n)]:border-r-0 flex flex-col justify-between',
                      !inMonth && 'bg-surface-1/25 opacity-40',
                      today && 'bg-primary/[0.08] ring-1 ring-inset ring-primary/40'
                    )}
                  >
                    <div>
                      {/* Top Row: Date Number + Spend Indicator */}
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
                            today ? 'bg-primary text-primary-foreground font-bold shadow-xs' : 'text-muted-foreground group-hover:text-foreground'
                          )}
                        >
                          {format(day, 'd')}
                        </span>

                        {totalSpend > 0 && (
                          <span className="hidden sm:inline font-mono text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1 rounded">
                            -{symbol}{totalSpend.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Content Badges */}
                      {totalItems > 0 && <div className="mt-2 sm:hidden" aria-label={`${totalItems} saved items. Tap to see details.`}>
                        <div aria-hidden="true" className="flex flex-wrap items-center gap-1">
                          {dayEvents.length > 0 && <span className="h-1 w-1 rounded-full bg-primary" />}
                          {daySpends.length > 0 && <span className="h-1 w-1 rounded-full bg-amber-400" />}
                          {dayDebts.length > 0 && <span className="h-1 w-1 rounded-full bg-emerald-400" />}
                          {dayApps.length + dayInterviews.length > 0 && <span className="h-1 w-1 rounded-full bg-violet-400" />}
                        </div>
                        <span aria-hidden="true" className="mt-1 block text-[9px] leading-none tabular-nums text-muted-foreground">{totalItems}</span>
                      </div>}
                      <div className="mt-1.5 hidden space-y-1 sm:block">
                        {/* 1. Events */}
                        {dayEvents.slice(0, 2).map((event) => {
                          const category = tone(event.category)
                          return (
                            <div
                              key={`ev-${event.id}`}
                              className={cn(
                                'flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[8.5px] leading-tight font-medium',
                                category.block
                              )}
                            >
                              <span className={cn('h-1 w-1 shrink-0 rounded-full', category.dot)} />
                              <span className="truncate">{event.title}</span>
                            </div>
                          )
                        })}

                        {/* 2. Spends (Bought / Paid) */}
                        {daySpends.slice(0, 1).map((s) => (
                          <div
                            key={`sp-${s.id}`}
                            className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[8.5px] border border-amber-500/30 bg-amber-500/10 text-amber-300 font-mono"
                          >
                            <span className="shrink-0">💸</span>
                            <span className="truncate font-sans font-medium">{s.merchant || s.category}</span>
                            <span className="ml-auto font-bold">{symbol}{s.amount}</span>
                          </div>
                        ))}

                        {/* 3. Debts (Lent / Borrowed) */}
                        {dayDebts.slice(0, 1).map((d) => (
                          <div
                            key={`db-${d.id}`}
                            className={cn(
                              'flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[8.5px] font-mono',
                              d.direction === 'lent'
                                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : 'border border-blue-500/30 bg-blue-500/10 text-blue-300'
                            )}
                          >
                            <span className="shrink-0">{d.direction === 'lent' ? '🤝' : '📥'}</span>
                            <span className="truncate font-sans font-medium">{d.person}</span>
                            <span className="ml-auto font-bold">{symbol}{d.amount}</span>
                          </div>
                        ))}

                        {/* 4. Job Applications & Interviews */}
                        {dayApps.slice(0, 1).map((app) => (
                          <div
                            key={`job-${app.id || app.company}`}
                            className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[8.5px] border border-violet-500/30 bg-violet-500/10 text-violet-300 font-medium"
                          >
                            <span className="shrink-0">💼</span>
                            <span className="truncate">{app.company}</span>
                          </div>
                        ))}
                        {dayInterviews.slice(0, 1).map((int) => (
                          <div
                            key={`int-${int.id || int.company}`}
                            className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[8.5px] border border-amber-500/40 bg-amber-500/15 text-amber-200 font-medium"
                          >
                            <span className="shrink-0">🎯</span>
                            <span className="truncate">Int: {int.company}</span>
                          </div>
                        ))}

                        {totalItems > 3 && (
                          <p className="pl-1 text-[8px] font-mono text-muted-foreground/70">
                            +{totalItems - 3} more
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Subtle Hover Action Pill */}
                    <div className="hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <span className="text-[9px] font-semibold text-primary inline-flex items-center gap-0.5">
                        <Plus className="h-2.5 w-2.5" /> Add
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* Week View: Detailed Timeline */}
          {view === 'week' && (
            <div className="max-h-[60dvh] overflow-auto overscroll-contain sm:max-h-none">
              <div className="min-w-[720px]">
                {/* Day Headers with Spends & Debts chips */}
                <div className="sticky top-0 z-20 flex border-b border-border bg-card/90 backdrop-blur">
                  <div className="w-12 shrink-0 border-r border-hairline" />
                  {days.map((day) => {
                    const today = isSameDay(day, now)
                    const daySpends = spendsFor(day)
                    const dayDebts = debtsFor(day)
                    const totalSpend = daySpends.reduce((acc, s) => acc + s.amount, 0)

                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => {
                          playClick()
                          setSelectedDay(day)
                        }}
                        className={cn(
                          'flex flex-1 flex-col items-center justify-center border-r border-hairline py-2.5 cursor-pointer hover:bg-surface-2 transition last:border-r-0',
                          today && 'bg-primary/[0.06]'
                        )}
                      >
                        <span className="text-[9px] uppercase tracking-wide text-muted-foreground/60 font-mono">
                          {format(day, 'EEE')}
                        </span>
                        <span
                          className={cn(
                            'mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums',
                            today ? 'bg-primary text-primary-foreground font-bold' : 'text-foreground/80'
                          )}
                        >
                          {format(day, 'd')}
                        </span>

                        {totalSpend > 0 && (
                          <span className="mt-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[8.5px] font-mono font-bold text-amber-300">
                            💸 {symbol}{totalSpend.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Time Grid */}
                <div className="relative flex">
                  <div className="w-12 shrink-0 border-r border-hairline bg-surface-1/40">
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="relative border-b border-hairline/60"
                        style={{ height: PX_PER_HOUR }}
                      >
                        <span className="absolute -top-1.5 right-1.5 text-[9px] tabular-nums text-muted-foreground/50 font-mono">
                          {String(hour).padStart(2, '0')}:00
                        </span>
                      </div>
                    ))}
                  </div>

                  {days.map((day, dayIndex) => {
                    const dayEvents = eventsFor(day)
                    const dayLayout = layoutEvents(dayEvents)
                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => {
                          playClick()
                          setSelectedDay(day)
                        }}
                        className={cn(
                          'relative flex-1 border-r border-hairline last:border-r-0 cursor-pointer hover:bg-surface-1/30 transition',
                          isSameDay(day, now) && 'bg-primary/[0.025]'
                        )}
                        style={{ height: HOURS.length * PX_PER_HOUR }}
                      >
                        <div aria-hidden className="now-grid pointer-events-none absolute inset-0" />
                        {HOURS.map((hour) => (
                          <div
                            key={hour}
                            className="border-b border-hairline/60"
                            style={{ height: PX_PER_HOUR }}
                          />
                        ))}

                        {dayLayout.map(({ event, lane, lanes }, eventIndex) => {
                          const category = tone(event.category)
                          const collision = collisionKeys.has(
                            `${event.start_at.slice(0, 10)}|${event.start_at}`
                          )
                          return (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                delay: reduced ? 0 : dayIndex * 0.04 + eventIndex * 0.03,
                                duration: 0.3,
                              }}
                              title={`${event.title} · ${clock(event.start_at)}–${clock(event.end_at)}`}
                              className={cn(
                                'absolute z-10 overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-[9px] leading-tight shadow-sm backdrop-blur-sm',
                                category.block,
                                collision && 'ring-1 ring-red-500/70'
                              )}
                              style={{
                                top: eventTop(event),
                                height: eventHeight(event),
                                left: `calc(${(lane / lanes) * 100}% + 2px)`,
                                width: `calc(${100 / lanes}% - 4px)`,
                              }}
                            >
                              <div className="flex items-center gap-1">
                                {collision && <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-red-400" />}
                                <p className={cn('truncate font-medium', category.text)}>{event.title}</p>
                              </div>
                              <p className="truncate text-muted-foreground/70 font-mono">
                                {clock(event.start_at)}
                              </p>
                            </motion.div>
                          )
                        })}

                        {weekContainsNow && isSameDay(day, now) && showNow && (
                          <div
                            className="pointer-events-none absolute inset-x-0 z-20"
                            style={{ top: nowTop }}
                          >
                            <div className="relative h-px bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]">
                              <span className="absolute -left-1 -top-[3px] flex h-[7px] w-[7px]">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                                <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-primary" />
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Collision Alerts in Week View */}
      {calendarQuery.data?.collisions && calendarQuery.data.collisions.length > 0 && view === 'week' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {calendarQuery.data.collisions.map((collision, index) => (
            <Badge key={`${collision.a}-${index}`} variant="danger" className="gap-1 py-1">
              <AlertTriangle className="h-2.5 w-2.5" />
              {collision.a} overlaps {collision.b}
            </Badge>
          ))}
        </div>
      )}

      {/* Active Day Action Modal with createPortal */}
      <AnimatePresence>
        {uploading && <UploadDialog onClose={() => setUploading(false)} />}
        {selectedDay && (
          <DayActionModal
            day={selectedDay}
            events={eventsFor(selectedDay)}
            spends={spendsFor(selectedDay)}
            debts={debtsFor(selectedDay)}
            applications={applicationsFor(selectedDay)}
            interviews={interviewsFor(selectedDay)}
            symbol={symbol}
            onClose={() => setSelectedDay(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/** Local helper so the page still renders if the shared hook is unavailable. */
function useReducedMotionSafe() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(media.matches)
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])
  return reduced
}
