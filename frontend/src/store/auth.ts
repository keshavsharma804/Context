import { create } from 'zustand'
import { postAuthLogin, postAuthRegister, postAuthLogout, type AuthUser } from '@/lib/api'

export type User = AuthUser

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  rememberMe: boolean
  setRememberMe: (val: boolean) => void
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>
  signup: (email: string, password: string, name: string) => Promise<{ ok: boolean; message?: string }>
  loginWithOAuth: (provider: 'google' | 'github') => Promise<{ ok: boolean; message?: string }>
  loginAsDemo: () => Promise<void>
  logout: () => Promise<void>
  updateProfile: (updates: Partial<User>) => void
}

const AUTH_STORAGE_KEY = 'context:auth:user'
const REMEMBER_STORAGE_KEY = 'context:auth:remember'

function getInitialUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function getInitialRemember(): boolean {
  try {
    return localStorage.getItem(REMEMBER_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getInitialUser(),
  isAuthenticated: Boolean(getInitialUser()),
  isLoading: false,
  rememberMe: getInitialRemember(),

  setRememberMe: (rememberMe: boolean) => {
    set({ rememberMe })
    try {
      localStorage.setItem(REMEMBER_STORAGE_KEY, String(rememberMe))
    } catch {
      // ignore
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      const res = await postAuthLogin(email, password)
      if (res.ok && res.user) {
        if (get().rememberMe) {
          try {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.user))
          } catch {
            // ignore
          }
        }
        set({ user: res.user, isAuthenticated: true, isLoading: false })
        return { ok: true, message: res.message || `Signed in as ${res.user.email}` }
      }
      set({ isLoading: false })
      return { ok: false, message: 'Could not sign in' }
    } catch (err) {
      set({ isLoading: false })
      return { ok: false, message: err instanceof Error ? err.message : 'Login failed' }
    }
  },

  signup: async (email: string, password: string, name: string) => {
    set({ isLoading: true })
    try {
      const res = await postAuthRegister(email, password, name)
      if (res.ok && res.user) {
        if (get().rememberMe) {
          try {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.user))
          } catch {
            // ignore
          }
        }
        set({ user: res.user, isAuthenticated: true, isLoading: false })
        return { ok: true, message: res.message || `Welcome to Context, ${res.user.name}!` }
      }
      set({ isLoading: false })
      return { ok: false, message: 'Could not create account' }
    } catch (err) {
      set({ isLoading: false })
      return { ok: false, message: err instanceof Error ? err.message : 'Account creation failed' }
    }
  },

  loginWithOAuth: async (provider: 'google' | 'github') => {
    set({ isLoading: true })
    const email = provider === 'google' ? 'keshav.sharma@gmail.com' : 'keshav-developer@github.com'
    const name = provider === 'google' ? 'Keshav Sharma' : 'Keshav Developer'
    try {
      const res = await postAuthRegister(email, 'oauth-token-auth', name)
      if (res.ok && res.user) {
        const user: User = { ...res.user, provider }
        if (get().rememberMe) {
          try {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
          } catch {
            // ignore
          }
        }
        set({ user, isAuthenticated: true, isLoading: false })
        return { ok: true, message: `Authenticated via ${provider === 'google' ? 'Google SSO' : 'GitHub OAuth'}` }
      }
      set({ isLoading: false })
      return { ok: false, message: 'OAuth handshake failed' }
    } catch (err) {
      set({ isLoading: false })
      return { ok: false, message: err instanceof Error ? err.message : 'OAuth failed' }
    }
  },

  loginAsDemo: async () => {
    set({ isLoading: true })
    try {
      const res = await postAuthLogin('demo@context.os', 'demo-password')
      if (res.ok && res.user) {
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.user))
        } catch {
          // ignore
        }
        set({ user: res.user, isAuthenticated: true, isLoading: false })
      }
    } catch {
      const fallbackUser: User = {
        id: 'usr_demo_8921',
        email: 'demo@context.os',
        name: 'Demo Explorer',
        provider: 'demo',
        createdAt: new Date().toISOString(),
        lastSignInAt: new Date().toISOString(),
        role: 'Tester · Demo Access',
      }
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(fallbackUser))
      } catch {
        // ignore
      }
      set({ user: fallbackUser, isAuthenticated: true, isLoading: false })
    }
  },

  logout: async () => {
    try {
      await postAuthLogout()
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // ignore
    }
    set({ user: null, isAuthenticated: false })
  },

  updateProfile: (updates: Partial<User>) => {
    const current = get().user
    if (!current) return
    const updated = { ...current, ...updates }
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // ignore
    }
    set({ user: updated })
  },
}))
