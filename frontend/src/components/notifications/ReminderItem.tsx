import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, CalendarClock, Check, Clock, HandCoins, Receipt, X } from 'lucide-react'
import type { Reminder } from '@/lib/api'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
import RecordTypeSelect from '@/components/ui/RecordTypeSelect'

export type ReminderAction = (id: string, action: 'read' | 'snooze' | 'dismiss', minutes?: number) => void

export default function ReminderItem({ item, onAction, pending, onOpen, compact = false }: {
  item: Reminder; onAction: ReminderAction; pending: boolean; onOpen?: () => void; compact?: boolean
}) {
  const [minutes, setMinutes] = useState(15)
  const dateOnly = item.kind === 'subscription' || item.kind === 'debt'
  const Icon = { event: CalendarClock, interview: Briefcase, subscription: Receipt, debt: HandCoins }[item.kind]
  return <li className={cn('rounded-xl border p-4', item.read ? 'border-border/60 bg-card/40' : 'border-primary/20 bg-primary/[0.04]')}>
    <div className="flex items-start gap-3">
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
        item.severity === 'danger' ? 'bg-red-500/10 text-red-400 light:text-red-700' : item.severity === 'warning' ? 'bg-amber-500/10 text-amber-400 light:text-amber-700' : 'bg-primary/10 text-primary')}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2"><h4 className="break-words text-sm font-semibold">{item.title}</h4>{!item.read && <span aria-label="Unread" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}</div>
        <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{item.body}{item.amount !== undefined ? ` · ${money(item.amount)}` : ''}</p>
        {!compact && <time dateTime={item.due_at} className="mt-1 block text-[11px] text-muted-foreground">{new Date(item.due_at).toLocaleString(undefined, dateOnly ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>}
      </div>
      {!compact && <button type="button" disabled={pending} onClick={() => onAction(item.id, 'dismiss')} aria-label={`Dismiss ${item.title}`} className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground disabled:opacity-50"><X className="h-3.5 w-3.5" /></button>}
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
      <Link to={item.href} onClick={() => { if (!item.read) onAction(item.id, 'read'); onOpen?.() }} className="font-medium text-primary hover:underline">Open</Link>
      {!compact && <>
        <RecordTypeSelect compact label={`Snooze duration for ${item.title}`} className="w-32 shrink-0" value={String(minutes)} options={[[ '15', '15 minutes' ], [ '60', '1 hour' ], [ '1440', '24 hours' ]]} onChange={value => setMinutes(Number(value))} disabled={pending} />
        <button type="button" disabled={pending} onClick={() => onAction(item.id, 'snooze', minutes)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"><Clock className="h-3 w-3" />Snooze</button>
        {!item.read && <button type="button" disabled={pending} aria-label={`Mark ${item.title} as read`} onClick={() => onAction(item.id, 'read')} className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"><Check className="h-3 w-3" />Read</button>}
      </>}
    </div>
  </li>
}
