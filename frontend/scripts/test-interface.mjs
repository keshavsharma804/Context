import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const storage = new Map()
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
}
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: Shell } = await server.ssrLoadModule('/src/components/Shell.tsx')
  const { default: Settings } = await server.ssrLoadModule('/src/pages/Settings.tsx')
  const { default: Vault } = await server.ssrLoadModule('/src/pages/Vault.tsx')
  const { default: AuthPage } = await server.ssrLoadModule('/src/pages/AuthPage.tsx')
  const { default: Dashboard } = await server.ssrLoadModule('/src/pages/Dashboard.tsx')
  const { MoneyCard } = await server.ssrLoadModule('/src/components/dashboard/MoneyCard.tsx')
  const { DEFAULT_THEME_ID, getCurrentTheme, resolveTheme } = await server.ssrLoadModule('/src/lib/themes.ts')
  const { TourManager } = await server.ssrLoadModule('/src/components/tour/TourManager.tsx')
  const { useUIStore } = await server.ssrLoadModule('/src/store/ui.ts')
  const { useAuthStore } = await server.ssrLoadModule('/src/store/auth.ts')
  const { safeStartPath, lastSectionKey } = await server.ssrLoadModule('/src/lib/start-page.ts')
  useAuthStore.setState({ user: { id: 'fixture', name: 'Fixture', email: 'fixture@example.invalid' }, isAuthenticated: true })
  const render = (hasGroq = false) => {
    // Zustand exposes its original hydration snapshot separately from current state.
    Object.assign(useUIStore.getInitialState(), useUIStore.getState())
    Object.assign(useAuthStore.getInitialState(), useAuthStore.getState())
    const client = new QueryClient()
    client.setQueryData(['config'], { ok: true, has_groq: hasGroq, gmail_connected: false })
    return renderToStaticMarkup(React.createElement(QueryClientProvider,
    { client }, React.createElement(MemoryRouter, { initialEntries: ['/settings'] },
      React.createElement(Shell, null, React.createElement('div', null, 'Fixture page')))))
  }
  useUIStore.setState({ navStyle: 'topbar', hiddenSections: [] })
  const topbar = render()
  assert.ok(topbar.includes('aria-label="Main navigation"'))
  assert.ok(topbar.includes('href="/money"'))
  assert.ok(!topbar.includes('<aside'))
  assert.ok(topbar.includes('nav-spotlight-beam'))
  assert.ok(topbar.includes('Daily streak:'))
  assert.ok(topbar.includes('Connect AI'))
  assert.ok(!topbar.includes('>Offline<'))
  assert.ok(render(true).includes('AI ready'))
  useUIStore.setState({ hiddenSections: ['/money'] })
  assert.ok(!render().includes('href="/money"'))
  useUIStore.setState({ navStyle: 'sidebar', hiddenSections: [] })
  const sidebar = render()
  assert.ok(sidebar.includes('<aside'))
  assert.ok(!sidebar.includes('aria-label="Main navigation"'))
  const settingsClient = new QueryClient()
  settingsClient.setQueryData(['config'], { ok: true, currency: 'INR', symbol: 'INR', has_groq: false,
    gmail_connected: false, gmail_email: null, counts: {} })
  const settings = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: settingsClient },
    React.createElement(MemoryRouter, { initialEntries: ['/settings'] }, React.createElement(Settings))))
  assert.ok(!settings.includes('Account &amp; Auth'))
  assert.ok(settings.includes('Interface size'))
  assert.ok(settings.includes('Opens on'))
  assert.ok(settings.includes('Where I left off'))
  const vaultClient = new QueryClient()
  vaultClient.setQueryData(['vault', 'config'], { ok: true, exists: false })
  const vault = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: vaultClient },
    React.createElement(MemoryRouter, null, React.createElement(Vault))))
  assert.ok(vault.includes('Create your secure vault'))
  assert.ok(vault.includes('Seal &amp; Create Vault'))
  assert.ok(!vault.includes('min-h-[75vh]'))
  assert.ok(vault.includes('autoComplete="new-password"'))
  useAuthStore.setState({ user: null, isAuthenticated: false })
  Object.assign(useAuthStore.getInitialState(), useAuthStore.getState())
  const signIn = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/auth'] }, React.createElement(AuthPage)))
  assert.ok(signIn.includes('Sign In'))
  assert.ok(signIn.includes('Create Account'))
  assert.ok(signIn.includes('autoComplete="current-password"'))
  assert.ok(!signIn.includes('Google'))
  assert.ok(!signIn.includes('GitHub'))
  const signUp = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/auth?mode=signup'] }, React.createElement(AuthPage)))
  assert.ok(signUp.includes('autoComplete="new-password"'))
  assert.ok(signUp.includes('Send Verification Code'))
  const previewClient = new QueryClient({ defaultOptions: { queries: { enabled: false } } })
  const preview = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: previewClient },
    React.createElement(MemoryRouter, null, React.createElement(Dashboard, { preview: true }))))
  assert.ok(preview.includes('Today preview'))
  assert.ok(!preview.includes('Couldn&#x27;t reach your context'))
  assert.ok(preview.includes('Your schedule'))
  assert.ok(preview.includes('Due &amp; coming up'))
  assert.ok(preview.includes('Log expense'))
  assert.ok(preview.includes('ORBITAL SYNC'))
  assert.ok(preview.indexOf('ORBITAL SYNC') < preview.indexOf('id="today-heading"'))
  assert.ok(!preview.includes('Financial Health &amp; Pulse'))
  assert.ok(!preview.includes('This month'))
  const { default: TodayView } = await server.ssrLoadModule('/src/components/dashboard/TodayView.tsx')
  const todayView = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: previewClient },
    React.createElement(MemoryRouter, null, React.createElement(TodayView, { date: '2026-11-04', data: {
      ok: true, date: '2026-11-04',
      schedule: [{ id: 'event:1', title: 'Design review', start_at: '2026-11-04T10:00', end_at: '2026-11-04T11:00', kind: 'event', location: 'Online' }],
      subscriptions: [{ id: 1, name: 'Workspace', amount: 499, next_renewal: '2026-11-04' }],
      debts: [{ id: 2, person: 'Riya', direction: 'borrowed', amount: 100, due_date: '2026-11-01' }],
      emails: [{ id: 3, from_name: 'Sam', subject: 'Review proposal', received_at: '2026-11-04T08:00' }],
      contacts: [{ id: 4, name: 'Alex & Co', last_contact: '2026-10-01' }],
      journal: { mood: 4, headline: 'A good day' },
    } }))))
  for (const text of ['Design review', 'Due today', 'Overdue', 'You owe', 'Review proposal', 'You checked in today', 'A good day']) {
    assert.ok(todayView.includes(text), `Today content missing: ${text}`)
  }
  assert.ok(todayView.includes('/people/Alex%20%26%20Co'))
  assert.ok(todayView.includes('Mark Alex &amp; Co as contacted'))
  const { default: ReminderItem } = await server.ssrLoadModule('/src/components/notifications/ReminderItem.tsx')
  const reminderMarkup = renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(ReminderItem, {
      item: { id: 'a'.repeat(64), kind: 'interview', title: 'Acme interview', body: 'Starts in 30 min', due_at: '2026-11-04T09:30:00Z', href: '/jobs', severity: 'warning', read: false },
      pending: false, onAction: () => {},
    })))
  for (const text of ['Acme interview', 'Snooze', 'Dismiss Acme interview', 'Mark Acme interview as read', 'href="/jobs"']) {
    assert.ok(reminderMarkup.includes(text), `Reminder action missing: ${text}`)
  }
  assert.ok(preview.includes('Smart reminders'))
  const { default: GlobalSearch } = await server.ssrLoadModule('/src/pages/GlobalSearch.tsx')
  const searchClient = new QueryClient()
  searchClient.setQueryData(['global-search', 'lunch', 'all'], { ok: true, q: 'lunch', kind: 'all', has_more: false, results: [
    { id: '12', kind: 'expense', title: '<script>unsafe</script>', snippet: 'Lunch at cafe', amount: 250, occurred_at: '2026-11-04', href: '/records/expense/12' },
  ] })
  const globalResults = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: searchClient },
    React.createElement(MemoryRouter, { initialEntries: ['/search?q=lunch'] }, React.createElement(GlobalSearch))))
  assert.ok(globalResults.includes('Result type'))
  assert.ok(globalResults.includes('Lunch at cafe'))
  assert.ok(globalResults.includes('/records/expense/12'))
  assert.ok(globalResults.includes('&lt;script&gt;unsafe&lt;/script&gt;'))
  assert.ok(!globalResults.includes('<script>'))
  const { parseLocalDay } = await server.ssrLoadModule('/src/lib/format.ts')
  assert.ok(parseLocalDay('2024-02-29'))
  assert.equal(parseLocalDay('2026-02-31'), null)
  const money = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: previewClient },
    React.createElement(MemoryRouter, null, React.createElement(MoneyCard, { spend: {
      week_total: 250, month_total: 1000, week_by_category: [{ category: 'food', total: 250 }],
      budgets: [], compare: { this_total: 250, last_total: 100, change_pct: 150 }, leaks: [],
    } }))))
  assert.ok(money.includes('This month'))
  assert.ok(money.includes('food'))
  assert.ok(money.includes('150'))
  assert.ok(!money.includes('No expenses this week'))
  assert.equal(DEFAULT_THEME_ID, 'obsidian')
  localStorage.removeItem('context:theme')
  assert.equal(getCurrentTheme(), 'obsidian')
  assert.equal(resolveTheme('unknown-theme').id, 'obsidian')
  localStorage.removeItem('context:obsidian-default')
  localStorage.setItem('context:theme', 'violet')
  assert.equal(getCurrentTheme(), 'obsidian')
  localStorage.setItem('context:theme', 'violet')
  assert.equal(getCurrentTheme(), 'violet')
  localStorage.setItem('context:theme', 'emerald')
  assert.equal(getCurrentTheme(), 'emerald')
  for (const query of previewClient.getQueryCache().getAll()) {
    assert.equal(query.options.enabled, false, `Guest query must be disabled: ${query.queryHash}`)
    assert.equal(query.state.fetchStatus, 'idle')
  }
  const renderStartup = ready => renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(TourManager, { ready }, React.createElement('main', null, 'Dashboard fixture'))))
  localStorage.removeItem('context:tour_completed')
  for (const ready of [false, true]) {
    const startup = renderStartup(ready)
    assert.ok(startup.includes('Initializing Context'))
    assert.ok(startup.includes('style="opacity:1"'))
    assert.ok(!startup.includes('Dashboard fixture'))
    assert.ok(!startup.includes('Checking your session'))
  }
  localStorage.setItem('context:tour_completed', 'true')
  assert.ok(!renderStartup(false).includes('Dashboard fixture'))
  assert.ok(renderStartup(true).includes('Dashboard fixture'))
  assert.ok(!renderStartup(true).includes('Initializing Context'))
  localStorage.removeItem('context:tour_completed')
  globalThis.document = { documentElement: { dataset: {}, style: {} }, cookie: '' }
  const { postAuthSignupCode, fetchDashboard, fetchHome, fetchToday, fetchNotifications, postNotificationAction, postNotificationsReadAll, postCapturePreview, postCaptureSave, fetchGlobalSearch } = await server.ssrLoadModule('/src/lib/api.ts')
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response('Internal Server Error', { status: 500 })
    await assert.rejects(postAuthSignupCode('fixture@example.invalid'), /HTTP 500/)
    globalThis.fetch = async () => Response.json({ ok: false, error: 'Account storage is temporarily unavailable.', reference: 'fixture-reference' }, { status: 503 })
    await assert.rejects(postAuthSignupCode('fixture@example.invalid'), /fixture-reference/)
    const requests = []
    globalThis.fetch = async (url, options) => {
      requests.push({ url: new URL(url, 'http://fixture.invalid'), options })
      return Response.json({ ok: true })
    }
    await fetchDashboard('rent & bills?')
    await fetchHome('rent & bills?')
    assert.equal(requests[0].url.searchParams.get('compact'), 'true')
    assert.equal(requests[1].url.searchParams.has('compact'), false)
    for (const request of requests) {
      assert.equal(request.url.searchParams.get('q'), 'rent & bills?')
      assert.equal(request.options.credentials, 'include')
    }
    await fetchToday('2026-11-04')
    assert.equal(requests[2].url.pathname, '/api/today')
    assert.equal(requests[2].url.searchParams.get('day'), '2026-11-04')
    assert.equal(requests[2].options.credentials, 'include')
    await fetchNotifications('Asia/Kolkata')
    assert.equal(requests[3].url.searchParams.get('timezone'), 'Asia/Kolkata')
    document.cookie = 'context_csrf=fixture-csrf'
    await postNotificationAction('a'.repeat(64), 'snooze', 'Asia/Kolkata', 60)
    assert.equal(requests[4].options.headers.get('X-CSRF-Token'), 'fixture-csrf')
    assert.deepEqual(JSON.parse(requests[4].options.body), { action: 'snooze', timezone: 'Asia/Kolkata', minutes: 60 })
    await postNotificationsReadAll('Asia/Kolkata')
    assert.equal(requests[5].url.pathname, '/api/notifications/read-all')
    assert.equal(requests[5].options.method, 'POST')
    await postCapturePreview('spent 250 on lunch', 'Asia/Kolkata')
    assert.equal(requests[6].url.pathname, '/api/capture/preview')
    const draft = { kind: 'expense', amount: 250, date: '2026-11-04' }
    const requestId = '00000000-0000-4000-8000-000000000001'
    await postCaptureSave(draft, requestId)
    assert.equal(JSON.parse(requests[7].options.body).request_id, requestId)
    assert.equal(requests[7].options.headers.get('X-CSRF-Token'), 'fixture-csrf')
    const controller = new AbortController()
    await fetchGlobalSearch('lunch & coffee', 'expense', controller.signal)
    assert.equal(requests[8].url.searchParams.get('q'), 'lunch & coffee')
    assert.equal(requests[8].url.searchParams.get('kind'), 'expense')
    assert.equal(requests[8].options.signal, controller.signal)
    globalThis.fetch = async () => Response.json({ detail: [{ msg: 'Choose a start time' }] }, { status: 422 })
    await assert.rejects(postCaptureSave(draft, requestId), /Choose a start time/)
    document.cookie = ''
  } finally { globalThis.fetch = originalFetch }
  for (const size of ['fit', 'compact', 'default', 'large']) {
    useUIStore.getState().setInterfaceSize(size)
    assert.equal(document.documentElement.dataset.interfaceSize, size)
    assert.equal(localStorage.getItem('context:interface-size'), size)
  }
  useUIStore.getState().setOpensOn('last')
  assert.equal(localStorage.getItem('context:opens-on'), 'last')
  assert.notEqual(lastSectionKey('first-user'), lastSectionKey('second-user'))
  assert.equal(safeStartPath('/money?period=week'), '/money?period=week')
  assert.equal(safeStartPath('/settings?tab=integrations'), '/settings?tab=integrations')
  for (const unsafe of ['//example.com', 'https://example.com', '/api/config', '/auth', '/\\example.com']) {
    assert.equal(safeStartPath(unsafe), '/')
  }
  console.log('PASS: spotlight navigation, AI/streak badges, vault setup, sign-in controls, sidebar fallback, hidden sections, interface sizes, and safe startup preferences.')
} finally {
  await server.close()
}
