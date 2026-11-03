import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Building2,
  CreditCard,
  FileBadge2,
  KeyRound,
  StickyNote,
  Eye,
  EyeOff,
  Copy,
  Check,
  MoreVertical,
  Pencil,
  Trash2,
  ShieldCheck,
  Smartphone,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSound } from '@/hooks/useSound'
import { cn } from '@/lib/utils'
import type { VaultCategory, VaultItemDecrypted } from '@/lib/api'
import { visibleVaultFields } from '@/lib/vault-fields'

interface VaultItemCardProps {
  item: VaultItemDecrypted
  index?: number
  onEdit: (item: VaultItemDecrypted) => void
  onDelete: (id: number) => void
}

const CATEGORY_META: Record<
  VaultCategory,
  { label: string; icon: typeof Building2; color: string; borderGlow: string; tagClass: string }
> = {
  bank: {
    label: 'Bank Account',
    icon: Building2,
    color: '#10b981',
    borderGlow: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
    tagClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  card: {
    label: 'Payment Card',
    icon: CreditCard,
    color: '#6366f1',
    borderGlow: 'from-indigo-500/20 via-indigo-500/5 to-transparent',
    tagClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  },
  id: {
    label: 'ID & Document',
    icon: FileBadge2,
    color: '#8b5cf6',
    borderGlow: 'from-purple-500/20 via-purple-500/5 to-transparent',
    tagClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  password: {
    label: 'Logins',
    icon: KeyRound,
    color: '#f59e0b',
    borderGlow: 'from-amber-500/20 via-amber-500/5 to-transparent',
    tagClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  upi: {
    label: 'UPI / VPA',
    icon: Smartphone,
    color: '#ec4899',
    borderGlow: 'from-pink-500/20 via-pink-500/5 to-transparent',
    tagClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  },
  note: {
    label: 'Secure Note',
    icon: StickyNote,
    color: '#06b6d4',
    borderGlow: 'from-cyan-500/20 via-cyan-500/5 to-transparent',
    tagClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  },
}

const SENSITIVE_KEYS = new Set([
  'account_number',
  'customer_id',
  'card_number',
  'cvv',
  'pin',
  'id_number',
  'aadhaar_number',
  'passport_number',
  'license_number',
  'password',
  'secret',
  'upi_pin',
])

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function SensitiveFieldRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const playClick = useSound('click')
  const playPop = useSound('pop')
  const holdTimerRef = useRef<number | null>(null)
  const autoHideTimerRef = useRef<number | null>(null)
  const pressStartTimeRef = useRef(0)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setRevealed(true) // temporarily reveal when copied
      playPop()
      toast.success(`Copied ${label} to clipboard`)

      // Morph checkmark back after 1s
      setTimeout(() => setCopied(false), 1000)

      // Auto-hide the copied value after 5 seconds for security
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current)
      autoHideTimerRef.current = window.setTimeout(() => {
        setRevealed(false)
      }, 5000)

      // Auto-clear clipboard after 60s
      setTimeout(() => {
        try {
          navigator.clipboard.writeText('')
          toast.info('Clipboard cleared')
        } catch {
          // best-effort
        }
      }, 60000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  // Hold-to-reveal handlers
  const startReveal = () => {
    pressStartTimeRef.current = Date.now()
    if (!revealed) {
      setRevealed(true)
      playClick()
    }
  }

  const endReveal = () => {
    const elapsed = Date.now() - pressStartTimeRef.current
    if (elapsed > 250) {
      // Held down: hide on release
      setRevealed(false)
    } else {
      // Tap or quick click: keep revealed for 30s as accessibility fallback
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      holdTimerRef.current = window.setTimeout(() => {
        setRevealed(false)
      }, 30000)
    }
  }

  const toggleReveal = (e: React.MouseEvent) => {
    e.stopPropagation()
    const elapsed = Date.now() - pressStartTimeRef.current
    if (elapsed > 250) return // Already handled by endReveal
    if (revealed) {
      setRevealed(false)
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    } else {
      setRevealed(true)
      playClick()
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      holdTimerRef.current = window.setTimeout(() => {
        setRevealed(false)
      }, 30000)
    }
  }

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current)
    }
  }, [])

  return (
    <div
      onMouseDown={startReveal}
      onMouseUp={endReveal}
      onTouchStart={startReveal}
      onTouchEnd={endReveal}
      className="group/row flex cursor-pointer select-none items-center justify-between rounded-lg border border-border/40 bg-surface-2/40 px-2.5 py-1.5 transition-colors hover:border-border/70 hover:bg-surface-2/70"
    >
      <div className="min-w-0 flex-1 pr-2">
        <span className="block text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {label}
        </span>
        <span
          className={cn(
            'block truncate font-mono text-[12px] select-all transition-all',
            revealed ? 'text-foreground font-medium' : 'tracking-widest text-muted-foreground/60'
          )}
        >
          {revealed ? value : '••••••••••••'}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {/* Hold to reveal / tap to toggle button */}
        <button
          type="button"
          onMouseDown={startReveal}
          onMouseUp={endReveal}
          onTouchStart={startReveal}
          onTouchEnd={endReveal}
          onClick={toggleReveal}
          title="Press & hold to reveal"
          aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-all',
            'hover:bg-surface-3 hover:text-foreground active:scale-95',
            revealed && 'bg-primary/10 text-primary'
          )}
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>

        {/* Copy button with morphing checkmark feedback */}
        <button
          type="button"
          onClick={handleCopy}
          title={`Copy ${label}`}
          aria-label={`Copy ${label}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-surface-3 hover:text-foreground active:scale-95"
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.div
                key="check"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Copy className="h-3.5 w-3.5" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  )
}

export function VaultItemCard({ item, index = 0, onEdit, onDelete }: VaultItemCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const meta = CATEGORY_META[item.category] || CATEGORY_META.note
  const Icon = meta.icon

  // Extract up to 4 fields to display (excluding file binary payload)
  const fields = visibleVaultFields(item.category, item.data || {})

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.5) }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-4.5 shadow-sm transition-all hover:border-primary/40 hover:shadow-lg"
    >
      {/* Top subtle glow bar */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-80',
          meta.borderGlow
        )}
      />

      <div>
        {/* Header: Icon, Title, Category Badge, Menu */}
        <div className="flex items-start justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-inner"
            >
              <Icon className="h-4.5 w-4.5" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[14px] font-semibold tracking-tight text-foreground">
                {item.title}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-medium leading-none',
                    meta.tagClass
                  )}
                >
                  {meta.label}
                </span>
                <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/45">
                  <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" /> Encrypted
                </span>
              </div>
            </div>
          </div>

          {/* Action Menu */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label="Item options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    className="absolute right-0 top-8 z-50 min-w-[120px] rounded-xl border border-border bg-popover p-1 shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        onEdit(item)
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-foreground hover:bg-surface-2 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        onDelete(item.id)
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Content Fields */}
        <div className="space-y-1.5 pt-1">
          {item.category === 'note' ? (
            <div className="rounded-lg border border-border/40 bg-surface-2/30 p-2.5">
              <span className="block text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                Content
              </span>
              <p className="whitespace-pre-wrap text-[12px] text-foreground/90 font-mono leading-relaxed line-clamp-4">
                {String(item.data?.content || '')}
              </p>
            </div>
          ) : (
            fields.slice(0, 4).map(([key, val]) => {
              const strVal = String(val)
              const isSensitive = SENSITIVE_KEYS.has(key.toLowerCase())

              if (isSensitive) {
                return (
                  <SensitiveFieldRow
                    key={key}
                    label={formatLabel(key)}
                    value={strVal}
                  />
                )
              }

              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-border/25 bg-surface-2/25 px-2.5 py-1.5"
                >
                  <span className="text-[10px] font-medium text-muted-foreground/70">
                    {formatLabel(key)}
                  </span>
                  <span className="truncate max-w-[180px] font-mono text-[11.5px] font-medium text-foreground select-all">
                    {strVal}
                  </span>
                </div>
              )
            })
          )}

          {fields.length > 4 && item.category !== 'note' && (
            <span className="block text-center text-[10px] text-muted-foreground/50 pt-1">
              +{fields.length - 4} more field{fields.length - 4 === 1 ? '' : 's'}
            </span>
          )}

          {/* Encrypted Document Attachment */}
          {item.data?.file_data && (
            <div className="mt-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 p-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-foreground truncate">{item.data.file_name || 'Attached Document'}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{item.data.file_size || 'Encrypted Doc'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={item.data.file_data}
                  download={item.data.file_name || 'document'}
                  className="rounded-lg bg-surface-2 hover:bg-surface-3 px-2.5 py-1 text-[11px] font-semibold text-foreground transition"
                >
                  Download
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer: Updated timestamp */}
      <div className="mt-3.5 flex items-center justify-between border-t border-border/40 pt-2 text-[9.5px] text-muted-foreground/40">
        <span>Added {new Date(item.created_at).toLocaleDateString()}</span>
        <span>AES-GCM 256-bit</span>
      </div>
    </motion.div>
  )
}
