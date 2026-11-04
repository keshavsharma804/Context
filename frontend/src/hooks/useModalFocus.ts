import { useEffect, type RefObject } from 'react'

export function useModalFocus(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    const wasInert = root?.hasAttribute('inert')
    root?.setAttribute('inert', '')
    const first = ref.current?.querySelector<HTMLElement>('textarea, input') || ref.current?.querySelector<HTMLElement>('button')
    first?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
      if (event.key !== 'Tab') return
      const elements = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')
      if (!elements?.length) { event.preventDefault(); return }
      if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements[elements.length - 1].focus() }
      else if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) { event.preventDefault(); elements[0].focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      if (!wasInert) root?.removeAttribute('inert')
      if (previous?.isConnected) previous.focus()
    }
  }, [ref, onClose])
}
