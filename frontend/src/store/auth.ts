import { create } from 'zustand'
import { fetchAuthMe, postAuthLogin, postAuthRegister, postAuthLogout, type AuthUser } from '@/lib/api'
import { useVault } from './vault'

export type User = AuthUser

type Result = { ok: boolean; message?: string }
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  initialized: boolean
  isLoading: boolean
  rememberMe: boolean
  setRememberMe: (value: boolean) => void
  initialize: (refresh?: boolean) => Promise<void>
  login: (email: string, password: string) => Promise<Result>
  signup: (email: string, password: string, name: string, otp: string) => Promise<Result>
  logout: () => Promise<void>
  expire: () => void
  updateProfile: (updates: Partial<User>) => void
}

function accountChanged() {
  useVault.getState().lock()
  // Synchronous listeners clear private query caches before the next account renders.
  window.dispatchEvent(new Event('context:auth-changing'))
}
function notifyOtherTabs() {
  try { localStorage.setItem('context:auth-revision', `${Date.now()}:${Math.random()}`) } catch {}
}
let initialization: Promise<void> | null = null

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  initialized: false,
  isLoading: false,
  rememberMe: localStorage.getItem('context:auth:remember') !== 'false',
  setRememberMe: rememberMe => {
    try { localStorage.setItem('context:auth:remember', String(rememberMe)) } catch {}
    set({ rememberMe })
  },
  initialize: (refresh = false) => {
    if (refresh) {
      initialization = null
      accountChanged()
      set({ user: null, isAuthenticated: false, initialized: false })
    }
    if (initialization) return initialization
    initialization = (async () => {
      try {
        const response = await fetchAuthMe()
        set({ user: response.user, isAuthenticated: Boolean(response.user), initialized: true })
      } catch {
        set({ user: null, isAuthenticated: false, initialized: true })
      }
    })()
    return initialization
  },
  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const response = await postAuthLogin(email, password, get().rememberMe)
      accountChanged()
      notifyOtherTabs()
      set({ user: response.user, isAuthenticated: true, isLoading: false, initialized: true })
      return { ok: true, message: response.message }
    } catch (error) {
      set({ isLoading: false })
      return { ok: false, message: error instanceof Error ? error.message : 'Sign in failed' }
    }
  },
  signup: async (email, password, name, otp) => {
    set({ isLoading: true })
    try {
      const response = await postAuthRegister(email, password, name, get().rememberMe, otp)
      accountChanged()
      notifyOtherTabs()
      set({ user: response.user, isAuthenticated: true, isLoading: false, initialized: true })
      return { ok: true, message: response.message }
    } catch (error) {
      set({ isLoading: false })
      return { ok: false, message: error instanceof Error ? error.message : 'Account creation failed' }
    }
  },
  logout: async () => {
    await postAuthLogout()
    get().expire()
    notifyOtherTabs()
  },
  expire: () => {
    accountChanged()
    try { localStorage.removeItem('context:auth:supabase:user') } catch {}
    set({ user: null, isAuthenticated: false, initialized: true })
  },
  updateProfile: updates => {
    const user = get().user
    if (user) set({ user: { ...user, ...updates } })
  },
}))
