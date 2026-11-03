import { useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { FullScreenLoader } from './FullScreenLoader'
import { ProductTourModal } from './ProductTourModal'

export function TourManager() {
  const [showLoader, setShowLoader] = useState(false)
  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    // Check if user has seen the intro tour
    const completed = localStorage.getItem('context:tour_completed')
    if (!completed) {
      setShowLoader(true)
    }

    const handleOpenTour = (e?: Event) => {
      const customEvent = e as CustomEvent<{ withLoader?: boolean }>
      if (customEvent?.detail?.withLoader) {
        setShowLoader(true)
      } else {
        setShowTour(true)
      }
    }

    const handleTourClosedEvent = () => {
      localStorage.setItem('context:tour_completed', 'true')
      setShowTour(false)
    }

    window.addEventListener('context:open-tour', handleOpenTour)
    window.addEventListener('context:tour-closed', handleTourClosedEvent)
    return () => {
      window.removeEventListener('context:open-tour', handleOpenTour)
      window.removeEventListener('context:tour-closed', handleTourClosedEvent)
    }
  }, [])

  const handleLoaderComplete = () => {
    setShowLoader(false)
    setShowTour(true)
  }

  const handleTourClose = () => {
    localStorage.setItem('context:tour_completed', 'true')
    setShowTour(false)
  }

  return (
    <>
      <AnimatePresence>
        {showLoader && <FullScreenLoader onComplete={handleLoaderComplete} />}
      </AnimatePresence>
      <AnimatePresence>
        {showTour && <ProductTourModal open={showTour} onClose={handleTourClose} />}
      </AnimatePresence>
    </>
  )
}
