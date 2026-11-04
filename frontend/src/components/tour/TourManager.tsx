import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import { FullScreenLoader } from './FullScreenLoader'
import { ProductTourModal } from './ProductTourModal'

function hasCompletedTour() {
  try { return localStorage.getItem('context:tour_completed') === 'true' } catch { return false }
}

export function TourManager({ ready = true, children }: { ready?: boolean; children?: ReactNode }) {
  const [needsTour, setNeedsTour] = useState(() => !hasCompletedTour())
  const [phase, setPhase] = useState<'loading' | 'tour' | 'idle'>(() => !ready || !hasCompletedTour() ? 'loading' : 'idle')
  const [bootComplete, setBootComplete] = useState(() => ready && hasCompletedTour())
  const [loaderComplete, setLoaderComplete] = useState(false)
  const finishLoader = useCallback(() => setLoaderComplete(true), [])

  // Keep one opaque loader mounted while the session resolves, even after 100%.
  useEffect(() => {
    if (phase !== 'loading' || !ready || (needsTour && !loaderComplete)) return
    setPhase(needsTour ? 'tour' : 'idle')
    if (!needsTour) setBootComplete(true)
  }, [phase, loaderComplete, ready, needsTour])

  useEffect(() => {
    const handleOpenTour = (e?: Event) => {
      setNeedsTour(true)
      const customEvent = e as CustomEvent<{ withLoader?: boolean }>
      if (customEvent?.detail?.withLoader) {
        setLoaderComplete(false)
        setPhase('loading')
      } else {
        setPhase('tour')
      }
    }

    const handleTourClosedEvent = () => {
      try { localStorage.setItem('context:tour_completed', 'true') } catch { /* Storage is optional. */ }
      setPhase('idle')
      setBootComplete(true)
    }

    window.addEventListener('context:open-tour', handleOpenTour)
    window.addEventListener('context:tour-closed', handleTourClosedEvent)
    return () => {
      window.removeEventListener('context:open-tour', handleOpenTour)
      window.removeEventListener('context:tour-closed', handleTourClosedEvent)
    }
  }, [])

  const handleTourClose = () => {
    try { localStorage.setItem('context:tour_completed', 'true') } catch { /* Storage is optional. */ }
    setPhase('idle')
    setBootComplete(true)
  }

  return (
    <>
      {ready && (bootComplete || !needsTour) && children}
      {!bootComplete && <div aria-hidden className="fixed inset-0 bg-[#090a0d]" />}
      <AnimatePresence>
        {phase === 'loading' && (!ready || needsTour) && <FullScreenLoader onComplete={finishLoader} durationMs={needsTour ? 2000 : 350} />}
      </AnimatePresence>
      <AnimatePresence>
        {phase === 'tour' && <ProductTourModal open onClose={handleTourClose} />}
      </AnimatePresence>
    </>
  )
}
