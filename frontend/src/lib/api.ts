/**
 * lib/api.ts — typed fetch helpers for all Context API endpoints.
 * Local requests use Vite's proxy; production requests use Vercel's /api rewrite.
 */

const BASE = '/api'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  if (init?.method && !['GET', 'HEAD'].includes(init.method.toUpperCase())) {
    const csrf = document.cookie.split('; ').find(part => part.startsWith('context_csrf='))?.split('=')[1]
    if (csrf) headers.set('X-CSRF-Token', decodeURIComponent(csrf))
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })
  if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('context:session-expired'))
  let json
  try { json = await res.json() } catch {
    throw new Error(`Server returned HTTP ${res.status}. Please try again shortly.`)
  }
  if (!res.ok || !json?.ok) {
    const reference = json?.reference ? ` (reference: ${json.reference})` : ''
    const detail = typeof json?.detail === 'string' ? json.detail : Array.isArray(json?.detail)
      ? json.detail.slice(0, 3).map((issue: { msg?: string }) => issue.msg).filter(Boolean).join('; ') : undefined
    throw new Error((json?.error ?? detail ?? `Server returned HTTP ${res.status}`) + reference)
  }
  return json as T
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface Config {
  ok: boolean
  currency: string
  symbol: string
  has_groq: boolean
  gmail_connected: boolean
  gmail_email: string | null
  counts: Record<string, number>
}

export const fetchConfig = () => apiFetch<Config>('/config')

// ─── Home ─────────────────────────────────────────────────────────────────────

export interface HomeData {
  ok: boolean
  q: string
  counts: Record<string, number>
  files: FileRow[]
  history: HistoryRow[]
  forgotten: ForgottenFile[]
  connections: Connection[]
  job: JobBrief
  cal: CalBrief
  gmail: GmailBrief
  activity: ActivityEntry[]
  has_groq: boolean
  people: PeopleBrief
  spend: SpendBrief
  patterns: PatternsBrief
}

export const fetchHome = (q = '') =>
  apiFetch<HomeData>(`/home${q ? `?q=${encodeURIComponent(q)}` : ''}`)

export type DashboardData = Omit<HomeData, 'job' | 'people'> & { job: null; people: null }
export const fetchDashboard = (q = '') =>
  apiFetch<DashboardData>(`/home?compact=true${q ? `&q=${encodeURIComponent(q)}` : ''}`)

export interface TodayData {
  ok: boolean
  date: string
  schedule: { id: string; title: string; start_at: string; end_at: string | null; location: string | null; kind: 'event' | 'interview' }[]
  subscriptions: { id: number; name: string; amount: number; next_renewal: string }[]
  debts: { id: number; person: string; direction: 'borrowed' | 'lent'; amount: number; due_date: string }[]
  emails: { id: number; from_name: string | null; from_addr: string | null; subject: string | null; received_at: string }[]
  contacts: { id: number; name: string; last_contact: string }[]
  journal: { mood: number; headline: string | null } | null
}

export const fetchToday = (day: string) => apiFetch<TodayData>(`/today?day=${encodeURIComponent(day)}`)

export interface Reminder {
  id: string
  kind: 'event' | 'interview' | 'subscription' | 'debt'
  title: string
  body: string
  due_at: string
  href: string
  severity: 'info' | 'warning' | 'danger'
  read: boolean
  amount?: number
}

export interface NotificationsData {
  ok: boolean
  notifications: Reminder[]
  unread_count: number
  checked_at: string
  timezone: string
}

export const fetchNotifications = (timezone: string) =>
  apiFetch<NotificationsData>(`/notifications?timezone=${encodeURIComponent(timezone)}`)

export const postNotificationAction = (id: string, action: 'read' | 'snooze' | 'dismiss', timezone: string, minutes = 15) =>
  apiFetch<{ ok: boolean }>(`/notifications/${encodeURIComponent(id)}`, {
    method: 'POST', body: JSON.stringify({ action, timezone, minutes }),
  })

export const postNotificationsReadAll = (timezone: string) =>
  apiFetch<{ ok: boolean; updated: number }>('/notifications/read-all', {
    method: 'POST', body: JSON.stringify({ timezone }),
  })

