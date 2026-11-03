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
  assert.ok(preview.includes('Dashboard preview'))
  assert.ok(!preview.includes('Couldn&#x27;t reach your context'))
  assert.ok(preview.includes('Daily'))
  assert.ok(preview.includes('No expenses this week'))
  assert.ok(preview.includes('Add expense'))
  assert.ok(preview.includes('px-0 pt-0'))
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
