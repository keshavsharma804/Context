import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, CheckCheck, RefreshCw, X } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useReminders, useReminderActions } from '@/hooks/useReminders'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'
import ReminderItem from './ReminderItem'

export default function NotificationBell() {
  const user = useAuthStore(state => state.user)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'unread' | 'all'>('unread')
  const panel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const query = useReminders(true, true)
  const { action, readAll } = useReminderActions(query.timezone)
  const reduced = useReducedMotion()
  const count = query.data?.unread_count ?? 0
  const items = (query.data?.notifications ?? []).filter(item => tab === 'all' || !item.read)
  const pending = action.isPending || readAll.isPending

  useEffect(() => {
    const show = () => { if (user) { setTab('unread'); setOpen(true) } }
    window.addEventListener('context:open-notifications', show)
    return () => window.removeEventListener('context:open-notifications', show)
  }, [user])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const fallback = trigger.current
    const root = document.getElementById('root')
    const wasInert = root?.hasAttribute('inert')
    root?.setAttribute('inert', '')
    panel.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false) }
      if (event.key !== 'Tab') return
      const elements = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select:not(:disabled), [tabindex="0"]')
      if (!elements?.length) { event.preventDefault(); return }
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      if (!wasInert) root?.removeAttribute('inert')
      if (previous?.isConnected) previous.focus()
      else fallback?.focus()
    }
  }, [open])

  if (!user) return null
  return <>
    <button ref={trigger} type="button" aria-label="Notifications" aria-expanded={open} aria-controls="notification-panel" onClick={() => setOpen(true)}
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card/80 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Bell className="h-4 w-4" />{count > 0 && <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />}
      <span role="status" className="sr-only">{count} unread reminders</span>
    </button>
    {typeof document !== 'undefined' && createPortal(<AnimatePresence>
      {open && <>
        <motion.button type="button" tabIndex={-1} aria-label="Close notification panel" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.15 }} className="fixed inset-0 z-[150] bg-black/45 backdrop-blur-sm" />
        <motion.div ref={panel} id="notification-panel" role="dialog" aria-modal="true" aria-labelledby="notification-title" tabIndex={-1}
          initial={{ opacity: 0, y: reduced ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : 16 }} transition={{ duration: reduced ? 0 : 0.2 }}
          className="fixed inset-x-0 bottom-0 z-[151] flex max-h-[88dvh] flex-col rounded-t-2xl border border-border bg-card shadow-2xl outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[430px] sm:max-w-full sm:max-h-none sm:rounded-none sm:border-y-0 sm:border-r-0">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" />
          <header className="flex items-start justify-between gap-3 px-5 py-5">
            <div><h2 id="notification-title" className="text-lg font-semibold">Notifications</h2><p className="mt-1 text-xs text-muted-foreground">Your schedule and payments, at the right time.</p></div>
            <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-surface-2"><X className="h-4 w-4" /></button>
          </header>
          <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border px-5 py-3">
            <div role="group" aria-label="Notification filter" className="flex gap-1 rounded-lg bg-surface-2 p-1">
              {(['unread', 'all'] as const).map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={cn('rounded-md px-3 py-1.5 text-xs', tab === value ? 'bg-card font-medium text-foreground shadow-sm' : 'text-muted-foreground')}>{value === 'unread' ? `Unread (${count})` : 'All'}</button>)}
            </div>
            <button type="button" disabled={!count || pending} onClick={() => readAll.mutate()} className="inline-flex items-center gap-1.5 text-xs text-primary disabled:opacity-40"><CheckCheck className="h-3.5 w-3.5" />Mark all read</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {query.isPending ? <p role="status" className="p-6 text-center text-sm text-muted-foreground">Loading reminders…</p>
              : query.isError ? <div role="alert" className="p-6 text-center"><p className="text-sm">Couldn’t load reminders</p><button type="button" onClick={() => { void query.refetch() }} className="mt-3 inline-flex items-center gap-1 text-xs text-primary"><RefreshCw className="h-3 w-3" />Retry</button></div>
              : items.length ? <ul className="space-y-3">{items.map(item => <ReminderItem key={item.id} item={item} pending={pending} onOpen={() => setOpen(false)} onAction={(id, actionName, minutes) => action.mutate({ id, action: actionName, minutes })} />)}</ul>
              : <div className="px-4 py-12 text-center"><Bell className="mx-auto mb-3 h-7 w-7 text-muted-foreground/60" /><p className="text-sm font-medium">{tab === 'unread' ? 'You’re all caught up' : 'No reminders due'}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Events appear 30 minutes before they start. Payments appear a day before they’re due. Snoozed reminders return when their time is up.</p></div>}
          </div>
        </motion.div>
      </>}
    </AnimatePresence>, document.body)}
  </>
}
