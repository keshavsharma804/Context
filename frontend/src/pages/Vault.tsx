import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Search,
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Copy,
  Check,
  Download,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useVault } from '@/store/vault'
import { useVaultAutoLock } from '@/hooks/useVaultAutoLock'
import { useSound } from '@/hooks/useSound'
import {
  deriveKey,
  encrypt,
  decrypt,
  generateSalt,
  generateMasterKey,
  exportRawKey,
  importRawKey,
  generateRecoveryKey,
} from '@/lib/vaultCrypto'
import {
  fetchVaultConfig,
  postVaultSetup,
  postVaultResetPassphrase,
  fetchVaultItems,
  deleteVaultItem,
  postVaultWipe,
  type VaultCategory,
  type VaultItemDecrypted,
  type VaultConfig,
} from '@/lib/api'
import { VaultItemCard } from '@/components/vault/VaultItemCard'
import { AddItemDialog } from '@/components/vault/AddItemDialog'
import { cn } from '@/lib/utils'

const AUTH_VERIFIER_CHALLENGE = 'CONTEXT_VAULT_AUTH_VERIFIED_V1'

const CATEGORY_FILTERS: { id: VaultCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Items' },
  { id: 'bank', label: 'Bank' },
  { id: 'card', label: 'Cards' },
  { id: 'id', label: 'Govt IDs' },
  { id: 'upi', label: 'UPI' },
  { id: 'password', label: 'Logins' },
  { id: 'note', label: 'Notes' },
]

function getPasswordStrength(pass: string): {
  score: number
  label: string
  color: string
} {
  if (!pass) return { score: 0, label: 'Empty', color: 'bg-muted' }
  let score = 0
  if (pass.length >= 8) score += 1
  if (pass.length >= 12) score += 1
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1
  if (/[0-9]/.test(pass)) score += 1
  if (/[^A-Za-z0-9]/.test(pass)) score += 1

  if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-rose-500' }
  if (score <= 4) return { score: 2, label: 'Good', color: 'bg-amber-500' }
  return { score: 3, label: 'Strong', color: 'bg-emerald-500' }
}

