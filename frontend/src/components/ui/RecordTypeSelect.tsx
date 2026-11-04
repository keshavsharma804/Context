import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function RecordTypeSelect({ value, options, onChange, label = 'Result type', className, disabled = false, compact = false }: {
  value: string
  options: string[][]
  onChange: (value: string) => void
  label?: string
  className?: string
  disabled?: boolean
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const search = useRef({ text: '', time: 0 })
  const id = useId()
  const selected = Math.max(0, options.findIndex(option => option[0] === value))
  const close = () => { setOpen(false); trigger.current?.focus() }

  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true })
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')
    if (!items?.length) return
    const current = Array.from(items).indexOf(document.activeElement as HTMLButtonElement)
    let next = current
    if (event.key === 'ArrowDown') next = (current + 1) % items.length
    else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
    else if (event.key === 'Tab') { setOpen(false); return }
    else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = event.timeStamp
      search.current = { text: (now - search.current.time < 600 ? search.current.text : '') + event.key.toLowerCase(), time: now }
      const match = options.findIndex(option => option[1].toLowerCase().startsWith(search.current.text))
      if (match < 0) return
      next = match
    } else return
    event.preventDefault()
    items[next]?.focus()
    items[next]?.scrollIntoView({ block: 'nearest' })
  }

  return <div ref={root} className={`relative ${className ?? 'w-full shrink-0 sm:w-48'}`} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }}>
    <button ref={trigger} type="button" disabled={disabled} aria-label={`${label}: ${options[selected]?.[1]}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={id}
      onClick={() => { search.current = { text: '', time: 0 }; setOpen(current => !current) }}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) } }}
      className={cn('flex w-full items-center justify-between gap-3 border border-border bg-card text-left text-foreground outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', compact ? 'min-h-9 rounded-lg px-2.5 py-1.5 text-xs' : 'h-full min-h-11 rounded-xl px-4 py-3 text-sm')}>
      <span className="truncate">{options[selected]?.[1]}</span><ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && !disabled && <div ref={list} id={id} role="listbox" aria-label={label} onKeyDown={navigate}
      className="absolute right-0 top-full z-40 mt-2 max-h-[min(320px,45dvh)] w-full overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-1.5 shadow-xl">
      {options.map(([key, label]) => <button key={key} type="button" role="option" aria-selected={value === key} tabIndex={-1}
        onClick={() => { onChange(key); close() }}
        className={cn('flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left outline-none transition-colors hover:bg-surface-2 focus:bg-surface-2', compact ? 'text-xs' : 'text-sm', value === key ? 'bg-primary/10 font-medium text-primary' : 'text-foreground')}>
        <span>{label}</span>{value === key && <Check aria-hidden className="h-4 w-4 shrink-0" />}
      </button>)}
    </div>}
  </div>
}
