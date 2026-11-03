import { create } from 'zustand'

export type VaultState = {
  key: CryptoKey | null
  unlocked: boolean
  lastActivity: number
  setKey: (key: CryptoKey) => void
  lock: () => void
  touch: () => void
}

// Memory-only store. NO persistence middleware.
// Refreshing or closing the tab immediately wipes the CryptoKey from memory.
export const useVault = create<VaultState>((set) => ({
  key: null,
  unlocked: false,
  lastActivity: Date.now(),
  setKey: (key) => set({ key, unlocked: true, lastActivity: Date.now() }),
  lock: () => set({ key: null, unlocked: false }),
  touch: () => set({ lastActivity: Date.now() }),
}))
