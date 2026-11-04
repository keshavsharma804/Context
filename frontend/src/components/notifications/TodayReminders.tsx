import { Bell, ArrowUpRight } from 'lucide-react'
import { useReminders, useReminderActions } from '@/hooks/useReminders'
import ReminderItem from './ReminderItem'

export default function TodayReminders({ preview = false }: { preview?: boolean }) {
  const query = useReminders(!preview)
  const { action } = useReminderActions(query.timezone)
  const items = query.data?.notifications.slice(0, 3) ?? []
  return <section aria-label="Smart reminders" className="rounded-2xl border border-border/70 bg-card/70 p-5">
    <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Bell className="h-4 w-4 text-primary" />Smart reminders</h3>
      {!preview && <button type="button" onClick={() => window.dispatchEvent(new Event('context:open-notifications'))} className="inline-flex items-center gap-1 text-xs text-primary">View all{query.data?.unread_count ? ` (${query.data.unread_count} unread)` : ''}<ArrowUpRight className="h-3 w-3" /></button>}
    </header>
    {!preview && query.isPending ? <p role="status" className="text-xs text-muted-foreground">Checking reminders…</p>
      : !preview && query.isError ? <div role="alert" className="text-xs text-muted-foreground">Couldn’t load reminders. <button type="button" onClick={() => { void query.refetch() }} className="text-primary hover:underline">Retry</button></div>
      : items.length ? <ul className="grid gap-3 xl:grid-cols-3">{items.map(item => <ReminderItem key={item.id} item={item} compact pending={action.isPending} onAction={(id, actionName, minutes) => action.mutate({ id, action: actionName, minutes })} />)}</ul>
      : <p className="text-xs leading-relaxed text-muted-foreground">{preview ? 'Sign in to see reminders for your events, interviews, renewals, and repayments.' : 'No reminders due right now. Upcoming events and payments will appear here when it’s time.'}</p>}
  </section>
}
