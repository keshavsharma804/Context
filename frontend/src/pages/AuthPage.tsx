import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { toast } from 'sonner'
import {
  ShieldCheck,
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  LogOut,
  CheckCircle2,
  Sparkles,
  Database,
  KeyRound,
  Laptop,
  Check,
  Copy,
  ArrowRight,
  ArrowLeft,
  Zap,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { playSound } from '@/hooks/useSound'
import { celebrateConnection } from '@/lib/celebrate'
import { cn } from '@/lib/utils'
import { safeStartPath } from '@/lib/start-page'
import { postAuthSignupCode } from '@/lib/api'

export default function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    user,
    isAuthenticated,
    isLoading,
    rememberMe,
    setRememberMe,
    login,
    signup,
    logout,
  } = useAuthStore()

  const [mode, setMode] = useState<'signin' | 'signup'>(() => searchParams.get('mode') === 'signup' ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setTimeout(() => setResendIn(value => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [resendIn])

  const requestCode = async () => {
    if (sendingCode || resendIn > 0) return
    setSendingCode(true)
    try {
      await postAuthSignupCode(email.trim())
      setCodeSent(true)
      setOtp('')
      setResendIn(60)
      toast.success('Verification code sent. Check your inbox and spam folder.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send verification code')
    } finally { setSendingCode(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading || sendingCode) return
    playSound('click')
    if (mode === 'signup' && !codeSent) { await requestCode(); return }

    if (mode === 'signin') {
      const res = await login(email, password)
      if (res.ok) {
        playSound('bell')
        celebrateConnection()
        toast.success(res.message || 'Signed in successfully')
        setEmail('')
        setPassword('')
        navigate(safeStartPath(searchParams.get('next')), { replace: true })
      } else {
        playSound('thud')
        toast.error(res.message || 'Sign in failed')
      }
    } else {
      const res = await signup(email, password, name, otp)
      if (res.ok) {
        playSound('bell')
        celebrateConnection()
        toast.success(res.message || 'Account created and saved!')
        setEmail('')
        setPassword('')
        navigate(safeStartPath(searchParams.get('next')), { replace: true })
        setName('')
        setOtp('')
        setCodeSent(false)
      } else {
        playSound('thud')
        toast.error(res.message || 'Account creation failed')
      }
    }
  }

  const handleLogout = async () => {
    playSound('pop')
    await logout()
    toast.success('Signed out of this device')
  }

  const handleCopyId = () => {
    if (!user?.id) return
    navigator.clipboard.writeText(user.id)
    setCopiedId(true)
    playSound('click')
    toast.success('User ID copied to clipboard')
    setTimeout(() => setCopiedId(false), 2000)
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      {/* Background radial atmosphere glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full opacity-25 blur-3xl"
          style={{ background: 'var(--theme-glow, rgba(16, 185, 129, 0.4))' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-lg space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Zap className="h-3.5 w-3.5" />
            <span>Context OS · Authentication</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {isAuthenticated ? 'Your Account' : mode === 'signin' ? 'Sign In to Context' : 'Create Context Account'}
          </h1>

          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {isAuthenticated
              ? 'Your account is saved in Supabase.'
              : mode === 'signup' ? 'Create an account with your email and verify the code sent to your inbox.' : 'Use your email and password to open your workspace.'}
          </p>
        </div>

        {isAuthenticated && user ? (
          /* ─── Active User Account View ──────────────────────────────────── */
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl border border-border/80 bg-card/80 p-6 backdrop-blur-2xl shadow-xl space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary/60 text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/25">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-emerald-500 text-white">
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground truncate">{user.name}</h2>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary shrink-0">
                    {user.role || 'Owner'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground/75 bg-surface-2 px-2 py-0.5 rounded-md border border-border/50 truncate">
                    ID: {user.id}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    title="Copy User ID"
                  >
                    {copiedId ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Storage info pill */}
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <Database className="h-4 w-4" />
                <span>Saved in Supabase</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                Account details and password hashes are stored in Supabase. Your session stays in this browser.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button
                type="button"
                className="w-full sm:flex-1 gap-2 font-semibold"
                onClick={() => navigate('/')}
              >
                <span>Continue to Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleLogout}
                className="w-full sm:w-auto gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </Button>
            </div>
          </motion.div>
        ) : (
          /* ─── Sign In / Sign Up Form Card ───────────────────────────────── */
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl border border-border/80 bg-card/80 p-6 sm:p-8 backdrop-blur-2xl shadow-xl"
          >
            {/* Mode Switcher Pill */}
            <div className="flex rounded-2xl border border-border/60 bg-surface-2 p-1 mb-6">
              <button
                type="button"
                disabled={isLoading || sendingCode}
                onClick={() => {
                  playSound('click')
                  setMode('signin')
                  setCodeSent(false)
                  setOtp('')
                }}
                className={cn(
                  'flex-1 rounded-xl py-2 text-xs font-semibold transition-all duration-200 cursor-pointer',
                  mode === 'signin'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Sign In
              </button>
              <button
                type="button"
                disabled={isLoading || sendingCode}
                onClick={() => {
                  playSound('click')
                  setMode('signup')
                  setCodeSent(false)
                  setOtp('')
                }}
                className={cn(
                  'flex-1 rounded-xl py-2 text-xs font-semibold transition-all duration-200 cursor-pointer',
                  mode === 'signup'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">
                    Your Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      type="text"
                      value={name}
                      readOnly={codeSent || sendingCode || isLoading}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Keshav Sharma"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    autoComplete="email"
                    type="email"
                    value={email}
                    readOnly={codeSent || sendingCode || isLoading}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Password
                  </label>
                  <span className="text-[11px] text-muted-foreground/60">
                    Use your account password
                  </span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    minLength={mode === 'signup' ? 8 : 1}
                    maxLength={1024}
                    value={password}
                    readOnly={codeSent || sendingCode || isLoading}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && codeSent && <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                <label htmlFor="signup-otp" className="block text-sm font-medium">Verify your email</label>
                <p className="text-xs text-muted-foreground">Enter the code sent to {email}. Check your spam folder if you don’t see it.</p>
                <Input id="signup-otp" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,10}" minLength={6} maxLength={10}
                  value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="Verification code" required autoFocus />
                <div className="flex flex-wrap gap-4 text-xs">
                  <button type="button" onClick={() => void requestCode()} disabled={sendingCode || resendIn > 0 || isLoading} className="text-primary disabled:text-muted-foreground">
                    {sendingCode ? 'Sending…' : resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </button>
                  <button type="button" disabled={isLoading || sendingCode} onClick={() => { setCodeSent(false); setOtp('') }} className="text-muted-foreground">Change details</button>
                </div>
              </div>}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/20 accent-primary"
                />
                <label htmlFor="remember" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Keep me signed in on this local machine
                </label>
              </div>

              <Button
                type="submit"
                disabled={isLoading || sendingCode || (mode === 'signup' && !codeSent && resendIn > 0)}
                className="w-full mt-2 h-10 font-semibold gap-2"
              >
                {isLoading || sendingCode ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    {sendingCode ? 'Sending code…' : mode === 'signup' ? 'Verifying…' : 'Signing in…'}
                  </span>
                ) : (
                  <span>{mode === 'signin' ? 'Sign In' : codeSent ? 'Verify & Create Account' : resendIn > 0 ? `Send code in ${resendIn}s` : 'Send Verification Code'}</span>
                )}
              </Button>
            </form>

          </motion.div>
        )}

        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
