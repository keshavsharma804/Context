const sections = new Set(['money', 'subscriptions', 'debts', 'savings', 'review', 'journal', 'people', 'calendar', 'vault', 'email', 'jobs', 'files', 'settings'])

export function safeStartPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/'
  try {
    const url = new URL(value, 'https://context.invalid')
    if (url.origin !== 'https://context.invalid') return '/'
    return url.pathname === '/' || sections.has(url.pathname.split('/')[1])
      ? url.pathname + url.search : '/'
  } catch { return '/' }
}

export const lastSectionKey = (userId: string) => `context:last-section:${userId}`
