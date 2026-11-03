import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

export default function AuthPage() {
  const navigate = useNavigate()
  const {
    user,
    isAuthenticated,
    isLoading,
    rememberMe,
    setRememberMe,
    login,
    signup,
    loginWithOAuth,
    loginAsDemo,
    logout,
  } = useAuthStore()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    playSound('click')

    if (mode === 'signin') {
      const res = await login(email, password)
      if (res.ok) {
        playSound('bell')
        celebrateConnection()
        toast.success(res.message || 'Signed in successfully')
        setEmail('')
        setPassword('')
      } else {
        playSound('thud')
        toast.error(res.message || 'Sign in failed')
      }
    } else {
      const res = await signup(email, password, name)
      if (res.ok) {
        playSound('bell')
        celebrateConnection()
        toast.success(res.message || 'Account created and saved!')
        setEmail('')
        setPassword('')
        setName('')
      } else {
        playSound('thud')
        toast.error(res.message || 'Account creation failed')
      }
    }
  }

  const handleOAuth = async (provider: 'google' | 'github') => {
    playSound('click')
    const res = await loginWithOAuth(provider)
    if (res.ok) {
      playSound('bell')
      celebrateConnection()
      toast.success(res.message || `Connected with ${provider}`)
    } else {
      playSound('thud')
      toast.error(res.message || 'Authentication failed')
    }
  }

  const handleDemo = async () => {
    playSound('click')
    await loginAsDemo()
    playSound('chime')
    celebrateConnection()
    toast.success('Signed in as Demo Explorer!')
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
              : 'Create an account with your email and password. Account records are stored in Supabase.'}
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
                onClick={() => {
                  playSound('click')
                  setMode('signin')
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
                onClick={() => {
                  playSound('click')
                  setMode('signup')
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
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="any-email@domain.com"
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
                    Any password works
                  </span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
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
                disabled={isLoading}
                className="w-full mt-2 h-10 font-semibold gap-2"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Saving account...
                  </span>
                ) : (
                  <span>{mode === 'signin' ? 'Sign In & Save' : 'Create Account'}</span>
                )}
              </Button>
            </form>

            {/* Social OAuth Buttons */}
            <div className="mt-6 pt-6 border-t border-border/60">
              <p className="text-[10px] uppercase font-semibold text-center text-muted-foreground/60 tracking-wider mb-3">
                Or continue with
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOAuth('google')}
                  className="gap-2 border-border/80 hover:bg-surface-2"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  Google
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOAuth('github')}
                  className="gap-2 border-border/80 hover:bg-surface-2"
                >
                  <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  GitHub
                </Button>
              </div>

              {/* 1-Click Fast Demo Login */}
              <div className="mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDemo}
                  className="w-full text-xs text-muted-foreground hover:text-foreground gap-1.5 border border-dashed border-border/80"
                >
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  1-Click Instant Demo Login (demo@context.os)
                </Button>
              </div>
            </div>
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
