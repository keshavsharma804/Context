import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, CalendarDays, Check, Mail, Users, Wallet, BookOpen, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { postPersonContacted, type TodayData } from '@/lib/api'
import { clockTime, money, shortDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function Section({ title, icon: Icon, href, action, children, className }: {
  title: string; icon: LucideIcon; href: string; action: string; children: ReactNode; className?: string
}) {
  return <section aria-label={title} className={cn('min-w-0 rounded-2xl border border-border/70 bg-card/70', className)}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</h3>
      <Link to={href} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">{action}<ArrowUpRight className="h-3 w-3" /></Link>
    </div>
    {children}
  </section>
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return <div className="px-5 py-8"><p className="text-sm text-foreground/80">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p></div>
}

function dueLabel(value: string, today: string) {
  const day = value.slice(0, 10)
  if (day < today) return 'Overdue'
  if (day === today) return 'Due today'
  return shortDate(day)
}

export default function TodayView({ data, date, symbol = '₹', preview = false }: {
  data?: TodayData; date: string; symbol?: string; preview?: boolean
}) {
  const client = useQueryClient()
  const contact = useMutation({
    mutationFn: postPersonContacted,
    onSuccess: (_result, name) => {
      void client.invalidateQueries({ queryKey: ['home'] })
      void client.invalidateQueries({ queryKey: ['people'] })
      void client.invalidateQueries({ queryKey: ['person', name] })
      toast.success(`Marked ${name} as contacted`)
    },
    onError: error => toast.error(error.message),
  })
  const schedule = data?.schedule ?? []
  const emails = data?.emails ?? []
  const contacts = data?.contacts ?? []
  const journal = data?.journal
  const payments = [
    ...(data?.subscriptions ?? []).map(item => ({
      key: `subscription:${item.id}`, title: item.name, amount: item.amount,
      date: item.next_renewal, detail: 'Subscription renewal', href: '/subscriptions',
    })),
    ...(data?.debts ?? []).map(item => ({
      key: `debt:${item.id}`, title: item.person, amount: item.amount,
      date: item.due_date, detail: item.direction === 'borrowed' ? 'You owe' : 'Owed to you', href: '/debts',
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key))

  return <div className="flex flex-col gap-6">
    {preview && <p className="rounded-xl border border-border/70 bg-card/50 px-4 py-3 text-sm text-muted-foreground">Today preview. <Link className="font-medium text-primary hover:underline" to="/auth">Sign in</Link> to see your schedule and things to take care of.</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Section title="Your schedule" icon={CalendarDays} href="/calendar" action="Open calendar">
        {schedule.length ? <ul className="divide-y divide-border/50 px-5">
          {schedule.map(item => <li key={item.id}>
            <Link to={item.kind === 'interview' ? '/jobs' : '/calendar'} className="group flex gap-4 py-4">
              <span className="w-12 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">{clockTime(item.start_at)}</span>
              <div className="min-w-0 flex-1 border-l-2 border-primary/40 pl-4">
                <p className="break-words text-sm font-medium group-hover:text-primary">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.kind === 'interview' ? 'Interview' : 'Event'}{item.end_at ? ` · until ${clockTime(item.end_at)}` : ''}{item.location ? ` · ${item.location}` : ''}</p>
              </div>
              <ArrowUpRight aria-hidden className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Link>
          </li>)}
        </ul> : <Empty title="Nothing scheduled today" hint="Add an event or interview from your calendar when you need one." />}
      </Section>

      <Section title="Due & coming up" icon={Wallet} href="/subscriptions" action="Manage payments">
        <p className="px-5 pt-4 text-xs text-muted-foreground">Overdue items and payments in the next seven days.</p>
        {payments.length ? <ul className="divide-y divide-border/50 px-5 pb-1">
          {payments.map(item => <li key={item.key}><Link to={item.href} className="flex items-start justify-between gap-3 py-4 hover:text-primary">
            <div className="min-w-0"><p className="break-words text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></div>
            <div className="shrink-0 text-right"><p className="text-sm font-medium tabular-nums">{money(item.amount, symbol)}</p><p className={cn('mt-1 text-xs', item.date.slice(0, 10) < date ? 'text-red-400 light:text-red-700' : 'text-muted-foreground')}>{dueLabel(item.date, date)}</p></div>
          </Link></li>)}
        </ul> : <Empty title="No payments need attention" hint="Renewals and unsettled debts with due dates will appear here." />}
      </Section>
    </div>

    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Section title="Emails to reply to" icon={Mail} href="/email" action="Open email">
        {emails.length ? <ul className="divide-y divide-border/50 px-5">
          {emails.map(item => <li key={item.id}><Link to="/email" className="group block py-4">
            <p className="break-words text-sm font-medium group-hover:text-primary">{item.subject || 'No subject'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.from_name || item.from_addr || 'Unknown sender'} · {shortDate(item.received_at)}</p>
          </Link></li>)}
        </ul> : <Empty title="No unanswered emails flagged" hint="Connect or sync Gmail in Email to bring your follow-ups here." />}
      </Section>

      <Section title="People to check in with" icon={Users} href="/people" action="Open people">
        {contacts.length ? <ul className="divide-y divide-border/50 px-5">
          {contacts.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <Link to={`/people/${encodeURIComponent(item.name)}`} className="min-w-0 hover:text-primary"><p className="break-words text-sm font-medium">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">Last contact {shortDate(item.last_contact)}</p></Link>
            <Button variant="outline" size="xs" disabled={preview || contact.isPending} aria-label={`Mark ${item.name} as contacted`} onClick={() => contact.mutate(item.name)}><Check className="h-3 w-3" />Contacted</Button>
          </li>)}
        </ul> : <Empty title="No follow-ups due" hint="People you haven’t contacted for two weeks will appear here." />}
      </Section>
    </div>

    <section aria-label="Daily check-in" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card/70 px-5 py-5">
      <div className="flex min-w-0 items-start gap-3"><BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><h3 className="text-sm font-semibold">{journal ? 'You checked in today' : 'How are you doing today?'}</h3><p className="mt-1 break-words text-xs text-muted-foreground">{journal ? journal.headline || 'Your daily journal entry is saved.' : 'Take a moment to note your mood and what’s on your mind.'}</p></div></div>
      <Link to="/journal" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2">{journal ? 'Open journal' : 'Check in'}<ArrowUpRight className="h-3 w-3" /></Link>
    </section>
  </div>
}
