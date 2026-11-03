import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import {
  Building2,
  CreditCard,
  FileBadge2,
  KeyRound,
  StickyNote,
  Smartphone,
  X,
  Lock,
  Wand2,
  Eye,
  EyeOff,
  ShieldCheck,
  Wifi,
  Upload,
  FileText,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSound } from '@/hooks/useSound'
import { encrypt } from '@/lib/vaultCrypto'
import { useVault } from '@/store/vault'
import {
  postVaultItemAdd,
  putVaultItemUpdate,
  type VaultCategory,
  type VaultItemDecrypted,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { cleanVaultData, vaultDefaults } from '@/lib/vault-fields'

interface AddItemDialogProps {
  open: boolean
  editingItem?: VaultItemDecrypted | null
  onClose: () => void
  onSuccess: () => void
}

const CATEGORIES: { id: VaultCategory; label: string; icon: any; color: string }[] = [
  { id: 'bank', label: 'Bank Account', icon: Building2, color: '#10b981' },
  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard, color: '#6366f1' },
  { id: 'id', label: 'Govt ID & Docs', icon: FileBadge2, color: '#8b5cf6' },
  { id: 'upi', label: 'UPI / VPA', icon: Smartphone, color: '#ec4899' },
  { id: 'password', label: 'Logins & Passwords', icon: KeyRound, color: '#f59e0b' },
  { id: 'note', label: 'Secure Note', icon: StickyNote, color: '#06b6d4' },
]

const QUICK_BANKS = ['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'PNB', 'Baroda']
const ACCOUNT_KINDS = ['Savings', 'Current', 'Salary', 'Joint', 'Deposit']
const WHOSE_OPTIONS = ['Me', 'Spouse', 'Parents', 'Business']
const CARD_NETWORKS = ['Visa', 'Mastercard', 'RuPay', 'Amex']
const CARD_TYPES = ['Credit', 'Debit', 'Forex']
const ID_TYPES = [
  'Aadhaar Card',
  'Passport',
  'Driving License',
  'PAN Card',
  'Voter ID',
]
const UPI_PROVIDERS = ['GPay', 'PhonePe', 'Paytm', 'BHIM', 'Cred']

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*+='
  let res = ''
  const rand = crypto.getRandomValues(new Uint8Array(18))
  for (let i = 0; i < 18; i++) {
    res += chars[rand[i] % chars.length]
  }
  return res
}

function maskNumber(val: string, visibleEnd = 4): string {
  const clean = val.replace(/\s+/g, '')
  if (!clean) return '•••• •••• •••• ••••'
  if (clean.length <= visibleEnd) return clean
  const lastDigits = clean.slice(-visibleEnd)
  return `•••• •••• •••• ${lastDigits}`
}