export type CaptureKind = 'expense' | 'event' | 'note' | 'debt' | 'subscription' | 'contact'
export interface CaptureDraft {
  kind: CaptureKind
  title?: string
  content?: string
  amount?: number | null
  merchant?: string
  category?: string
  date: string
  start_at?: string | null
  end_at?: string | null
  location?: string
  company?: string
  person?: string
  direction?: 'lent' | 'borrowed'
  billing_cycle?: 'monthly' | 'yearly' | 'quarterly' | 'weekly'
  due_date?: string | null
}
export const postCapturePreview = (text: string, timezone: string) =>
  apiFetch<{ ok: boolean; draft: CaptureDraft; warnings: string[] }>('/capture/preview', { method: 'POST', body: JSON.stringify({ text, timezone }) })
export const postCaptureSave = (draft: CaptureDraft, request_id: string) =>
  apiFetch<{ ok: boolean; kind: CaptureKind; id: number; href: string; message: string }>('/capture/save', { method: 'POST', body: JSON.stringify({ draft, request_id }) })

export interface GlobalSearchResult {
  id: string
  kind: string
  title: string
  snippet: string
  occurred_at: string | null
  amount: number | null
  href: string
}
export const fetchGlobalSearch = (q: string, kind = 'all', signal?: AbortSignal) =>
  apiFetch<{ ok: boolean; q: string; kind: string; results: GlobalSearchResult[]; has_more: boolean }>(`/search/global?q=${encodeURIComponent(q)}&kind=${encodeURIComponent(kind)}`, { signal })
