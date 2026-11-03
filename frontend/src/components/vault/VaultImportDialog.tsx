import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { useVault } from '@/store/vault'
import type { VaultCategory } from '@/lib/api'
import { saveVaultImport } from '@/lib/vault-import-save'
import { detectColumns, IMPORT_FIELDS, IMPORT_MAX_BYTES, loadGoogleSheet, prepareImport, readImportSheets, selectImportHeader, type ImportSheet } from '@/lib/vault-import'

const LABELS: Record<VaultCategory, string> = { password: 'Logins', bank: 'Bank accounts', card: 'Cards', id: 'IDs', upi: 'UPI', note: 'Notes' }
const control = 'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm'

export function VaultImportDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { key, touch } = useVault()
  const [sheets, setSheets] = useState<ImportSheet[]>([])
  const [tab, setTab] = useState(0)
  const [mapping, setMapping] = useState<string[]>([])
  const [category, setCategory] = useState<VaultCategory | 'auto'>('auto')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [skipIncomplete, setSkipIncomplete] = useState(false)
  const active = useRef(true), stop = useRef(false), controller = useRef<AbortController | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLElement>(null)
  const sheet = sheets[tab]
  const preview = useMemo(() => sheet ? prepareImport(sheet, mapping, category) : { items: [], errors: [] }, [sheet, mapping, category])
  const pending = preview.items.filter(item => !saved.has(`${tab}:${item.row}`))
  const ignored = mapping.filter(field => !field).length
  const blocked = preview.errors.some(message => !message.startsWith('Row ')) || (preview.errors.length > 0 && !skipIncomplete)

  useEffect(() => {
    active.current = true
    const previousFocus = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { active.current = false; stop.current = true; controller.current?.abort(); previousFocus?.focus() }
  }, [])

  const load = async (getSheets: (signal: AbortSignal) => Promise<ImportSheet[]>) => {
    controller.current?.abort()
    controller.current = new AbortController()
    setLoading(true); setError(''); setSheets([]); setSaved(new Set()); setSkipIncomplete(false)
    try {
      const result = await getSheets(controller.current.signal)
      if (!active.current) return
      setSheets(result); setTab(0); setMapping(detectColumns(result[0].headers))
    } catch (failure) {
      if (active.current) setError(failure instanceof Error ? failure.message : 'Could not read this spreadsheet.')
    } finally { if (active.current) setLoading(false) }
  }

  const upload = (file?: File) => {
    if (!file) return
    if (file.size > IMPORT_MAX_BYTES) { setError('Use a spreadsheet smaller than 5 MB.'); return }
    if (!/\.(xlsx|xls|csv|tsv|gsheet)$/i.test(file.name)) { setError('Choose XLSX, XLS, CSV, TSV, or a Google Sheets shortcut.'); return }
    void load(async signal => {
      if (/\.gsheet$/i.test(file.name)) {
        const shortcut = JSON.parse(await file.text())
        if (typeof shortcut.url !== 'string') throw new Error('This shortcut has no sheet URL. Download the spreadsheet as XLSX or CSV instead.')
        return loadGoogleSheet(shortcut.url, signal)
      }
      return readImportSheets(/\.(csv|tsv)$/i.test(file.name) ? await file.text() : await file.arrayBuffer())
    })
  }

  const save = async () => {
    if (!key || useVault.getState().key !== key || saving || blocked || !pending.length) return
    setSaving(true); setError(''); stop.current = false
    const { saved: count, error: failureMessage } = await saveVaultImport({ items: pending, key, touch,
      canContinue: () => !stop.current && active.current && useVault.getState().key === key,
      onSaved: item => { if (active.current) setSaved(previous => new Set(previous).add(`${tab}:${item.row}`)) },
    })
    if (count) onSuccess()
    if (!active.current) return
    setSaving(false)
    if (count) toast.success(`Imported ${count} encrypted item${count === 1 ? '' : 's'}.`)
    if (failureMessage) setError(`${failureMessage} Successfully saved rows are marked below and will not be submitted again.`)
  }

  if (!key || typeof document === 'undefined') return null
  return createPortal(<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="vault-import-title" className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-5 sm:p-6"
      onKeyDown={event => {
        if (event.key === 'Escape' && !saving) onClose()
        if (event.key === 'Tab') {
          const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="file"]), select:not(:disabled), summary') || [])].filter(element => element.getClientRects().length)
          const first = controls[0], last = controls.at(-1)
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }
      }}>
      <header className="mb-5 flex items-start justify-between gap-4">
        <div><h2 id="vault-import-title" className="text-lg font-semibold">Import to your vault</h2><p className="mt-1 text-sm text-muted-foreground">Upload a spreadsheet or load a readable Google Sheets URL. Review the columns before saving.</p></div>
        <button type="button" aria-label="Close import" disabled={saving} onClick={onClose} className="rounded-lg p-2 hover:bg-surface-2"><X className="h-4 w-4" /></button>
      </header>
      <p className="mb-4 rounded-xl border border-border p-3 text-xs leading-relaxed text-muted-foreground">Files are parsed in your browser and encrypted before saving. For private Google Sheets, use File → Download → Microsoft Excel (.xlsx) or CSV, then upload it. Keep sheets containing passwords private.</p>
      <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv,.tsv,.gsheet" className="hidden" onChange={event => { upload(event.target.files?.[0]); event.target.value = '' }} />
      <button type="button" disabled={loading || saving} onClick={() => fileInput.current?.click()} className="mb-4 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"><Upload className="h-4 w-4" />Upload spreadsheet</button>
      <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void load(signal => loadGoogleSheet(url, signal)) }}>
        <input aria-label="Google Sheets URL" type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" disabled={loading || saving} className={`${control} min-w-0 flex-1`} required />
        <button disabled={loading || saving} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-surface-2 disabled:opacity-50">Load sheet</button>
      </form>
      {loading && <p role="status" className="mt-4 text-sm text-muted-foreground">Reading spreadsheet…</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
      {sheet && <div className="mt-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted-foreground">Sheet tab<select className={`${control} mt-1`} disabled={saving} value={tab} onChange={event => { const index = Number(event.target.value); setTab(index); setMapping(detectColumns(sheets[index].headers)); setError(''); setSkipIncomplete(false) }}>{sheets.map((item, index) => <option key={index} value={index}>{item.name}</option>)}</select></label>
          <label className="text-xs text-muted-foreground">Header row<select className={`${control} mt-1`} disabled={saving} value={sheet.headerRow || 1} onChange={event => {
            try {
              const next = selectImportHeader(sheet, Number(event.target.value))
              setSheets(previous => previous.map((item, index) => index === tab ? next : item))
              setMapping(detectColumns(next.headers)); setSkipIncomplete(false); setError('')
            } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not select this row.') }
          }}>{sheet.sourceRows?.slice(0, 25).map((row, index) => <option key={index} value={(sheet.sourceStartRow || 1) + index}>Row {(sheet.sourceStartRow || 1) + index}{(sheet.headerRow || 1) === (sheet.sourceStartRow || 1) + index ? ' · selected' : ''} · {detectColumns(row).filter(Boolean).length} recognized</option>)}</select></label>
          <label className="text-xs text-muted-foreground">Save as<select className={`${control} mt-1`} disabled={saving} value={category} onChange={event => setCategory(event.target.value as VaultCategory | 'auto')}><option value="auto">Detect from each row</option>{Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <details className="rounded-xl border border-border p-3" open={preview.errors.length > 0 || undefined}>
          <summary className="cursor-pointer text-sm font-medium">Column mapping{ignored ? ` · ${ignored} ignored` : ''}</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">{sheet.headers.map((header, index) => <label key={index} className="text-xs text-muted-foreground">{header}<select disabled={saving} value={mapping[index] || ''} className={`${control} mt-1`} onChange={event => setMapping(previous => previous.map((field, column) => column === index ? event.target.value : field))}><option value="">Ignore column</option>{IMPORT_FIELDS.map(field => <option key={field} value={field}>{field.replace(/_/g, ' ')}</option>)}</select></label>)}</div>
        </details>
        {preview.errors.length > 0 && <div role="alert" className={`text-xs ${blocked ? 'text-destructive' : 'text-muted-foreground'}`}><p>Some rows need attention. Fix the mapping or source rows:</p>{preview.errors.slice(0, 5).map((message, index) => <p key={index} className="mt-1">{message}</p>)}{preview.errors.length > 5 && <p>And {preview.errors.length - 5} more row errors.</p>}
          {preview.items.length > 0 && preview.errors.every(message => message.startsWith('Row ')) && <label className="mt-3 flex cursor-pointer items-center gap-2 text-foreground"><input type="checkbox" checked={skipIncomplete} disabled={saving} onChange={event => setSkipIncomplete(event.target.checked)} />Skip these {preview.errors.length} incomplete rows and import the valid entries</label>}
        </div>}
        <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-left text-xs"><thead><tr className="border-b border-border text-muted-foreground"><th className="p-3">Row</th><th className="p-3">Title</th><th className="p-3">Category</th><th className="p-3">Status</th></tr></thead><tbody>{preview.items.slice(0, 8).map(item => <tr key={item.row} className="border-b border-border/40"><td className="p-3">{item.row}</td><td className="max-w-56 truncate p-3">{item.title}</td><td className="p-3">{LABELS[item.category]}</td><td className="p-3">{saved.has(`${tab}:${item.row}`) ? 'Saved' : 'Ready'}</td></tr>)}</tbody></table></div>
        <p className="text-xs text-muted-foreground">{preview.items.length} valid rows · {saved.size} saved this session. Passwords and other field values are hidden in this preview. Up to 1,000 rows and 5 MB per file.</p>
        <footer className="flex flex-wrap justify-end gap-2">
          {saving ? <button type="button" onClick={() => { stop.current = true }} className="rounded-xl border border-border px-4 py-2 text-sm">Stop after current rows</button> : <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm">Close</button>}
          <button type="button" onClick={() => void save()} disabled={saving || loading || !pending.length || blocked} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40">{saving ? `Saving… ${saved.size} complete` : `Encrypt & import ${pending.length} items`}</button>
        </footer>
      </div>}
    </section>
  </div>, document.body)
}