export function AddItemDialog({
  open,
  editingItem,
  onClose,
  onSuccess,
}: AddItemDialogProps) {
  const { key, touch } = useVault()
  const playChime = useSound('chime')
  const playThud = useSound('thud')
  const playPop = useSound('pop')
  const playClick = useSound('click')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [category, setCategory] = useState<VaultCategory>('bank')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  // Populate fields if editing
  useEffect(() => {
    if (editingItem) {
      setCategory(editingItem.category)
      const cleanedData: Record<string, string> = {}
      for (const [k, v] of Object.entries(editingItem.data || {})) {
        cleanedData[k] = String(v ?? '')
      }
      setFormData(cleanVaultData(editingItem.category, cleanedData))
    } else {
      setFormData(vaultDefaults('bank'))
      setCategory('bank')
    }
  }, [editingItem, open])

  const setField = (field: string, val: string) => {
    setFormData((prev) => ({ ...prev, [field]: val }))
  }

  // Document file selection handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      toast.error('File size exceeds 8MB limit')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setFormData((prev) => ({
        ...prev,
        file_name: file.name,
        file_type: file.type,
        file_size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        file_data: dataUrl,
      }))
      playPop()
      toast.success(`Attached ${file.name} for client-side encryption`)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveFile = () => {
    setFormData((prev) => {
      const next = { ...prev }
      delete next.file_name
      delete next.file_type
      delete next.file_size
      delete next.file_data
      return next
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
    playClick()
  }

  const handleGeneratePassword = () => {
    const pw = generatePassword()
    setField('password', pw)
    setShowSecret(true)
    playPop()
    toast.success('Generated strong 18-character password')
  }

  // Derive title automatically
  const resolvedTitle = useMemo(() => {
    if (formData.custom_title?.trim()) return formData.custom_title.trim()
    if (category === 'bank') {
      const bank = formData.bank || 'Bank'
      const type = formData.account_type || 'Account'
      const name = formData.account_holder ? `(${formData.account_holder})` : ''
      return `${bank} ${type} ${name}`.trim()
    }
    if (category === 'card') {
      const bank = formData.bank || ''
      const net = formData.card_network || 'Card'
      return bank ? `${bank} ${net}` : `${net} Card`
    }
    if (category === 'id') {
      const type = formData.id_type || 'Govt Document'
      const name = formData.full_name ? `(${formData.full_name})` : ''
      return `${type} ${name}`.trim()
    }
    if (category === 'upi') {
      return formData.upi_id ? `UPI: ${formData.upi_id}` : 'UPI ID'
    }
    if (category === 'password') {
      return formData.service || formData.url || 'Web Login'
    }
    return formData.note_title || 'Secure Note'
  }, [category, formData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key) {
      toast.error('Vault is locked. Unlock to encrypt.')
      return
    }

    const finalTitle = resolvedTitle
    if (!finalTitle) {
      toast.error('Please enter details before saving')
      return
    }

    try {
      setSaving(true)
      touch()

      // Encrypt all form data (including any attached document file) client-side
      const plaintext = JSON.stringify(cleanVaultData(category, formData))
      const { ciphertext, iv } = await encrypt(key, plaintext)

      if (editingItem) {
        await putVaultItemUpdate(editingItem.id, {
          title: finalTitle,
          category,
          ciphertext,
          iv,
        })
        toast.success(`Updated ${finalTitle}`)
      } else {
        await postVaultItemAdd({
          title: finalTitle,
          category,
          ciphertext,
          iv,
        })
        toast.success(`Sealed & added ${finalTitle} to Vault`)
      }

      playChime()
      onSuccess()
      onClose()
    } catch (err: any) {
      playThud()
      toast.error(err.message || 'Could not encrypt item')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 pt-16 sm:pt-20 pb-6">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
      />

      {/* Modal Card - Ultra-compact widescreen layout, fits view without vertical scrolling */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="relative my-auto w-full max-w-5xl xl:max-w-6xl max-h-[calc(100vh-5.5rem)] flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-[#121518] shadow-2xl backdrop-blur-2xl"
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-2.5 bg-surface-1/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">
                  {editingItem ? 'Edit Vault Item' : 'Seal New Item in Vault'}
                </h2>
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono text-emerald-400 font-semibold">
                  AES-GCM 256-BIT
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Compact Category Tabs */}
        <div className="flex border-b border-border/50 bg-[#16191d]/60 px-5 py-1.5 gap-1.5 overflow-x-auto shrink-0">
          {CATEGORIES.map((cat) => {
            const active = category === cat.id
            const CatIcon = cat.icon
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  playClick()
                  setCategory(cat.id)
                  setFormData(previous => ({ ...vaultDefaults(cat.id), ...cleanVaultData(cat.id, previous) }))
                  setShowSecret(false)
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition shrink-0',
                  active
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                )}
              >
                <CatIcon className="h-3 w-3" />
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Form & Studio Content Area */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col justify-between">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* ─── LEFT COLUMN: COMPACT PREVIEW & DOC ATTACHMENT ─────────── */}
            <div className="lg:col-span-4 flex flex-col items-center gap-2.5">
              {/* CARD PREVIEW: BANK */}
              {category === 'bank' && (
                <div className="w-full max-w-[310px] rounded-xl border border-white/10 bg-gradient-to-br from-[#1c2229] via-[#15191f] to-[#0c0f12] p-4 shadow-xl text-white relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs tracking-wide text-foreground truncate max-w-[150px]">
                        {formData.account_holder || 'NAME ON ACCOUNT'}
                      </p>
                      <p className="text-[9px] font-mono text-emerald-400 font-semibold uppercase">
                        {formData.bank || 'BANK'}
                      </p>
                    </div>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[8.5px] font-mono uppercase tracking-wider text-emerald-300">
                      {formData.account_type || 'SAVINGS'}
                    </span>
                  </div>

                  {/* EMV Chip & Contactless */}
                  <div className="my-3 flex items-center justify-between">
                    <div className="h-6 w-8 rounded bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/40 shadow-inner" />
                    <Wifi className="h-3.5 w-3.5 rotate-90 text-white/50" />
                  </div>

                  {/* Masked Account Number */}
                  <div className="font-mono text-sm font-bold tracking-widest text-white/90">
                    {maskNumber(formData.account_number || '', 4)}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 text-[9.5px] font-mono text-muted-foreground">
                    <span>IFSC: <strong className="text-white">{formData.ifsc || '••••••••'}</strong></span>
                    {formData.upi_id && (
                      <span className="truncate max-w-[110px] text-emerald-400">@{formData.upi_id}</span>
                    )}
                  </div>
                </div>
              )}

              {/* CARD PREVIEW: CARD */}
              {category === 'card' && (
                <div className="w-full max-w-[310px] rounded-xl border border-white/10 bg-gradient-to-br from-[#1e1b4b] via-[#0f172a] to-[#020617] p-4 shadow-xl text-white relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                      {formData.bank || 'BANK CARD'}
                    </span>
                    <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[8.5px] font-mono uppercase text-indigo-200">
                      {formData.card_type || 'CREDIT'}
                    </span>
                  </div>

                  <div className="my-3 flex items-center justify-between">
                    <div className="h-6 w-8 rounded bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/40 shadow-inner" />
                    <span className="font-mono text-[11px] font-bold text-white tracking-wider uppercase">
                      {formData.card_network || 'VISA'}
                    </span>
                  </div>

                  <div className="font-mono text-sm font-bold tracking-widest text-white/95">
                    {maskNumber(formData.card_number || '', 4)}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 text-[9.5px]">
                    <span className="font-semibold text-white truncate max-w-[150px]">
                      {formData.cardholder || 'NAME ON CARD'}
                    </span>
                    <span className="font-mono font-semibold text-white">{formData.expiry || 'MM/YY'}</span>
                  </div>
                </div>
              )}

              {/* CARD PREVIEW: GOVT ID */}
              {category === 'id' && (
                <div className="w-full max-w-[310px] rounded-xl border border-white/10 bg-gradient-to-br from-[#241d3b] via-[#171626] to-[#0d0c17] p-4 shadow-xl text-white relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                      <span className="text-[10.5px] font-bold uppercase text-purple-200">
                        {formData.id_type || 'Aadhaar Card'}
                      </span>
                    </div>
                    <span className="text-[8.5px] font-mono text-muted-foreground">OFFICIAL</span>
                  </div>

                  <div className="my-2.5 rounded-lg border border-white/5 bg-white/5 p-2">
                    <p className="text-[8.5px] uppercase tracking-wider text-muted-foreground">ID / Number</p>
                    <p className="font-mono text-xs font-bold tracking-wider text-purple-200 mt-0.5">
                      {maskNumber(formData.id_number || '', 4)}
                    </p>
                  </div>

                  <div className="space-y-0.5 text-xs">
                    <p className="font-bold text-foreground truncate text-[11px]">
                      {formData.full_name || 'FULL NAME AS ON DOCUMENT'}
                    </p>
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono">
                      <span>DOB: {formData.dob || '••••-••-••'}</span>
                      {formData.expiry_date && <span>Exp: {formData.expiry_date}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* CARD PREVIEW: UPI */}
              {category === 'upi' && (
                <div className="w-full max-w-[310px] rounded-xl border border-white/10 bg-gradient-to-br from-[#2d122b] via-[#1c0f1c] to-[#0d060d] p-4 shadow-xl text-white relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-pink-300">UPI / VPA HANDLE</span>
                    <span className="rounded bg-pink-500/20 px-1.5 py-0.5 text-[8.5px] font-mono text-pink-300">
                      {formData.upi_provider || 'GPAY'}
                    </span>
                  </div>
                  <div className="my-3">
                    <p className="font-mono text-sm font-bold text-pink-200 truncate">
                      {formData.upi_id || 'username@bank'}
                    </p>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Beneficiary: <strong className="text-white">{formData.beneficiary || 'Me'}</strong></span>
                    {formData.linked_bank && <span>{formData.linked_bank}</span>}
                  </div>
                </div>
              )}

              {/* CARD PREVIEW: PASSWORD */}
              {category === 'password' && (
                <div className="w-full max-w-[310px] rounded-xl border border-white/10 bg-gradient-to-br from-[#271d0b] via-[#1a1409] to-[#0c0904] p-4 shadow-xl text-white relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">LOGIN KEYCHAIN</span>
                    <span className="text-[8.5px] font-mono text-amber-400/80">AES-256</span>
                  </div>
                  <div className="my-2.5">
                    <p className="text-xs font-bold text-white truncate">{formData.service || 'Service'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{formData.username || 'username / email'}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-2 font-mono text-[11px] text-amber-200 flex items-center justify-between">
                    <span>{formData.password ? '••••••••••••••••' : 'No password set'}</span>
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              )}

              {/* CARD PREVIEW: NOTE */}
              {category === 'note' && (
                <div className="w-full max-w-[310px] rounded-xl border border-white/10 bg-gradient-to-br from-[#0c242e] via-[#09171e] to-[#040b0e] p-4 shadow-xl text-white relative overflow-hidden">
                  <span className="text-xs font-bold text-cyan-400">SECURE ENCRYPTED NOTE</span>
                  <p className="mt-2 font-semibold text-xs text-foreground truncate">
                    {formData.note_title || 'Untitled Note'}
                  </p>
                  <p className="mt-1 text-[10.5px] text-muted-foreground/80 line-clamp-3 font-mono">
                    {formData.content || 'Your encrypted notes will appear here...'}
                  </p>
                </div>
              )}

              {/* ─── DOCUMENT / SCAN ATTACHMENT CARD (For Govt ID & Bank) ─── */}
              <div className="w-full max-w-[310px] rounded-xl border border-border/70 bg-surface-1/60 p-2.5 text-xs">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {formData.file_data ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div className="truncate">
                        <p className="text-[11px] font-semibold text-foreground truncate">{formData.file_name}</p>
                        <p className="text-[9px] text-emerald-400 font-mono">✓ Ready to encrypt ({formData.file_size})</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="rounded p-1 text-muted-foreground hover:bg-rose-500/20 hover:text-rose-400 transition shrink-0"
                      title="Remove document"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-surface-2/40 py-2.5 px-3 text-[11px] font-medium text-muted-foreground hover:border-primary hover:text-primary transition"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Document Scan or PDF</span>
                  </button>
                )}
                <p className="mt-1 text-[9.5px] text-muted-foreground/60 text-center">
                  Encrypted directly with AES-256 before upload. Max 8MB.
                </p>
              </div>
            </div>

            {/* ─── RIGHT COLUMN: COMPACT HORIZONTAL FORM FIELDS ───────────── */}
            <div className="lg:col-span-8 space-y-3">
              {/* 1. BANK ACCOUNT FIELDS */}
              {category === 'bank' && (
                <div className="space-y-2.5">
                  {/* Row 1: Whose account & Kind of account inline */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Whose account
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {WHOSE_OPTIONS.map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => {
                              playClick()
                              setField('whose', w)
                            }}
                            className={cn(
                              'rounded-md px-2 py-0.5 text-[11px] font-medium transition',
                              formData.whose === w
                                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                : 'bg-surface-2 text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Kind of account
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {ACCOUNT_KINDS.map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => {
                              playClick()
                              setField('account_type', k)
                            }}
                            className={cn(
                              'rounded-md px-2 py-0.5 text-[11px] font-medium transition',
                              formData.account_type === k
                                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                : 'bg-surface-2 text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Bank quick pills */}
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Bank
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {QUICK_BANKS.map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            playClick()
                            setField('bank', b)
                          }}
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[11px] font-medium transition',
                            formData.bank === b
                              ? 'bg-emerald-500 text-black font-semibold shadow-xs'
                              : 'bg-surface-2 text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Row 3: Name on account & Account number */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-medium text-foreground">Name on the account *</label>
                      <input
                        type="text"
                        required
                        value={formData.account_holder || ''}
                        onChange={(e) => setField('account_holder', e.target.value)}
                        placeholder="e.g. Keshav Sharma"
                        className="mt-0.5 w-full rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-foreground">Account number (9 to 18 digits) *</label>
                      <input
                        type="text"
                        required
                        value={formData.account_number || ''}
                        onChange={(e) => setField('account_number', e.target.value)}
                        placeholder="e.g. 501004928172"
                        className="mt-0.5 w-full font-mono rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Row 4: IFSC, UPI ID, Branch */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-medium text-foreground">IFSC Code *</label>
                      <input
                        type="text"
                        required
                        value={formData.ifsc || ''}
                        onChange={(e) => setField('ifsc', e.target.value.toUpperCase())}
                        placeholder="e.g. HDFC0001234"
                        className="mt-0.5 w-full font-mono uppercase rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-foreground">UPI ID (optional)</label>
                      <input
                        type="text"
                        value={formData.upi_id || ''}
                        onChange={(e) => setField('upi_id', e.target.value)}
                        placeholder="name@bank"
                        className="mt-0.5 w-full font-mono rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-foreground">Branch (optional)</label>
                      <input
                        type="text"
                        value={formData.branch || ''}
                        onChange={(e) => setField('branch', e.target.value)}
                        placeholder="e.g. Indiranagar, Bangalore"
                        className="mt-0.5 w-full rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Row 5: Optional Note */}
                  <div>
                    <label className="text-[10px] font-medium text-foreground">Note (optional)</label>
                    <input
                      type="text"
                      value={formData.notes || ''}
                      onChange={(e) => setField('notes', e.target.value)}
                      placeholder="e.g. Linked to home loan, joint with Papa..."
                      className="mt-0.5 w-full rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* 2. PAYMENT CARDS (Credit / Debit) */}
              {category === 'card' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Card Network
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {CARD_NETWORKS.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              playClick()
                              setField('card_network', n)
                            }}
                            className={cn(
                              'rounded-md px-2 py-0.5 text-[11px] font-medium transition',
                              formData.card_network === n
                                ? 'bg-indigo-500 text-white font-semibold'
                                : 'bg-surface-2 text-muted-foreground'
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Card Type
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {CARD_TYPES.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              playClick()
                              setField('card_type', t)
                            }}
                            className={cn(
                              'rounded-md px-2 py-0.5 text-[11px] font-medium transition',
                              formData.card_type === t
                                ? 'bg-indigo-500 text-white font-semibold'
                                : 'bg-surface-2 text-muted-foreground'
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-medium text-foreground">Cardholder Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.cardholder || ''}
                        onChange={(e) => setField('cardholder', e.target.value)}
                        placeholder="e.g. Keshav Sharma"
                        className="mt-0.5 w-full rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-foreground">Card Number (16 Digits) *</label>
                      <input
                        type="text"
                        required
                        maxLength={19}
                        value={formData.card_number || ''}
                        onChange={(e) => setField('card_number', e.target.value)}
                        placeholder="4532 8920 1928 3492"
                        className="mt-0.5 w-full font-mono rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-medium text-foreground">Expiry (MM/YY) *</label>
                      <input
                        type="text"
                        required
                        maxLength={5}
                        value={formData.expiry || ''}
                        onChange={(e) => setField('expiry', e.target.value)}
                        placeholder="08/29"
                        className="mt-0.5 w-full font-mono rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-foreground">CVV / Security Code *</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={formData.cvv || ''}
                        onChange={(e) => setField('cvv', e.target.value)}
                        placeholder="•••"
                        className="mt-0.5 w-full font-mono rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-foreground">ATM PIN (optional)</label>
                      <input
                        type="password"
                        maxLength={6}
                        value={formData.pin || ''}
                        onChange={(e) => setField('pin', e.target.value)}
                        placeholder="••••"
                        className="mt-0.5 w-full font-mono rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 3. GOVT ID (Aadhaar, Passport, Driving License, PAN) */}
              {category === 'id' && (
                <div className="space-y-2.5">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Document Type
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ID_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            playClick()
                            setField('id_type', t)
                          }}
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[11px] font-medium transition',
                            formData.id_type === t
                              ? 'bg-purple-500 text-white font-semibold shadow-xs'
                              : 'bg-surface-2 text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-medium text-foreground">
                        {formData.id_type === 'Aadhaar Card'
                          ? 'Aadhaar Number (12 Digits) *'
                          : formData.id_type === 'Passport'
                            ? 'Passport Number *'
                            : formData.id_type === 'Driving License'
                              ? 'DL Number (e.g. DL-1420110012345) *'
                              : 'Document / ID Number *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.id_number || ''}
                        onChange={(e) => setField('id_number', e.target.value)}
                        placeholder={
                          formData.id_type === 'Aadhaar Card'
                            ? '5821 9028 1234'
                            : formData.id_type === 'Passport'
                              ? 'Z9028192'
                              : 'DL-1420110012345'
                        }
                        className="mt-0.5 w-full font-mono rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-foreground">Full Name on Document *</label>
                      <input
                        type="text"
                        required
                        value={formData.full_name || ''}
                        onChange={(e) => setField('full_name', e.target.value)}
                        placeholder="e.g. Keshav Sharma"
                        className="mt-0.5 w-full rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-medium text-foreground">Date of Birth</label>
                      <input
                        type="text"
                        value={formData.dob || ''}
                        onChange={(e) => setField('dob', e.target.value)}
                        placeholder="YYYY-MM-DD"
                        className="mt-0.5 w-full font-mono rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-foreground">
                        {formData.id_type === 'Aadhaar Card' ? 'Virtual ID (VID)' : 'Expiry Date'}
                      </label>
                      <input
                        type="text"
                        value={formData.expiry_date || ''}
                        onChange={(e) => setField('expiry_date', e.target.value)}
                        placeholder={formData.id_type === 'Aadhaar Card' ? '16 digit VID' : 'YYYY-MM-DD'}
                        className="mt-0.5 w-full font-mono rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-foreground">
                        {formData.id_type === 'Driving License' ? 'Vehicle Classes' : 'Issuing Authority / State'}
                      </label>
                      <input
                        type="text"
                        value={formData.authority || formData.vehicle_class || ''}
                        onChange={(e) => setField(formData.id_type === 'Driving License' ? 'vehicle_class' : 'authority', e.target.value)}
                        placeholder={formData.id_type === 'Driving License' ? 'MCWG, LMV' : 'Govt of India'}
                        className="mt-0.5 w-full rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-foreground">Address / Security Reminders (optional)</label>
                    <input
                      type="text"
                      value={formData.address || ''}
                      onChange={(e) => setField('address', e.target.value)}
                      placeholder="Registered address or private notes..."
                      className="mt-0.5 w-full rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* 4. UPI / VPA */}
              {category === 'upi' && (
                <div className="space-y-2.5">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      UPI App / Provider
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {UPI_PROVIDERS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            playClick()
                            setField('upi_provider', p)
                          }}
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[11px] font-medium transition',
                            formData.upi_provider === p
                              ? 'bg-pink-500 text-white font-semibold shadow-xs'
                              : 'bg-surface-2 text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-medium text-foreground">UPI ID / VPA *</label>
                      <input
                        type="text"
                        required
                        value={formData.upi_id || ''}
                        onChange={(e) => setField('upi_id', e.target.value)}
                        placeholder="keshav@okhdfcbank"
                        className="mt-0.5 w-full font-mono rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-foreground">Beneficiary Name</label>
                      <input
                        type="text"
                        value={formData.beneficiary || ''}
                        onChange={(e) => setField('beneficiary', e.target.value)}
                        placeholder="Keshav Sharma"
                        className="mt-0.5 w-full rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-foreground">Linked Bank</label>
                      <input
                        type="text"
                        value={formData.linked_bank || ''}
                        onChange={(e) => setField('linked_bank', e.target.value)}
                        placeholder="HDFC Salary"
                        className="mt-0.5 w-full rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5. LOGINS & PASSWORDS */}
              {category === 'password' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-medium text-foreground">Service Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.service || ''}
                        onChange={(e) => setField('service', e.target.value)}
                        placeholder="e.g. GitHub, Google, AWS"
                        className="mt-0.5 w-full rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-medium text-foreground">Website / URL</label>
                      <input
                        type="text"
                        value={formData.url || ''}
                        onChange={(e) => setField('url', e.target.value)}
                        placeholder="https://github.com"
                        className="mt-0.5 w-full rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-medium text-foreground">Username or Email *</label>
                      <input
                        type="text"
                        required
                        value={formData.username || ''}
                        onChange={(e) => setField('username', e.target.value)}
                        placeholder="user@example.com"
                        className="mt-0.5 w-full rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-medium text-foreground">Password *</label>
                        <button
                          type="button"
                          onClick={handleGeneratePassword}
                          className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                        >
                          <Wand2 className="h-2.5 w-2.5" />
                          Generate strong
                        </button>
                      </div>

                      <div className="relative mt-0.5">
                        <input
                          type={showSecret ? 'text' : 'password'}
                          required
                          value={formData.password || ''}
                          onChange={(e) => setField('password', e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full font-mono rounded-lg border border-border/80 bg-surface-2 px-2.5 py-1.5 pr-8 text-xs text-foreground focus:border-primary focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret(!showSecret)}
                          aria-label={showSecret ? 'Hide password' : 'Show password'}
                          className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                        >
                          {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 6. SECURE NOTE */}
              {category === 'note' && (
                <div>
                  <label className="text-[10px] font-medium text-foreground">Encrypted Note Content *</label>
                  <textarea
                    rows={6}
                    required
                    value={formData.content || ''}
                    onChange={(e) => setField('content', e.target.value)}
                    placeholder="Private recovery phrases, seed words, confidential contract text..."
                    className="mt-0.5 w-full font-mono rounded-lg border border-border/80 bg-surface-2 p-2.5 text-xs text-foreground leading-relaxed focus:border-primary focus:outline-none resize-y"
                  />
                </div>
              )}

              {/* Bottom Actions Row: Cancel & Seal it Button */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="relative group flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>{saving ? 'Encrypting…' : editingItem ? 'Update Sealed Item' : 'Seal it'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  )
}
