import { create } from 'zustand'

export interface AskSource {
  type: string
  title: string
}

export interface AskMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: AskSource[]
  error?: boolean
  /** True when the message created a record (e.g. an expense). */
  saved?: boolean
  /** Badge copy for stored records, e.g. "Saved to Habits". */
  savedLabel?: string
  createdAt: number
}

const STORAGE_KEY = 'context:ask-history'
const MAX_MESSAGES = 50

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadMessages(): AskMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is AskMessage =>
          Boolean(item) &&
          typeof (item as AskMessage).content === 'string' &&
          ((item as AskMessage).role === 'user' ||
            (item as AskMessage).role === 'assistant')
      )
      .slice(-MAX_MESSAGES)
  } catch {
    return []
  }
}

function persist(messages: AskMessage[]) {
  try {
    const clean = messages
      .filter((message) => message.content.trim().length > 0)
      .slice(-MAX_MESSAGES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
  } catch {
    // storage unavailable / quota
  }
}

interface AskState {
  messages: AskMessage[]
  addMessage: (message: Omit<AskMessage, 'id' | 'createdAt'> & { id?: string }) => string
  updateMessage: (id: string, patch: Partial<AskMessage>, persistNow?: boolean) => void
  clear: () => void
}

export const useAskStore = create<AskState>((set, get) => ({
  messages: loadMessages(),

  addMessage: (message) => {
    const id = message.id ?? makeId()
    const next: AskMessage = {
      ...message,
      id,
      createdAt: Date.now(),
    }
    const messages = [...get().messages, next].slice(-MAX_MESSAGES)
    set({ messages })
    persist(messages)
    return id
  },

  updateMessage: (id, patch, persistNow = false) => {
    const messages = get().messages.map((message) =>
      message.id === id ? { ...message, ...patch } : message
    )
    set({ messages })
    if (persistNow) persist(messages)
  },

  clear: () => {
    set({ messages: [] })
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  },
}))