// ============================================================================
// MODAL 1: Post-Setup Emergency Recovery Key Modal (Safe DOM Portal)
// ============================================================================
function SetupRecoveryModal({
  open,
  recoveryKey,
  onClose,
}: {
  open: boolean
  recoveryKey: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const playPop = useSound('pop')

  if (!open || typeof document === 'undefined') return null

  const handleCopy = () => {
    navigator.clipboard.writeText(recoveryKey)
    setCopied(true)
    playPop()
    toast.success('Recovery key copied to clipboard')
    setTimeout(() => setCopied(false), 2500)
  }

  const handleDownload = () => {
    const fileContent =
      `========================================================\n` +
      `CONTEXT SECURE VAULT - EMERGENCY RECOVERY KEY\n` +
      `========================================================\n\n` +
      `Recovery Key: ${recoveryKey}\n` +
      `Created on:   ${new Date().toLocaleString()}\n\n` +
      `IMPORTANT SECURITY NOTICE:\n` +
      `-------------------------\n` +
      `This 16-character key is your ONLY emergency backup to\n` +
      `decrypt your vault and reset your master passphrase.\n` +
      `Context employs zero-knowledge client-side encryption;\n` +
      `nobody can recover your data if you lose both your\n` +
      `passphrase and this recovery key.\n\n` +
      `Store this file securely (e.g., password manager, encrypted drive).\n`

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `context-vault-recovery-key-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Recovery key downloaded as text file')
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto p-4 pt-24 sm:pt-28 pb-12">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
      />
      <div className="relative my-auto w-full max-w-lg rounded-3xl border border-primary/40 bg-[#121518] p-7 shadow-2xl space-y-5 backdrop-blur-2xl z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">
              Your Emergency Recovery Key
            </h3>
            <p className="text-[12.5px] text-muted-foreground">
              16-digit master recovery code for your secure vault
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-4 text-[12.5px] text-foreground/90 leading-relaxed">
          <div className="flex gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <strong className="text-amber-400 font-semibold block mb-0.5">Save this key now!</strong>
              If you ever forget your master passphrase or trigger a security lockout, this 16-digit Emergency Recovery Key is the <strong>only way</strong> to restore access and reset your passphrase without losing your encrypted documents.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface-inset p-4.5 text-center">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/75 block mb-2">
            16-Digit Master Recovery Key
          </span>
          <div className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-primary selection:bg-primary/30 py-1">
            {recoveryKey}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 py-2.5 text-[12.5px] font-medium text-foreground transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-muted-foreground" />
                <span>Copy Key</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 py-2.5 text-[12.5px] font-medium text-foreground transition-all cursor-pointer"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
            <span>Download (.txt)</span>
          </button>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13px] font-medium text-primary-foreground shadow-sm hover:opacity-95 transition-all cursor-pointer"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>I have safely saved my recovery key</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ============================================================================
// MODAL 2: Emergency Recovery Key Unlock & Reset Passphrase Modal
// ============================================================================
function RecoveryModal({
  open,
  onClose,
  config,
  onSuccess,
  onOpenWipe,
}: {
  open: boolean
  onClose: () => void
  config: VaultConfig | undefined
  onSuccess: (recoveredKey: CryptoKey) => void
  onOpenWipe: () => void
}) {
  const [step, setStep] = useState<'enter_key' | 'reset_passphrase'>('enter_key')
  const [enteredKey, setEnteredKey] = useState('')
  const [recoveredVek, setRecoveredVek] = useState<CryptoKey | null>(null)
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const playChime = useSound('chime')
  const playThud = useSound('thud')

  // Reset internal states on open
  useEffect(() => {
    if (open) {
      setStep('enter_key')
      setEnteredKey('')
      setRecoveredVek(null)
      setNewPass('')
      setConfirmPass('')
      setError(null)
      setLoading(false)
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  const handleKeyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16)
    const parts: string[] = []
    for (let i = 0; i < raw.length; i += 4) {
      parts.push(raw.slice(i, i + 4))
    }
    setEnteredKey(parts.join('-'))
    if (error) setError(null)
  }

  const handleVerifyKey = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanKey = enteredKey.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (cleanKey.length !== 16) {
      setError('Please enter all 16 characters of your Emergency Recovery Key.')
      return
    }

    const recSalt = config?.recovery_salt
    const recEncVek = config?.recovery_encrypted_vek
    const recEncVekIv = config?.recovery_encrypted_vek_iv

    if (!recSalt || !recEncVek || !recEncVekIv) {
      setError('This vault was initialized without a 16-digit recovery key. Please use Reset Vault to start fresh.')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const kRec = await deriveKey(cleanKey, recSalt)
      const rawVekB64 = await decrypt(kRec, recEncVek, recEncVekIv)
      const masterVek = await importRawKey(rawVekB64)

      setRecoveredVek(masterVek)
      setStep('reset_passphrase')
      playChime()
      toast.success('Recovery key verified! Set your new Master Passphrase.')
    } catch {
      playThud()
      setError('Invalid Recovery Key. Please verify the 16 characters and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassphrase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recoveredVek) return
    if (!newPass || newPass.length < 8) {
      setError('New passphrase must be at least 8 characters')
      return
    }
    if (newPass !== confirmPass) {
      setError('Passphrases do not match')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const rawVekB64 = await exportRawKey(recoveredVek)
      const newSalt = generateSalt()
      const newKPass = await deriveKey(newPass, newSalt)

      const newEncVek = await encrypt(newKPass, rawVekB64)
      const newVerifier = await encrypt(newKPass, AUTH_VERIFIER_CHALLENGE)

      await postVaultResetPassphrase({
        salt: newSalt,
        encrypted_vek: newEncVek.ciphertext,
        encrypted_vek_iv: newEncVek.iv,
        verifier_ciphertext: newVerifier.ciphertext,
        verifier_iv: newVerifier.iv,
      })

      playChime()
      toast.success('Master passphrase reset! Vault unlocked.')
      onSuccess(recoveredVek)
      onClose()
    } catch (err: any) {
      playThud()
      setError(err.message || 'Failed to update passphrase')
    } finally {
      setLoading(false)
    }
  }

  const strength = getPasswordStrength(newPass)

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto p-4 pt-24 sm:pt-28 pb-12">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
      />
      <div className="relative my-auto w-full max-w-lg rounded-3xl border border-border/80 bg-[#121518] p-7 shadow-2xl space-y-5 backdrop-blur-2xl z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {step === 'enter_key' ? 'Emergency Vault Recovery' : 'Reset Master Passphrase'}
              </h3>
              <p className="text-[12px] text-muted-foreground">
                {step === 'enter_key'
                  ? 'Enter your 16-digit Emergency Recovery Key to decrypt'
                  : 'Set a new master passphrase for your vault'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground/75 border-b border-border/60 pb-3">
          <span className={cn('px-2 py-0.5 rounded-full', step === 'enter_key' ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground')}>
            1. Verify 16-Digit Key
          </span>
          <span>→</span>
          <span className={cn('px-2 py-0.5 rounded-full', step === 'reset_passphrase' ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground')}>
            2. New Passphrase
          </span>
        </div>

        {step === 'enter_key' ? (
          <form onSubmit={handleVerifyKey} className="space-y-4">
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              Enter the 16-character alphanumeric key (e.g., <code className="font-mono text-primary">XXXX-XXXX-XXXX-XXXX</code>) saved during your vault setup:
            </p>

            <div>
              <input
                type="text"
                autoFocus
                value={enteredKey}
                onChange={handleKeyInput}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="w-full text-center font-mono tracking-widest text-lg sm:text-xl rounded-xl border border-border/80 bg-surface-inset px-3.5 py-3 text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all uppercase placeholder:text-muted-foreground/30"
              />
              {error && (
                <p className="mt-2 text-[11.5px] font-medium text-rose-500">
                  {error}
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenWipe()
                }}
                className="text-[11.5px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
              >
                Don't have key? Wipe vault
              </button>

              <button
                type="submit"
                disabled={loading || enteredKey.replace(/[^A-Za-z0-9]/g, '').length !== 16}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground shadow-sm hover:opacity-95 transition-all disabled:opacity-40 cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{loading ? 'Verifying Key…' : 'Verify Recovery Key'}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassphrase} className="space-y-4">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] p-3 text-[12px] text-emerald-300/90">
              ✓ Recovery key verified! Choose a new Master Passphrase below:
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1.5">
                New Master Passphrase
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  autoFocus
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-border/80 bg-surface-inset px-3.5 py-2.5 pr-10 text-[13px] text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground/60 hover:text-foreground cursor-pointer"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {newPass && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Strength:</span>
                    <span className="font-semibold text-foreground">{strength.label}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2 flex gap-1">
                    <div className={cn('h-full flex-1 transition-all', strength.score >= 1 ? strength.color : 'bg-transparent')} />
                    <div className={cn('h-full flex-1 transition-all', strength.score >= 2 ? strength.color : 'bg-transparent')} />
                    <div className={cn('h-full flex-1 transition-all', strength.score >= 3 ? strength.color : 'bg-transparent')} />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1.5">
                Confirm New Passphrase
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Repeat new passphrase"
                className="w-full rounded-xl border border-border/80 bg-surface-inset px-3.5 py-2.5 text-[13px] text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
              />
            </div>

            {error && (
              <p className="text-[11.5px] font-medium text-rose-500">
                {error}
              </p>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-[12.5px] font-medium text-muted-foreground hover:bg-surface-2 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading || !newPass || newPass.length < 8 || newPass !== confirmPass}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground shadow-sm hover:opacity-95 transition-all disabled:opacity-40 cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{loading ? 'Updating Passphrase…' : 'Save & Unlock Vault'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}

// ============================================================================
// MODAL 3: Wipe Vault Confirmation Modal
// ============================================================================
function WipeVaultModal({
  open,
  onClose,
  onWipe,
  isPending,
}: {
  open: boolean
  onClose: () => void
  onWipe: (confirmText: string) => void
  isPending: boolean
}) {
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    if (open) setConfirmText('')
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto p-4 pt-24 sm:pt-28 pb-12">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
      />
      <div className="relative my-auto w-full max-w-md rounded-3xl border border-rose-500/30 bg-[#121518] p-6 shadow-2xl space-y-4 backdrop-blur-2xl z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-2.5 text-rose-500">
          <ShieldAlert className="h-6 w-6" />
          <h3 className="text-lg font-bold">Wipe Vault Permanently?</h3>
        </div>

        <p className="text-[12.5px] text-muted-foreground leading-relaxed">
          Resetting the vault permanently wipes all encrypted items, documents, and keys, returning the vault to fresh setup state.
        </p>

        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-[11.5px] text-foreground/80 leading-relaxed">
          Only do this if you have lost both your <strong>Master Passphrase</strong> and your <strong>16-digit Emergency Recovery Key</strong>.
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/75 mb-1.5">
            Type <span className="font-mono text-rose-500">DELETE VAULT</span> to confirm wipe:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE VAULT"
            className="w-full font-mono rounded-xl border border-border/80 bg-surface-inset px-3.5 py-2 text-[13px] text-foreground focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/20"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3.5 py-2 text-[12px] font-medium text-muted-foreground hover:bg-surface-2 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirmText !== 'DELETE VAULT' || isPending}
            onClick={() => onWipe(confirmText)}
            className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-[12px] font-medium text-white shadow-sm hover:bg-rose-600 disabled:opacity-40 transition-all cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{isPending ? 'Wiping…' : 'Wipe Vault & Reset'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ============================================================================
// MAIN VAULT COMPONENT
// ============================================================================
export default function Vault() {
  const queryClient = useQueryClient()
  const { key, unlocked, setKey, lock } = useVault()
  const { formattedTime, isExpiringSoon } = useVaultAutoLock()
  const playChime = useSound('chime')
  const playThud = useSound('thud')
  const playPop = useSound('pop')

  // UI state
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<VaultItemDecrypted | null>(null)
  const [activeCategory, setActiveCategory] = useState<VaultCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [forgotModalOpen, setForgotModalOpen] = useState(false)

  // Setup / Unlock form states
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [settingUp, setSettingUp] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)

  // Rate-limiting / Brute-force lockout state
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('context_vault_failed_attempts') || '0', 10) || 0
    } catch {
      return 0
    }
  })

  // Recovery Modals
  const [setupRecoveryModalOpen, setSetupRecoveryModalOpen] = useState(false)
  const [createdRecoveryKey, setCreatedRecoveryKey] = useState('')
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false)

  // Query vault config
  const configQuery = useQuery({
    queryKey: ['vault', 'config'],
    queryFn: fetchVaultConfig,
    staleTime: 60000,
  })

  // Query encrypted items when unlocked
  const itemsQuery = useQuery({
    queryKey: ['vault', 'items'],
    queryFn: fetchVaultItems,
    enabled: unlocked,
    staleTime: 30000,
  })

  // Decrypted items cache in memory
  const [decryptedItems, setDecryptedItems] = useState<VaultItemDecrypted[]>([])
  const [decrypting, setDecrypting] = useState(false)

  // Decrypt items in memory whenever itemsQuery updates or key changes
  useEffect(() => {
    if (!unlocked || !key || !itemsQuery.data?.items) {
      setDecryptedItems([])
      return
    }

    let isMounted = true
    setDecrypting(true)

    const runDecryption = async () => {
      const results: VaultItemDecrypted[] = []
      for (const item of itemsQuery.data.items) {
        try {
          const decryptedJson = await decrypt(key, item.ciphertext, item.iv)
          const data = JSON.parse(decryptedJson)
          results.push({
            id: item.id,
            title: item.title,
            category: item.category,
            data,
            created_at: item.created_at,
            updated_at: item.updated_at,
          })
        } catch {
          results.push({
            id: item.id,
            title: item.title,
            category: item.category,
            data: {},
            decryptionError: true,
            created_at: item.created_at,
            updated_at: item.updated_at,
          })
        }
      }
      if (isMounted) {
        setDecryptedItems(results)
        setDecrypting(false)
      }
    }

    runDecryption()

    return () => {
      isMounted = false
    }
  }, [unlocked, key, itemsQuery.data])

  // Wipe vault mutation
  const wipeMutation = useMutation({
    mutationFn: (confirmText: string) => postVaultWipe({ confirm: confirmText }),
    onSuccess: () => {
      lock()
      setForgotModalOpen(false)
      setRecoveryModalOpen(false)
      setFailedAttempts(0)
      localStorage.removeItem('context_vault_failed_attempts')
      playPop()
      toast.success('Vault wiped and reset successfully')
      queryClient.invalidateQueries({ queryKey: ['vault'] })
    },
    onError: (err: any) => {
      playThud()
      toast.error(err.message || 'Could not wipe vault')
    },
  })

  // Delete item mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteVaultItem(id),
    onSuccess: () => {
      playPop()
      toast.success('Item removed from Vault')
      queryClient.invalidateQueries({ queryKey: ['vault', 'items'] })
    },
    onError: (err: any) => {
      playThud()
      toast.error(err.message || 'Could not delete item')
    },
  })

  // Helper for tracking failed attempts
  const recordFailedAttempt = () => {
    playThud()
    const nextAttempts = failedAttempts + 1
    setFailedAttempts(nextAttempts)
    try {
      localStorage.setItem('context_vault_failed_attempts', String(nextAttempts))
    } catch {
      // ignore
    }

    if (nextAttempts >= 6) {
      setUnlockError('Vault locked due to 6 failed attempts. Please use your 16-digit Emergency Recovery Key.')
      toast.error('Vault locked after 6 failed attempts')
    } else if (nextAttempts >= 2) {
      setUnlockError(`Incorrect passphrase. Warning: ${6 - nextAttempts} attempt${6 - nextAttempts === 1 ? '' : 's'} remaining before vault locks.`)
    } else {
      setUnlockError('Incorrect master passphrase. Please try again.')
    }
  }

  // Setup handler
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passphrase) return
    if (passphrase !== confirmPassphrase) {
      toast.error('Passphrases do not match')
      return
    }
    if (passphrase.length < 8) {
      toast.error('Passphrase must be at least 8 characters')
      return
    }

    try {
      setSettingUp(true)

      // 1. Generate active 256-bit AES-GCM Vault Encryption Key (VEK)
      const masterVek = await generateMasterKey()
      const rawVekB64 = await exportRawKey(masterVek)

      // 2. Generate passphrase salt and derive K_pass
      const salt = generateSalt()
      const kPass = await deriveKey(passphrase, salt)

      // 3. Encrypt VEK with K_pass
      const encVek = await encrypt(kPass, rawVekB64)

      // 4. Encrypt verifier challenge with K_pass
      const verifier = await encrypt(kPass, AUTH_VERIFIER_CHALLENGE)

      // 5. Generate 16-digit emergency recovery key (XXXX-XXXX-XXXX-XXXX)
      const recKey = generateRecoveryKey()
      const cleanRecKey = recKey.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      const recSalt = generateSalt()
      const kRec = await deriveKey(cleanRecKey, recSalt)

      // 6. Encrypt VEK with K_rec
      const recEncVek = await encrypt(kRec, rawVekB64)

      // 7. Store on server
      await postVaultSetup({
        salt,
        verifier_ciphertext: verifier.ciphertext,
        verifier_iv: verifier.iv,
        recovery_salt: recSalt,
        encrypted_vek: encVek.ciphertext,
        encrypted_vek_iv: encVek.iv,
        recovery_encrypted_vek: recEncVek.ciphertext,
        recovery_encrypted_vek_iv: recEncVek.iv,
      })

      // 8. Set active key in memory & present 16-digit key
      setKey(masterVek)
      setCreatedRecoveryKey(recKey)
      setSetupRecoveryModalOpen(true)
      setPassphrase('')
      setConfirmPassphrase('')
      setFailedAttempts(0)
      localStorage.removeItem('context_vault_failed_attempts')

      playChime()
      toast.success('Secure Vault created successfully!')
      queryClient.invalidateQueries({ queryKey: ['vault', 'config'] })
    } catch (err: any) {
      playThud()
      toast.error(err.message || 'Failed to initialize vault')
    } finally {
      setSettingUp(false)
    }
  }

  // Unlock handler
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (failedAttempts >= 6) {
      toast.error('Vault is locked. Use your 16-digit Emergency Recovery Key.')
      setRecoveryModalOpen(true)
      return
    }
    if (!passphrase.trim()) return

    const salt = configQuery.data?.salt
    if (!salt) {
      toast.error('Vault salt not found on server')
      return
    }

    try {
      setUnlocking(true)
      setUnlockError(null)

      const derivedKPass = await deriveKey(passphrase.trim(), salt)
      let masterVek: CryptoKey | null = null

      const encVek = configQuery.data?.encrypted_vek
      const encVekIv = configQuery.data?.encrypted_vek_iv

      if (encVek && encVekIv) {
        try {
          const rawVekB64 = await decrypt(derivedKPass, encVek, encVekIv)
          masterVek = await importRawKey(rawVekB64)
        } catch {
          recordFailedAttempt()
          return
        }
      } else {
        const verifierCiphertext = configQuery.data?.verifier_ciphertext
        const verifierIv = configQuery.data?.verifier_iv

        if (verifierCiphertext && verifierIv) {
          try {
            const decryptedChallenge = await decrypt(derivedKPass, verifierCiphertext, verifierIv)
            if (decryptedChallenge !== AUTH_VERIFIER_CHALLENGE) {
              throw new Error('Verifier mismatch')
            }
            masterVek = derivedKPass
          } catch {
            recordFailedAttempt()
            return
          }
        } else {
          masterVek = derivedKPass
        }
      }

      setKey(masterVek)
      setPassphrase('')
      setFailedAttempts(0)
      localStorage.removeItem('context_vault_failed_attempts')
      playChime()
      toast.success('Vault unlocked')
    } catch {
      recordFailedAttempt()
    } finally {
      setUnlocking(false)
    }
  }

  const strength = useMemo(() => getPasswordStrength(passphrase), [passphrase])

  // Filtered decrypted items
  const filteredItems = useMemo(() => {
    return decryptedItems.filter((item) => {
      const matchesCategory =
        activeCategory === 'all' || item.category === activeCategory
      const matchesSearch =
        !searchQuery.trim() ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [decryptedItems, activeCategory, searchQuery])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: decryptedItems.length }
    for (const item of decryptedItems) {
      counts[item.category] = (counts[item.category] || 0) + 1
    }
    return counts
  }, [decryptedItems])

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] px-4 py-8 sm:px-8 max-w-7xl mx-auto">
      <AnimatePresence mode="wait">
        {!unlocked ? (
          <motion.div
            key="locked-state"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="flex min-h-[75vh] flex-col items-center justify-center"
          >
            {configQuery.isLoading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-[12px] text-muted-foreground/60 uppercase tracking-widest font-mono">
                  Checking vault status…
                </span>
              </div>
            ) : !configQuery.data?.exists ? (
              /* --- FIRST TIME SETUP --- */
              <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card p-7 sm:p-9 shadow-2xl">
                <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

                <div className="relative text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner mb-4">
                    <Lock className="h-8 w-8" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Create your secure vault
                  </h1>
                  <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
                    Aadhaar, Passports, Bank Accounts, UPI, and Passwords — protected by client-side Web Crypto AES-GCM 256-bit.
                  </p>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-3.5 text-left">
                  <div className="flex gap-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                    <p className="text-[11.5px] leading-relaxed text-foreground/80">
                      <strong className="text-amber-500 font-semibold">Zero-Knowledge Security:</strong> Your passphrase never leaves this device. A 16-digit Emergency Recovery Key will also be provided.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSetup} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1.5">
                      Master Passphrase
                    </label>
                    <div className="relative">
                      <input
                        type={showPassphrase ? 'text' : 'password'}
                        required
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder="Choose a strong master passphrase"
                        className="w-full rounded-xl border border-border/80 bg-surface-inset px-3.5 py-2.5 pr-10 text-[13px] text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassphrase(!showPassphrase)}
                        className="absolute right-2.5 top-2.5 text-muted-foreground/60 hover:text-foreground cursor-pointer"
                      >
                        {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {passphrase && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Strength:</span>
                          <span className="font-semibold text-foreground">{strength.label}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2 flex gap-1">
                          <div className={cn('h-full flex-1 transition-all', strength.score >= 1 ? strength.color : 'bg-transparent')} />
                          <div className={cn('h-full flex-1 transition-all', strength.score >= 2 ? strength.color : 'bg-transparent')} />
                          <div className={cn('h-full flex-1 transition-all', strength.score >= 3 ? strength.color : 'bg-transparent')} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1.5">
                      Confirm Passphrase
                    </label>
                    <input
                      type={showPassphrase ? 'text' : 'password'}
                      required
                      value={confirmPassphrase}
                      onChange={(e) => setConfirmPassphrase(e.target.value)}
                      placeholder="Repeat your master passphrase"
                      className="w-full rounded-xl border border-border/80 bg-surface-inset px-3.5 py-2.5 text-[13px] text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                    />
                  </div>

                  <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acknowledgedRisk}
                      onChange={(e) => setAcknowledgedRisk(e.target.checked)}
                      className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-[11px] text-muted-foreground leading-snug">
                      I understand that Context cannot recover my data without my passphrase or 16-digit Emergency Recovery Key.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={
                      settingUp ||
                      !passphrase ||
                      passphrase !== confirmPassphrase ||
                      passphrase.length < 8 ||
                      !acknowledgedRisk
                    }
                    className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13px] font-medium text-primary-foreground shadow-sm hover:opacity-95 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {settingUp ? 'Deriving Key & Creating…' : 'Seal & Create Vault'}
                  </button>
                </form>
              </div>
            ) : (
              /* --- UNLOCK EXISTING VAULT (Frameless, Borderless, Floating Aesthetic) --- */
              <div className="relative w-full max-w-sm px-4 py-8 text-center">
                <div className="relative text-center">
                  <motion.div
                    animate={unlocking ? { rotate: [0, -15, 15, -15, 0], scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.5, repeat: unlocking ? Infinity : 0 }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner mb-4"
                  >
                    {unlocking ? <Unlock className="h-8 w-8 text-primary" /> : <Lock className="h-8 w-8 text-primary" />}
                  </motion.div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Unlock your vault
                  </h1>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Enter your master passphrase to decrypt your data.
                  </p>
                </div>

                {/* Warning Banner after 2 wrong attempts */}
                {failedAttempts >= 2 && failedAttempts < 6 && (
                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-left flex items-start gap-2.5 animate-in fade-in">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-[12px] text-amber-200/90 leading-snug">
                      <strong className="text-amber-400 font-semibold block mb-0.5">Warning: Security Alert</strong>
                      {6 - failedAttempts} attempt{6 - failedAttempts === 1 ? '' : 's'} remaining. Vault locks completely after 6 failed attempts.
                    </div>
                  </div>
                )}

                {/* Lockout Banner after 6 wrong attempts */}
                {failedAttempts >= 6 && (
                  <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-left flex items-start gap-2.5 animate-in fade-in">
                    <AlertOctagon className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                    <div className="text-[12px] text-rose-200/90 leading-snug">
                      <strong className="text-rose-400 font-semibold block mb-0.5">Vault Locked</strong>
                      Passphrase entry is disabled due to 6 failed attempts. Please use your 16-digit Emergency Recovery Key to unlock and reset your passphrase.
                    </div>
                  </div>
                )}

                <form onSubmit={handleUnlock} className="mt-6 space-y-4">
                  <div>
                    <div className="relative">
                      <input
                        type={showPassphrase ? 'text' : 'password'}
                        disabled={failedAttempts >= 6 || unlocking}
                        required={failedAttempts < 6}
                        autoFocus={failedAttempts < 6}
                        value={passphrase}
                        onChange={(e) => {
                          setPassphrase(e.target.value)
                          if (unlockError) setUnlockError(null)
                        }}
                        placeholder={failedAttempts >= 6 ? 'Passphrase locked' : 'Master Passphrase'}
                        className={cn(
                          'w-full rounded-xl border border-border/80 bg-surface-inset px-3.5 py-2.5 pr-10 text-[13px] text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all',
                          failedAttempts >= 6 && 'opacity-50 cursor-not-allowed bg-surface-2'
                        )}
                      />
                      {failedAttempts < 6 && (
                        <button
                          type="button"
                          onClick={() => setShowPassphrase(!showPassphrase)}
                          className="absolute right-2.5 top-2.5 text-muted-foreground/60 hover:text-foreground cursor-pointer"
                        >
                          {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </div>

                    {unlockError && failedAttempts < 2 && (
                      <p className="mt-1.5 text-[11px] font-medium text-rose-500 text-left">
                        {unlockError}
                      </p>
                    )}
                  </div>

                  {failedAttempts >= 6 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setRecoveryModalOpen(true)
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 py-2.5 text-[13px] font-semibold text-black shadow-lg transition-all cursor-pointer"
                    >
                      <KeyRound className="h-4 w-4" />
                      <span>Unlock with 16-Digit Recovery Key</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={unlocking || !passphrase.trim()}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13px] font-medium text-primary-foreground shadow-sm hover:opacity-95 transition-all disabled:opacity-40 cursor-pointer"
                    >
                      <Unlock className="h-4 w-4" />
                      {unlocking ? 'Verifying Key…' : 'Unlock Vault'}
                    </button>
                  )}

                  <div className="flex flex-col items-center gap-2.5 text-center pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setRecoveryModalOpen(true)
                      }}
                      className="text-[12px] text-primary/80 hover:text-primary transition-colors hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Forgot passphrase? Recover with 16-digit key</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setForgotModalOpen(true)
                      }}
                      className="text-[11px] text-muted-foreground/60 hover:text-rose-400 transition-colors hover:underline cursor-pointer"
                    >
                      Lost recovery key or want to start fresh? Reset Vault
                    </button>
                  </div>
                </form>
              </div>
            )}
          </motion.div>
        ) : (
          /* STATE 2: UNLOCKED VAULT */
          <motion.div
            key="unlocked-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Top Bar Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Unlock className="h-4 w-4" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Vault
                  </h1>
                  <span className="rounded-full bg-surface-2 border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {decryptedItems.length} {decryptedItems.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground/75">
                  Client-side encrypted with AES-GCM 256-bit. Key in memory only.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11.5px] font-mono transition-all',
                    isExpiringSoon
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-500 animate-pulse'
                      : 'border-border/60 bg-surface-1/60 text-muted-foreground'
                  )}
                  title="Auto-locks on inactivity"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Locks in {formattedTime}</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null)
                    setAddModalOpen(true)
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-[12.5px] font-medium text-primary-foreground shadow-sm hover:opacity-95 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add item</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    lock()
                    playPop()
                    toast.info('Vault locked')
                  }}
                  className="flex items-center gap-1 rounded-xl border border-border/70 bg-surface-1 px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors cursor-pointer"
                  title="Lock Vault immediately"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Lock</span>
                </button>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {CATEGORY_FILTERS.map((cat) => {
                  const active = activeCategory === cat.id
                  const count = categoryCounts[cat.id] || 0
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium transition-all shrink-0 cursor-pointer',
                        active
                          ? 'bg-foreground text-background shadow-sm'
                          : 'bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground border border-border/40'
                      )}
                    >
                      <span>{cat.label}</span>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.2 text-[10px] font-semibold',
                          active
                            ? 'bg-background/20 text-background'
                            : 'bg-surface-3 text-muted-foreground/80'
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground/50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by title…"
                  className="w-full rounded-xl border border-border/70 bg-surface-inset pl-9 pr-3 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Grid or Empty State */}
            {decrypting ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-44 rounded-2xl border border-border/40 bg-surface-1/40 skeleton-shimmer"
                  />
                ))}
              </div>
            ) : decryptedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-surface-1/30 py-16 px-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                  <KeyRound className="h-7 w-7" />
                </div>
                <h3 className="text-[16px] font-semibold text-foreground">
                  Your vault is empty
                </h3>
                <p className="mt-1 max-w-sm text-[12.5px] text-muted-foreground">
                  Add your first item — bank accounts, IDs, cards, or secure notes. All items are encrypted client-side.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null)
                    setAddModalOpen(true)
                  }}
                  className="mt-5 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[12.5px] font-medium text-primary-foreground shadow-sm hover:opacity-95 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add first item</span>
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-[13px]">
                No vault items match “{searchQuery}” in {activeCategory} category.
              </div>
            ) : (
              <motion.div
                layout
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5"
              >
                {filteredItems.map((item, idx) => (
                  <VaultItemCard
                    key={item.id}
                    item={item}
                    index={idx}
                    onEdit={(itemToEdit) => {
                      setEditingItem(itemToEdit)
                      setAddModalOpen(true)
                    }}
                    onDelete={(id) => {
                      if (window.confirm(`Delete ${item.title} from your vault?`)) {
                        deleteMutation.mutate(id)
                      }
                    }}
                  />
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Edit Dialog */}
      <AddItemDialog
        open={addModalOpen}
        editingItem={editingItem}
        onClose={() => {
          setAddModalOpen(false)
          setEditingItem(null)
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['vault', 'items'] })
        }}
      />

      {/* Setup Recovery Modal */}
      <SetupRecoveryModal
        open={setupRecoveryModalOpen}
        recoveryKey={createdRecoveryKey}
        onClose={() => setSetupRecoveryModalOpen(false)}
      />

      {/* Recovery / Reset Passphrase Modal */}
      <RecoveryModal
        open={recoveryModalOpen}
        onClose={() => setRecoveryModalOpen(false)}
        config={configQuery.data}
        onSuccess={(recoveredMasterKey) => {
          setKey(recoveredMasterKey)
          setFailedAttempts(0)
          localStorage.removeItem('context_vault_failed_attempts')
          queryClient.invalidateQueries({ queryKey: ['vault', 'config'] })
        }}
        onOpenWipe={() => setForgotModalOpen(true)}
      />

      {/* Wipe Vault Confirmation Modal */}
      <WipeVaultModal
        open={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        onWipe={(txt) => wipeMutation.mutate(txt)}
        isPending={wipeMutation.isPending}
      />
    </div>
  )
}
