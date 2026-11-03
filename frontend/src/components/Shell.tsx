import { useState, type ReactNode } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

interface ShellProps {
  children: ReactNode
}

export default function Shell({ children }: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-transparent">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="relative flex-1 overflow-y-auto bg-transparent">
          {/* ambient violet glow at the top centre of the app area */}
          <div aria-hidden className="ambient-glow" />
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </div>
  )
}
