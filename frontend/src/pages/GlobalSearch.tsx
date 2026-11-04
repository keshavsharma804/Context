import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Briefcase, CalendarDays, FileText, Globe, Mail, Receipt, Search, StickyNote, Users, Wallet } from 'lucide-react'
import { fetchGlobalSearch } from '@/lib/api'
import { money, shortDate } from '@/lib/format'
import { PageHeader, ErrorPanel } from '@/components/pages/PageChrome'
import RecordTypeSelect from '@/components/ui/RecordTypeSelect'

const TYPES = [
  ['all', 'All records'], ['expense', 'Expenses'], ['note', 'Notes'], ['person', 'People'],
  ['event', 'Events'], ['file', 'Files'], ['journal', 'Journal'], ['email', 'Email'],
  ['job', 'Jobs'], ['subscription', 'Subscriptions'], ['debt', 'Debts'], ['history', 'Browsing history'],
]
const ICONS = { expense: Wallet, note: StickyNote, person: Users, event: CalendarDays, file: FileText, journal: BookOpen, email: Mail, job: Briefcase, subscription: Receipt, debt: Wallet, history: Globe }

export default function GlobalSearch() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q')?.trim() || ''
  const requestedKind = params.get('kind') || 'all'
  const kind = TYPES.some(type => type[0] === requestedKind) ? requestedKind : 'all'
  const [input, setInput] = useState(q)
  const [lastQuery, setLastQuery] = useState(q)
  if (lastQuery !== q) { setLastQuery(q); setInput(q) }
  useEffect(() => {
    if (input.trim() === q) return
    const timer = window.setTimeout(() => setParams({ q: input.trim(), kind }, { replace: true }), 300)
    return () => window.clearTimeout(timer)
  }, [input, q, kind, setParams])
  const query = useQuery({
    queryKey: ['global-search', q, kind],
    queryFn: ({ signal }) => fetchGlobalSearch(q, kind, signal),
    enabled: q.length >= 2,
  })
  const count = query.data?.results.length ?? 0
  const returnTo = '/search?' + new URLSearchParams({ q, kind }).toString()
  return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
    <PageHeader icon={Search} title="Global search" subtitle="Find the record you need, wherever you saved it." />
    <form onSubmit={event => { event.preventDefault(); setParams({ q: input.trim(), kind }) }} className="mt-6 flex flex-col gap-3 sm:flex-row">
      <label className="relative min-w-0 flex-1"><span className="sr-only">Search all records</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><input autoFocus maxLength={200} value={input} onChange={event => setInput(event.target.value)} placeholder="Try a merchant, person, topic, or amount…" className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>
      <RecordTypeSelect value={kind} options={TYPES} onChange={value => setParams({ q: input.trim(), kind: value })} />
    </form>
    {q.length < 2 ? <div className="py-20 text-center"><Search className="mx-auto mb-4 h-8 w-8 text-muted-foreground/50" /><h2 className="font-medium">What are you looking for?</h2><p className="mt-2 text-sm text-muted-foreground">Enter at least two characters to search your saved records.</p></div>
      : query.isPending || input.trim() !== q ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">Searching your records…</p>
      : query.isError ? <ErrorPanel className="mt-5" error={query.error} onRetry={() => { void query.refetch() }} retrying={query.isFetching} />
      : <section aria-label="Search results" className="mt-5">
        <p role="status" className="mb-3 [overflow-wrap:anywhere] text-xs text-muted-foreground">{count}{query.data?.has_more ? '+' : ''} {count === 1 ? 'match' : 'matches'} for “{q}”{query.data?.has_more ? '. Refine your search or choose a result type.' : ''}</p>
        {!query.data?.results.length ? <div className="rounded-2xl border border-border bg-card p-8 text-center"><h2 className="text-sm font-medium">No matching records</h2><p className="mt-2 text-xs text-muted-foreground">Try fewer words, another spelling, or a different result type.</p></div>
          : <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/70">{query.data.results.map(item => {
            const Icon = ICONS[item.kind as keyof typeof ICONS] || FileText
            return <li key={`${item.kind}:${item.id}`} className="p-5">
              <div className="flex items-start gap-3"><Icon className="mt-1 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 flex-1 [overflow-wrap:anywhere] text-sm font-semibold">{item.title}</h2>{item.amount !== null && <span className="shrink-0 text-sm font-medium tabular-nums">{money(item.amount)}</span>}</div>
                <p className="mt-1 text-[11px] text-muted-foreground">{TYPES.find(type => type[0] === item.kind)?.[1]}{item.occurred_at ? ` · ${shortDate(item.occurred_at)}` : ''}</p>
                {item.snippet && <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] text-xs leading-relaxed text-muted-foreground">{item.snippet}</p>}
                {/^https?:\/\//.test(item.href) ? <a href={item.href} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">Open page</a>
                  : <Link to={item.href} state={{ returnTo }} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">Open {item.kind === 'expense' ? 'expense' : TYPES.find(type => type[0] === item.kind)?.[1] || 'record'}</Link>}
              </div></div>
            </li>
          })}</ul>}
      </section>}
  </div>
}
