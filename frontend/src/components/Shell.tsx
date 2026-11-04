import { useState, type ReactNode } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import TopNavigation from './TopNavigation'
import { useUIStore } from '@/store/ui'

interface ShellProps {
  children: ReactNode
}

export default function Shell({ children }: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navStyle = useUIStore(state => state.navStyle)

  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-transparent">
      {navStyle === 'sidebar' && <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} showMenuButton={navStyle === 'sidebar'} />
        {navStyle === 'topbar' && <TopNavigation />}
        <main className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] bg-transparent">
          {/* ambient violet glow at the top centre of the app area */}
          <div aria-hidden className="ambient-glow" />
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </div>
  )
}
