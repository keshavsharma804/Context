import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { fetchSearchRecord } from '@/lib/api'
import { money } from '@/lib/format'
import { PageHeader, ErrorPanel } from '@/components/pages/PageChrome'

const SECTIONS: Record<string, { label: string; href: string }> = {
  expense: { label: 'Money', href: '/money' }, email: { label: 'Email', href: '/email' },
  job: { label: 'Jobs', href: '/jobs' }, subscription: { label: 'Subscriptions', href: '/subscriptions' }, debt: { label: 'Debts', href: '/debts' },
}
const LABELS: Record<string, string> = { from_name: 'From', from_addr: 'Sender address', to_addr: 'To', body_snippet: 'Message', received_at: 'Received', spent_at: 'Date', created_at: 'Created', applied_at: 'Applied', next_renewal: 'Next renewal', due_date: 'Due date', taken_at: 'Date', auto_renew: 'Auto renew', payment_method: 'Payment method', billing_cycle: 'Billing cycle', jd: 'Job description', url: 'Website' }

export default function RecordDetail() {
  const { kind = '', id = '' } = useParams()
  const location = useLocation()
  const returnTo = typeof location.state?.returnTo === 'string' && /^\/search(?:\?|$)/.test(location.state.returnTo) ? location.state.returnTo : '/search'
  const valid = Boolean(SECTIONS[kind]) && /^\d+$/.test(id)
  const query = useQuery({ queryKey: ['search-record', kind, id], queryFn: () => fetchSearchRecord(kind, id), enabled: valid })
  const record = query.data?.record
  const title = record?.merchant || record?.person || record?.name || record?.company || record?.subject || 'Record details'
  return <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
    <PageHeader icon={FileText} title={String(title)} backTo={returnTo} backLabel="Global search" />
    {!valid ? <p className="mt-6">Record not found.</p> : query.isPending ? <p role="status" className="mt-6 text-sm text-muted-foreground">Loading record…</p> : query.isError ? <ErrorPanel className="mt-6" error={query.error} onRetry={() => { void query.refetch() }} retrying={query.isFetching} /> : <>
      <dl className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card px-5">{Object.entries(record || {}).filter(([key, value]) => key !== 'id' && value !== null && value !== '').map(([key, value]) => <div key={key} className="py-4"><dt className="text-xs capitalize text-muted-foreground">{LABELS[key] || key.replaceAll('_', ' ')}</dt><dd className="mt-1.5 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-relaxed">{key === 'amount' ? money(Number(value)) : ['settled', 'auto_renew'].includes(key) ? value ? 'Yes' : 'No' : String(value)}</dd></div>)}</dl>
      <Link to={SECTIONS[kind].href} className="mt-5 inline-block rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2">Open {SECTIONS[kind].label}</Link>
    </>}
  </div>
}
