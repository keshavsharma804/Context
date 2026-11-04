import { useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, X } from 'lucide-react'
import { format } from 'date-fns'
import { postCapturePreview, postCaptureSave, type CaptureDraft, type CaptureKind } from '@/lib/api'
import { useModalFocus } from '@/hooks/useModalFocus'
import { Button } from '@/components/ui/button'
import RecordTypeSelect from '@/components/ui/RecordTypeSelect'

const TYPES: { value: CaptureKind; label: string }[] = [
  { value: 'expense', label: 'Expense' }, { value: 'event', label: 'Event / interview' },
  { value: 'note', label: 'Note' }, { value: 'debt', label: 'Debt / IOU' },
  { value: 'subscription', label: 'Subscription' }, { value: 'contact', label: 'Contact check-in' },
]
const EXAMPLES = ['spent 250 on lunch', 'interview Friday at 3 pm', 'note: Call the printer', 'lent 500 to Alex', 'sub Netflix 649 monthly']
const fieldClass = 'mt-1.5 min-w-0 max-w-full w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring'

export default function QuickCapture({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useModalFocus(ref, onClose)
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<CaptureDraft | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [requestId, setRequestId] = useState('')
  const client = useQueryClient()
  const preview = useMutation({
    mutationKey: ['capture', 'preview'],
    mutationFn: () => postCapturePreview(text.trim(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
    onSuccess: result => { setDraft(result.draft); setWarnings(result.warnings); setRequestId(crypto.randomUUID()) },
  })
  const save = useMutation({
    mutationKey: ['capture', 'save'],
    mutationFn: (value: CaptureDraft) => postCaptureSave({ ...value, start_at: value.start_at || null, end_at: value.end_at || null, due_date: value.due_date || null }, requestId),
    onSuccess: result => {
      const related: Record<CaptureKind, string[]> = {
        expense: ['money', 'config'], event: ['calendar', 'jobs', 'config'], note: ['note'],
        debt: ['debts'], subscription: ['subscriptions'], contact: ['people', 'person', 'config'],
      }
      for (const key of ['home', 'global-search', 'search-record', ...related[result.kind]]) {
        void client.invalidateQueries({ queryKey: [key] })
      }
    },
  })
  const update = <K extends keyof CaptureDraft>(key: K, value: CaptureDraft[K]) => setDraft(current => current ? { ...current, [key]: value } : current)
  const input = (key: keyof CaptureDraft, label: string, type = 'text', required = false) => <label className="block min-w-0 text-xs font-medium">{label}<input className={fieldClass} type={type} required={required} maxLength={key === 'title' ? 200 : 120} step={type === 'number' ? '0.01' : undefined} min={type === 'number' ? '0.01' : undefined} value={draft?.[key] ?? ''} onChange={event => update(key, type === 'number' ? (event.target.value === '' ? null : Number(event.target.value)) : event.target.value)} /></label>
  const submit = (event: FormEvent) => { event.preventDefault(); if (draft) save.mutate(draft); else preview.mutate() }

  return createPortal(<div className="fixed inset-0 z-[160] flex items-end justify-center sm:items-center sm:p-5">
    <button tabIndex={-1} aria-label="Close capture backdrop" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="capture-title" className="relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-6 sm:pb-6">
      <header className="mb-5 flex items-start justify-between gap-4"><div><h2 id="capture-title" className="flex items-center gap-2 text-lg font-semibold"><Plus className="h-4 w-4 text-primary" />Quick capture</h2><p className="mt-1 text-xs text-muted-foreground">Type it naturally. Review the details, then save.</p></div><button type="button" aria-label="Close quick capture" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-surface-2"><X className="h-4 w-4" /></button></header>
      {save.isSuccess ? <div className="space-y-5 py-4 text-center"><Check className="mx-auto h-9 w-9 text-emerald-500" /><h3 className="font-semibold">Entry saved</h3><p className="text-sm text-muted-foreground">Your {save.data.kind} is ready.</p><div className="flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={() => { setDraft(null); setText(''); save.reset(); preview.reset() }}>Add another</Button><Link className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" to={save.data.href} onClick={onClose}>Open saved entry</Link></div></div>
        : <form onSubmit={submit} className="space-y-5">
          {!draft ? <>
            <label className="block min-w-0 text-xs font-medium">What would you like to save?<textarea className={fieldClass} rows={3} autoFocus required maxLength={2000} disabled={preview.isPending} value={text} onChange={event => setText(event.target.value)} placeholder="spent 250 on lunch, or meeting tomorrow at 10 am" /></label>
            <div className="flex flex-wrap gap-2">{EXAMPLES.map(example => <button key={example} type="button" disabled={preview.isPending} onClick={() => setText(example)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">{example}</button>)}</div>
          </> : <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
            <div className="min-w-0"><p className="text-xs font-medium">Save as</p><RecordTypeSelect label="Save as" className="mt-1.5 w-full" disabled={save.isPending} value={draft.kind} options={TYPES.map(type => [type.value, type.label])} onChange={value => setDraft({ ...draft, kind: value as CaptureKind, date: draft.date || format(new Date(), 'yyyy-MM-dd'), content: draft.content || text })} /></div>
            {warnings.length > 0 && <ul className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-500 light:text-amber-800">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
            {['event', 'subscription'].includes(draft.kind) && input('title', draft.kind === 'event' ? 'Event title' : 'Subscription name', 'text', true)}
            {['expense', 'debt', 'subscription'].includes(draft.kind) && input('amount', 'Amount (INR)', 'number', true)}
            {draft.kind === 'expense' && input('merchant', 'Merchant / what it was for')}
            {['expense', 'subscription'].includes(draft.kind) && input('category', 'Category')}
            {['expense', 'debt', 'contact'].includes(draft.kind) && input('date', 'Date', 'date', true)}
            {['debt', 'contact'].includes(draft.kind) && input('person', 'Person', 'text', true)}
            {draft.kind === 'debt' && <div><p className="text-xs font-medium">Direction</p><RecordTypeSelect label="Direction" className="mt-1.5 w-full" disabled={save.isPending} value={draft.direction || 'lent'} options={[[ 'lent', 'They owe me' ], [ 'borrowed', 'I owe them' ]]} onChange={value => update('direction', value as 'lent' | 'borrowed')} /></div>}
            {draft.kind === 'event' && <>
              <div className="grid gap-4 sm:grid-cols-2">{input('start_at', 'Starts', 'datetime-local', true)}{input('end_at', 'Ends', 'datetime-local')}</div>
              <div><p className="text-xs font-medium">Category</p><RecordTypeSelect label="Category" className="mt-1.5 w-full" disabled={save.isPending} value={draft.category || 'personal'} options={['personal', 'office', 'academic', 'interview', 'other'].map(value => [value, value[0].toUpperCase() + value.slice(1)])} onChange={value => update('category', value)} /></div>
              {draft.category === 'interview' && input('company', 'Company (optional)')}
              {input('location', 'Location (optional)')}
            </>}
            {draft.kind === 'subscription' && <div><p className="text-xs font-medium">Billing cycle</p><RecordTypeSelect label="Billing cycle" className="mt-1.5 w-full" disabled={save.isPending} value={draft.billing_cycle || 'monthly'} options={['monthly', 'yearly', 'quarterly', 'weekly'].map(value => [value, value[0].toUpperCase() + value.slice(1)])} onChange={value => update('billing_cycle', value as CaptureDraft['billing_cycle'])} /></div>}
            {['debt', 'subscription'].includes(draft.kind) && input('due_date', draft.kind === 'subscription' ? 'Next renewal' : 'Due date (optional)', 'date', draft.kind === 'subscription')}
            {['note', 'debt'].includes(draft.kind) && <label className="block min-w-0 text-xs font-medium">{draft.kind === 'note' ? 'Note' : 'Description (optional)'}<textarea className={fieldClass} rows={4} maxLength={10000} required={draft.kind === 'note'} value={draft.content || ''} onChange={event => update('content', event.target.value)} /></label>}
          </fieldset>}
          {(preview.error || save.error) && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-xs text-red-400 light:text-red-700">{(save.error || preview.error)?.message}</p>}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            {draft ? <button type="button" disabled={save.isPending} onClick={() => { setDraft(null); preview.reset(); save.reset() }} className="text-xs text-muted-foreground hover:text-foreground">Edit original text</button> : <span className="text-xs text-muted-foreground">Nothing is saved until you confirm.</span>}
            <Button type="submit" disabled={preview.isPending || save.isPending || (!draft && !text.trim())}>{save.isPending ? 'Saving…' : preview.isPending ? 'Preparing…' : draft ? 'Confirm & save' : 'Review entry'}</Button>
          </footer>
        </form>}
    </div>
  </div>, document.body)
}