export const fetchNote = (id: string) => apiFetch<{ ok: boolean; note: { id: number; content: string; created_at: string } }>(`/notes/${encodeURIComponent(id)}`)
export const putNote = (id: string, content: string) => apiFetch<{ ok: boolean }>(`/notes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ content }) })
export const fetchSearchRecord = (kind: string, id: string) => apiFetch<{ ok: boolean; kind: string; record: Record<string, string | number | null> }>(`/search/record/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`)

// ─── Ask ─────────────────────────────────────────────────────────────────────

export interface AskAction {
  kind: string
  amount?: number
  merchant?: string
  category?: string
  spent_at?: string
  message?: string
  summary?: string
  habit_name?: string
  status?: 'done' | 'skipped'
  streak?: number
  completion_this_week?: number
  date?: string
  milestone?: number | null
}

export interface AskResult {
  ok: boolean
  answer: string
  sources: { type: string; title: string }[]
  /** Present when the message was stored instead of only answered. */
  action?: AskAction
}

export const postAsk = (question: string) =>
  apiFetch<AskResult>('/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
  })

// ─── Habits ──────────────────────────────────────────────────────────────────

export type HabitStatus = 'done' | 'skipped'

export interface HabitDay {
  date: string
  status: HabitStatus | null
  note?: string | null
}

export interface Habit {
  id: number
  name: string
  emoji: string
  color: string
  target_per_week: number
  created_at: string
  archived: boolean
  streak: number
  longest_streak: number
  completion_this_week: number
  completion_this_month: number
  last_7_days: HabitDay[]
  today_status: HabitStatus | null
  logs?: HabitDay[]
}

export interface HabitInsight {
  habit_id: number
  habit_name: string
  kind: string
  message: string
  data_points: number
}

export interface HabitsData {
  ok: boolean
  habits: Habit[]
  insights: HabitInsight[]
}

export const fetchHabits = () => apiFetch<HabitsData>('/habits')

export const fetchHabit = (name: string) =>
  apiFetch<{ ok: boolean; habit: Habit; logs: HabitDay[] }>(
    `/habits/${encodeURIComponent(name)}`
  )

export const postHabitAdd = (input: {
  name: string
  emoji?: string
  color?: string
  target_per_week?: number
}) =>
  apiFetch<{ ok: boolean; habit: Habit }>('/habits/add', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const postHabitLog = (input: {
  name?: string
  id?: number
  date?: string
  status: HabitStatus
  note?: string
}) =>
  apiFetch<{
    ok: boolean
    habit: Habit
    streak: number
    completion_this_week: number
  }>('/habits/log', {
    method: 'POST',
    body: JSON.stringify({ date: 'today', ...input }),
  })

export const postHabitClear = (input: {
  name?: string
  id?: number
  date?: string
}) =>
  apiFetch<{ ok: boolean; habit: Habit }>('/habits/clear', {
    method: 'POST',
    body: JSON.stringify({ date: 'today', ...input }),
  })

export const postHabitUpdate = (input: {
  name?: string
  id?: number
  new_name?: string
  emoji?: string
  color?: string
  target_per_week?: number
}) =>
  apiFetch<{ ok: boolean; habit: Habit }>('/habits/update', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const postHabitArchive = (input: { name?: string; id?: number }) =>
  apiFetch<{ ok: boolean }>('/habits/archive', {
    method: 'POST',
    body: JSON.stringify(input),
  })

// ─── Shared response shape ──────────────────────────────────────────────────

export interface ApiMessage {
  ok: boolean
  message: string
  [key: string]: unknown
}

// ─── Quick ───────────────────────────────────────────────────────────────────

export const postQuick = (line: string) =>
  apiFetch<ApiMessage>('/quick', {
    method: 'POST',
    body: JSON.stringify({ line }),
  })

// ─── Calendar ────────────────────────────────────────────────────────────────

export const fetchCalendar = (range?: { start: string; end: string }) =>
  apiFetch<CalBrief & { ok: boolean }>(
    `/calendar${range ? `?start=${range.start}&end=${range.end}` : ''}`
  )

export const postCalendarClear = () =>
  apiFetch<ApiMessage>('/calendar/clear', { method: 'POST' })

export const postCalendarEvent = (payload: {
  title: string
  start_at: string
  end_at?: string
  category?: string
  location?: string
  description?: string
}) =>
  apiFetch<{ ok: boolean; event: CalEvent; message: string }>('/calendar/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const deleteCalendarEvent = (id: number) =>
  apiFetch<{ ok: boolean; message: string }>(`/calendar/events/${id}`, {
    method: 'DELETE',
  })

export async function postCalendarUpload(file: File) {
  const form = new FormData()
  form.append('file', file)
  const csrf = document.cookie.split('; ').find(part => part.startsWith('context_csrf='))?.split('=')[1]
  const res = await fetch('/api/calendar/upload', { method: 'POST', body: form, credentials: 'include',
    headers: csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {} })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error ?? 'Upload failed')
  return json as { ok: boolean; message: string; count: number }
}

// ─── Email ───────────────────────────────────────────────────────────────────

export interface EmailData {
  ok: boolean
  connected: boolean
  email?: string
  emails: Email[]
  promises: Promise_[]
  counts: {
    all: number
    needs_reply: number
    promises: number
    applications: number
  }
}

export interface Promise_ {
  id: number
  who: string
  what: string
  by_when: string | null
  created_at: string
}

export type EmailFilter = 'all' | 'needs_reply' | 'promises' | 'applications'

export const fetchEmail = (filter: EmailFilter = 'all') =>
  apiFetch<EmailData>(`/email?filter=${filter}`)

export const postGmailFetch = () =>
  apiFetch<ApiMessage>('/gmail/fetch', { method: 'POST' })

export const postGmailConnect = (email: string, app_password: string) =>
  apiFetch<ApiMessage>('/gmail/connect', {
    method: 'POST',
    body: JSON.stringify({ email, app_password }),
  })

export const postGmailDisconnect = () =>
  apiFetch<ApiMessage>('/gmail/disconnect', { method: 'POST' })

// ─── Groq ────────────────────────────────────────────────────────────────────

export const postGroqConnect = (api_key: string) =>
  apiFetch<ApiMessage>('/groq/connect', { method: 'POST', body: JSON.stringify({ api_key }) })

export const postGroqDisconnect = () =>
  apiFetch<ApiMessage>('/groq/disconnect', { method: 'POST' })

// ─── Money ───────────────────────────────────────────────────────────────────

export interface MoneySummary {
  ok: boolean
  period: string
  start: string
  end: string
  total: number
  by_category: { category: string; total: number; count: number }[]
  top_merchants: { merchant: string; total: number; count: number }[]
  budgets: BudgetStatus[]
  compare: { this_total: number; last_total: number; change_pct: number }
  transactions: SpendRow[]
  trend: { date: string; total: number; count: number }[]
}

export interface SpendRow {
  id: number
  amount: number
  merchant: string
  category: string
  spent_at: string
  created_at: string
}

export const fetchMoneySummary = (period: 'week' | 'month' = 'month') =>
  apiFetch<MoneySummary>(`/money/summary?period=${period}`)

export const postMoneyAdd = (
  amount: number,
  merchant: string,
  category: string,
  spent_at?: string
) =>
  apiFetch<{ ok: boolean; id?: number; message?: string }>('/money/add', {
    method: 'POST',
    body: JSON.stringify({ amount, merchant, category, spent_at }),
  })

export const putSpendUpdate = (
  id: number,
  data: {
    amount?: number
    merchant?: string
    category?: string
    spent_at?: string
  }
) =>
  apiFetch<{ ok: boolean; spend: SpendRow; message?: string }>(`/money/spends/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const deleteSpend = (id: number) =>
  apiFetch<{ ok: boolean; message?: string }>(`/money/spends/${id}`, {
    method: 'DELETE',
  })

export const postSetBudget = (category: string, amount: number, period: string = 'month') =>
  apiFetch<{ ok: boolean; message?: string }>('/money/budget', {
    method: 'POST',
    body: JSON.stringify({ category, amount, period }),
  })

export const deleteBudget = (category: string) =>
  apiFetch<{ ok: boolean; message?: string }>(`/money/budget/${encodeURIComponent(category)}`, {
    method: 'DELETE',
  })

// ─── People ──────────────────────────────────────────────────────────────────

export interface PeopleData {
  ok: boolean
  people: Person[]
  upcoming_birthdays: { name: string; birthday: string; in_days: number }[]
  needing_contact: { name: string; days_since: number; last: string }[]
  total: number
}

export const fetchPeople = () => apiFetch<PeopleData>('/people')

export const fetchPerson = (name: string) =>
  apiFetch<{ ok: boolean } & PersonDetail>(`/people/${encodeURIComponent(name)}`)

export const postPersonContacted = (name: string) =>
  apiFetch(`/people/${encodeURIComponent(name)}/contacted`, { method: 'POST' })

export const postPersonFact = (name: string, fact: string, category?: string) =>
  apiFetch(`/people/${encodeURIComponent(name)}/facts`, {
    method: 'POST',
    body: JSON.stringify({ fact, category }),
  })

// ─── Files ───────────────────────────────────────────────────────────────────

export interface FileResult {
  name: string
  category: string
  path: string
  downloaded: string
  size_kb: number
  snip: string
}

export interface FilesData {
  ok: boolean
  q: string
  category: string
  total: number
  categories: { category: string; count: number }[]
  files: FileResult[]
}

export const fetchFiles = (q = '', category = 'all') =>
  apiFetch<FilesData>(
    `/files?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`
  )

// ─── Data export / clear ─────────────────────────────────────────────────────

export const fetchDataExport = () =>
  apiFetch<{ ok: boolean; exported_at: string; counts: Record<string, number>; data: unknown }>(
    '/data/export'
  )

export const postDataClear = (confirm: string) =>
  apiFetch<ApiMessage>('/data/clear', {
    method: 'POST',
    body: JSON.stringify({ confirm }),
  })

// ─── Jobs ────────────────────────────────────────────────────────────────────

export const fetchJobs = () => apiFetch<{ ok: boolean } & JobBrief>('/jobs')

export const postJobAdd = (
  companyOrPayload: string | { company: string; role?: string; cv_file?: string; url?: string; jd?: string; status?: string; interview_at?: string },
  role?: string,
  cv_file?: string
) => {
  const body = typeof companyOrPayload === 'string'
    ? { company: companyOrPayload, role, cv_file }
    : companyOrPayload
  return apiFetch<ApiMessage>('/jobs/add', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export const postJobScheduleInterview = (payload: { company: string; role?: string; scheduled_at: string; notes?: string }) =>
  apiFetch<ApiMessage>('/jobs/schedule-interview', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const postJobUpdateStatus = (payload: { id?: number; company: string; status: string }) =>
  apiFetch<ApiMessage>('/jobs/update-status', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const postJobDelete = (payload: { id?: number; company: string }) =>
  apiFetch<ApiMessage>('/jobs/delete', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

// ─── Patterns ────────────────────────────────────────────────────────────────

export const postPatternsRefresh = () =>
  apiFetch('/patterns/refresh', { method: 'POST' })

export const postPatternDismiss = (id: number) =>
  apiFetch('/patterns/dismiss', { method: 'POST', body: JSON.stringify({ id }) })

// ─── Misc ────────────────────────────────────────────────────────────────────

export const postRescan = () => apiFetch<ApiMessage>('/rescan', { method: 'POST' })

export const postIgnore = (path: string) =>
  apiFetch<ApiMessage>('/ignore', { method: 'POST', body: JSON.stringify({ path }) })

export const fetchOnboarding = () => apiFetch('/onboarding/summary')

export const fetchSearch = (q: string) =>
  apiFetch<{ ok: boolean; q: string; files: FileRow[]; history: HistoryRow[] }>(
    `/search?q=${encodeURIComponent(q)}`
  )

// ─── Shared types ────────────────────────────────────────────────────────────

export interface FileRow {
  name: string
  category: string
  snip: string
  path: string
  downloaded: string
}

export interface HistoryRow {
  title: string
  url: string
  snip: string
  last_visit: string
}

export interface ForgottenFile {
  name: string
  category: string
  age_days: number
  path: string
  message: string
}

export interface Connection {
  file: string
  page: string
  url: string
  shared: string[]
  score: number
}

export interface CalEvent {
  id: number
  title: string
  start_at: string
  end_at: string
  category: string
  company: string | null
  location: string
}

export interface CalSpend {
  id: number
  amount: number
  merchant: string
  category: string
  spent_at: string
  created_at: string
}

export interface CalDebt {
  id: number
  person: string
  direction: 'lent' | 'borrowed'
  amount: number
  taken_at: string
  due_date: string | null
  settled: number
  notes?: string
}

export interface CalBrief {
  today: CalEvent[]
  upcoming: CalEvent[]
  collisions: { a: string; a_start: string; b: string; b_start: string; date?: string }[]
  free_slots: { start: string; end: string }[]
  events?: CalEvent[]
  spends?: CalSpend[]
  debts?: CalDebt[]
  applications?: JobApplication[]
  interviews?: { id?: number; company: string; scheduled_at: string; prep_docs?: any[] }[]
  range?: { start: string; end: string }
}

export interface Email {
  id: number
  from_addr: string
  from_name: string
  to_addr: string
  subject: string
  body_snippet: string
  received_at: string
  category: string
  needs_reply: number
  replied: number
  thread_key: string
  source: string
}

export interface GmailBrief {
  connected: boolean
  email: string | null
  total_emails: number
  unanswered: Email[]
  recent_promises: { who: string; what: string; by_when: string }[]
  recent_app_email: { from_addr: string; subject: string; received_at: string }[]
}

export interface ActivityEntry {
  kind: string
  target: string
  detail: string
  timestamp: string
}

export interface Person {
  id: number
  name: string
  birthday: string | null
  last_contacted: string | null
  tags: string | null
  source: string
  created_at: string
  fact_count: number
}

export interface PersonDetail {
  id: number
  name: string
  birthday: string | null
  last_contacted: string | null
  facts: { fact: string; category: string; created_at: string }[]
}

export interface PeopleBrief {
  total: number
  upcoming_birthdays: { name: string; birthday: string; in_days: number }[]
  needing_contact: { name: string; days_since: number; last: string }[]
}

export interface SpendBrief {
  week_total: number
  week_by_category: { category: string; total: number; count: number }[]
  month_total: number
  budgets: BudgetStatus[]
  compare: { this_total: number; last_total: number; change_pct: number }
  leaks: { kind: string; detail: string }[]
  /** Categories that actually exist in the database. */
  categories?: string[]
}

export interface BudgetStatus {
  category: string
  budget: number
  spent: number
  over: boolean
  percent: number
  remaining?: number
}

export interface Pattern {
  id: number
  kind: string
  title: string
  detail: string
  severity: 'warn' | 'info' | 'danger'
  detected_at: string
}

export interface PatternsBrief {
  patterns: Pattern[]
  count: number
}

export interface JobApplication {
  id?: number
  company: string
  role: string | null
  cv_file: string | null
  applied_at: string
  status: string
  notes: string | null
  url?: string | null
  jd?: string | null
}

export interface JobBrief {
  applications: JobApplication[]
  interviews: { company: string; scheduled_at: string; prep_docs: any[] }[]
  detected_companies: string[]
  cvs: { name: string; path: string }[]
  forms: { name: string; path: string }[]
  prep_by_company: Record<string, any[]>
  portal_visits: { url: string; title: string; last_visit: string }[]
}


// ─── Vault ───────────────────────────────────────────────────────────────────

export type VaultCategory = 'bank' | 'card' | 'id' | 'password' | 'upi' | 'note'

export interface VaultConfig {
  ok: boolean
  exists: boolean
  salt: string | null
  verifier_ciphertext?: string | null
  verifier_iv?: string | null
  recovery_salt?: string | null
  encrypted_vek?: string | null
  encrypted_vek_iv?: string | null
  recovery_encrypted_vek?: string | null
  recovery_encrypted_vek_iv?: string | null
}

export interface VaultItemEncrypted {
  id: number
  title: string
  category: VaultCategory
  ciphertext: string
  iv: string
  created_at: string
  updated_at: string
}

export interface VaultItemDecrypted extends Omit<VaultItemEncrypted, 'ciphertext' | 'iv'> {
  data: Record<string, any>
  decryptionError?: boolean
}

export const fetchVaultConfig = () => apiFetch<VaultConfig>('/vault/config')

export const postVaultSetup = (payload: {
  salt: string
  verifier_ciphertext?: string
  verifier_iv?: string
  recovery_salt?: string
  encrypted_vek?: string
  encrypted_vek_iv?: string
  recovery_encrypted_vek?: string
  recovery_encrypted_vek_iv?: string
}) =>
  apiFetch<{ ok: boolean }>('/vault/setup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const postVaultResetPassphrase = (payload: {
  salt: string
  encrypted_vek: string
  encrypted_vek_iv: string
  verifier_ciphertext: string
  verifier_iv: string
}) =>
  apiFetch<{ ok: boolean; message: string }>('/vault/reset-passphrase', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const putVaultVerifier = (payload: {
  verifier_ciphertext: string
  verifier_iv: string
}) =>
  apiFetch<{ ok: boolean }>('/vault/verifier', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const fetchVaultItems = () =>
  apiFetch<{ ok: boolean; items: VaultItemEncrypted[] }>('/vault/items')

export const postVaultItemAdd = (payload: {
  title: string
  category: string
  ciphertext: string
  iv: string
}) =>
  apiFetch<{
    ok: boolean
    item: { id: number; title: string; category: string; created_at: string }
  }>('/vault/items', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const putVaultItemUpdate = (
  id: number,
  payload: {
    title?: string
    category?: string
    ciphertext?: string
    iv?: string
  }
) =>
  apiFetch<{ ok: boolean; item: VaultItemEncrypted }>(`/vault/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const deleteVaultItem = (id: number) =>
  apiFetch<{ ok: boolean }>(`/vault/items/${id}`, {
    method: 'DELETE',
  })

export const postVaultWipe = (payload: { confirm: string }) =>
  apiFetch<{ ok: boolean; deleted: number }>('/vault/wipe', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

// ─── Subscriptions & Renewals Tracker ────────────────────────────────────────

export interface Subscription {
  id: number
  name: string
  amount: number
  billing_cycle: 'monthly' | 'yearly' | 'quarterly' | 'weekly'
  category: string
  next_renewal: string
  payment_method: string
  auto_renew: boolean | number
  notes: string
  created_at: string
  monthly_equivalent: number
  yearly_equivalent: number
  days_remaining: number
  urgency: 'overdue' | 'urgent' | 'soon' | 'normal'
}

export interface SubscriptionSummary {
  active_count: number
  total_monthly: number
  total_yearly: number
  due_within_7_days: number
  urgent_count: number
  by_category: { category: string; monthly: number; percent: number }[]
  upcoming: Subscription[]
}

export const fetchSubscriptions = () =>
  apiFetch<{ ok: boolean; subscriptions: Subscription[]; summary: SubscriptionSummary }>('/subscriptions')

export const postSubscriptionAdd = (payload: {
  name: string
  amount: number
  billing_cycle?: string
  category?: string
  next_renewal?: string
  payment_method?: string
  auto_renew?: boolean
  notes?: string
}) =>
  apiFetch<{ ok: boolean; subscription: Subscription }>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const putSubscriptionUpdate = (
  id: number,
  payload: {
    name?: string
    amount?: number
    billing_cycle?: string
    category?: string
    next_renewal?: string
    payment_method?: string
    auto_renew?: boolean
    notes?: string
  }
) =>
  apiFetch<{ ok: boolean; subscription: Subscription }>(`/subscriptions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const deleteSubscription = (id: number) =>
  apiFetch<{ ok: boolean }>(`/subscriptions/${id}`, {
    method: 'DELETE',
  })

export const postSubscriptionRenew = (id: number, log_spend: boolean = true) =>
  apiFetch<{ ok: boolean; subscription: Subscription }>(`/subscriptions/${id}/renew`, {
    method: 'POST',
    body: JSON.stringify({ log_spend }),
  })

// ─── Debts & IOUs Tracker ───────────────────────────────────────────────────

export interface Debt {
  id: number
  person: string
  person_name: string
  direction: 'borrowed' | 'lent'
  amount: number
  description: string
  due_date: string | null
  taken_at: string
  settled: boolean
  settled_at: string | null
  notes: string
  created_at: string
  days_remaining: number | null
  status: 'active' | 'overdue' | 'urgent' | 'soon' | 'settled'
}

export interface DebtsSummary {
  total_borrowed: number
  total_lent: number
  net_balance: number
  active_count: number
  settled_count: number
  overdue_count: number
  urgent_count: number
  by_person: {
    person: string
    person_name: string
    lent: number
    borrowed: number
    net: number
    count: number
  }[]
}

export const fetchDebts = (params?: { settled?: boolean; direction?: string }) => {
  const q = new URLSearchParams()
  if (params?.settled !== undefined) q.append('settled', String(params.settled))
  if (params?.direction) q.append('direction', params.direction)
  const qs = q.toString() ? `?${q.toString()}` : ''
  return apiFetch<{ ok: boolean; debts: Debt[]; summary: DebtsSummary }>(`/debts${qs}`)
}

export const postDebtAdd = (payload: {
  person: string
  direction: 'borrowed' | 'lent'
  amount: number
  description?: string
  due_date?: string
  notes?: string
  taken_at?: string
}) =>
  apiFetch<{ ok: boolean; debt: Debt }>('/debts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const putDebtUpdate = (
  id: number,
  payload: {
    person?: string
    direction?: 'borrowed' | 'lent'
    amount?: number
    description?: string
    due_date?: string
    taken_at?: string
    settled?: boolean
    notes?: string
  }
) =>
  apiFetch<{ ok: boolean; debt: Debt }>(`/debts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const postDebtSettle = (id: number, settled: boolean = true) =>
  apiFetch<{ ok: boolean; debt: Debt }>(`/debts/${id}/settle`, {
    method: 'POST',
    body: JSON.stringify({ settled }),
  })

export const deleteDebt = (id: number) =>
  apiFetch<{ ok: boolean }>(`/debts/${id}`, {
    method: 'DELETE',
  })

// ─── Weekly Review & Retrospective ──────────────────────────────────────────

export interface WeeklyReview {
  start_date: string
  end_date: string
  week_number: number
  year: number
  spending: {
    total: number
    prev_total: number
    change_pct: number
    top_categories: { category: string; amount: number; percent: number }[]
    transactions_count: number
  }
  habits: {
    total_habits: number
    completed_logs: number
    adherence_pct: number
    best_streak: number
    best_habit: string | null
  }
  people: {
    contacted_count: number
    recent: { name: string; last_contacted: string }[]
  }
  debts_settled: number
  total_files: number
  insights: string[]
}

export const fetchWeeklyReview = () =>
  apiFetch<{ ok: boolean; review: WeeklyReview }>('/review')

// ─── Daily Journal & 30-Day Mood Matrix ──────────────────────────────────────

export interface JournalEntry {
  id: number
  date: string
  mood: number
  mood_label: string
  mood_emoji: string
  headline: string
  content: string
  tags: string
  tags_list: string[]
  created_at: string
  updated_at: string
}

export interface MoodDay {
  date: string
  day_of_week: string
  day_number: number
  month: string
  has_entry: boolean
  mood: number | null
  mood_label: string | null
  mood_emoji: string | null
  headline: string
  tags: string[]
}

export interface MoodMatrixData {
  matrix: MoodDay[]
  days_count: number
  entries_count: number
  average_mood: number
  streak: number
  distribution: Record<number, number>
  top_tags: { tag: string; count: number }[]
}

export const fetchJournal = (days: number = 30) =>
  apiFetch<{ ok: boolean; matrix: MoodMatrixData; entries: JournalEntry[] }>(`/journal?days=${days}`)

export const fetchJournalEntry = (date: string) =>
  apiFetch<{ ok: boolean; entry: JournalEntry | null }>(`/journal/${date}`)

export const postJournalSave = (payload: {
  date?: string
  mood: number
  headline?: string
  content?: string
  tags?: string | string[]
}) =>
  apiFetch<{ ok: boolean; entry: JournalEntry }>('/journal', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const deleteJournalEntry = (date: string) =>
  apiFetch<{ ok: boolean; deleted: boolean }>(`/journal/${date}`, {
    method: 'DELETE',
  })

// ─── Savings Goals & Target Pots ─────────────────────────────────────────────

export interface SavingGoal {
  id: number
  title: string
  target_amount: number
  current_amount: number
  target_date: string | null
  category: string
  emoji: string
  notes: string
  created_at: string
  progress_pct: number
  remaining: number
  is_completed: boolean
  is_locked?: boolean
}

export interface SavingsSummary {
  goals_count: number
  completed_count: number
  total_target: number
  total_saved: number
  overall_progress_pct: number
  goals: SavingGoal[]
}

export const fetchSavings = () =>
  apiFetch<{ ok: boolean; summary: SavingsSummary; goals: SavingGoal[] }>('/savings')

export const postSavingGoalAdd = (payload: {
  title: string
  target_amount: number
  current_amount?: number
  target_date?: string
  category?: string
  emoji?: string
  notes?: string
  is_locked?: boolean
}) =>
  apiFetch<{ ok: boolean; goal: SavingGoal }>('/savings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const putSavingGoalUpdate = (
  id: number,
  payload: {
    title?: string
    target_amount?: number
    current_amount?: number
    target_date?: string
    category?: string
    emoji?: string
    notes?: string
    is_locked?: boolean
  }
) =>
  apiFetch<{ ok: boolean; goal: SavingGoal }>(`/savings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const postSavingGoalDeposit = (id: number, amount: number) =>
  apiFetch<{ ok: boolean; goal: SavingGoal }>(`/savings/${id}/deposit`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  })

export const deleteSavingGoal = (id: number) =>
  apiFetch<{ ok: boolean }>(`/savings/${id}`, {
    method: 'DELETE',
  })







// ─── Authentication & User Accounts (Supabase PostgreSQL) ──────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string
  avatar?: string | null
  provider: 'email' | 'google' | 'github' | 'demo'
  role?: string
  createdAt: string
  lastSignInAt: string
}

export const postAuthSignupCode = (email: string) =>
  apiFetch<{ ok: boolean; message?: string }>('/auth/signup-code', {
    method: 'POST', body: JSON.stringify({ email }),
  })

export const postAuthRegister = (email: string, password: string, name: string | undefined, remember: boolean, otp: string) =>
  apiFetch<{ ok: boolean; user: AuthUser; message?: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, remember, otp }),
  })

export const postAuthLogin = (email: string, password: string, remember = true) =>
  apiFetch<{ ok: boolean; user: AuthUser; message?: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember }),
  })

export const fetchAuthMe = () =>
  apiFetch<{ ok: boolean; user: AuthUser | null }>('/auth/me')

export const postAuthLogout = () =>
  apiFetch<{ ok: boolean; message?: string }>('/auth/logout', {
    method: 'POST',
  })
