import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutGroup, motion } from 'motion/react'
import { Settings } from 'lucide-react'
import { NAV_GROUPS } from './Sidebar'
import { useUIStore } from '@/store/ui'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'

const items = [...NAV_GROUPS.flatMap(group => group.items),
  { to: '/settings', label: 'Settings', icon: Settings, hotkey: 'S' }]

export default function TopNavigation() {
  const hidden = useUIStore(state => state.hiddenSections)
  const reduced = useReducedMotion()
  const { pathname } = useLocation()
  const nav = useRef<HTMLElement>(null)

  useEffect(() => {
    nav.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({
      block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth',
    })
  }, [pathname, reduced])

  return (
    <LayoutGroup id="top-navigation">
      <nav ref={nav} aria-label="Main navigation"
        className="relative z-20 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-sidebar/95 px-3 py-2">
        {items.filter(item => !hidden.includes(item.to)).map(({ to, label, icon: Icon, hotkey }) => (
          <NavLink key={to} to={to} end={to === '/'} data-ui-tooltip={`${label} (G ${hotkey})`}
            className={({ isActive }) => cn('relative isolate flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive ? 'text-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground')}>
            {({ isActive }) => <>
              {isActive && (
                <motion.span aria-hidden="true" layoutId="nav-spotlight"
                  transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 290, damping: 29 }}
                  className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-xl border border-primary/25 bg-primary/[0.07] shadow-[inset_0_1px_0_hsl(var(--primary)/0.18)]">
                  <span className="absolute inset-x-3 top-0 h-px rounded-full bg-primary/70 shadow-[0_0_12px_2px_hsl(var(--primary)/0.35)]" />
                  <motion.span key={pathname} className="nav-spotlight-beam absolute -top-2 left-1/2 h-16 w-28 origin-top -translate-x-1/2"
                    initial={false}
                    animate={{ rotate: reduced ? 0 : [-18, 11, -4, 0] }}
                    transition={{ duration: reduced ? 0 : 0.65, ease: 'easeOut' }} />
                </motion.span>
              )}
              <motion.span key={isActive ? `${to}:active` : `${to}:idle`} aria-hidden="true"
                initial={false}
                animate={{ rotate: !reduced && isActive ? [-12, 7, -2, 0] : 0 }}
                transition={{ duration: reduced ? 0 : 0.5, ease: 'easeOut' }}
                className={cn('relative flex transition-[color,filter] duration-200',
                  isActive && 'text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.7)]')}>
                <Icon className="h-4 w-4" strokeWidth={isActive ? 2.2 : 1.7} />
              </motion.span>
              <span className="relative">{label}</span>
            </>}
          </NavLink>
        ))}
      </nav>
    </LayoutGroup>
  )
}
