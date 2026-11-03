import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** One lightweight, themed tooltip for elements marked with data-ui-tooltip. */
export function AppTooltip() {
  const id = useId()
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let active: HTMLElement | null = null
    let previousDescription: string | null = null

    const close = () => {
      clearTimeout(timer)
      if (active) {
        if (previousDescription === null) active.removeAttribute('aria-describedby')
        else active.setAttribute('aria-describedby', previousDescription)
      }
      active = null
      setTip(null)
    }
    const triggerFor = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>('[data-ui-tooltip]') : null
    const open = (target: HTMLElement | null, delay: number) => {
      if (active === target) return
      close()
      if (!target) return
      active = target
      previousDescription = target.getAttribute('aria-describedby')
      timer = setTimeout(() => {
        const text = target.dataset.uiTooltip
        if (!target.isConnected || !text) return close()
        target.setAttribute('aria-describedby', [previousDescription, id].filter(Boolean).join(' '))
        setTip({ text, rect: target.getBoundingClientRect() })
      }, delay)
    }
    const pointerOver = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') open(triggerFor(event.target), 350)
    }
    const pointerOut = (event: PointerEvent) => {
      if (active && !active.contains(event.relatedTarget as Node | null) && !active.contains(document.activeElement)) close()
    }
    const focusIn = (event: FocusEvent) => open(triggerFor(event.target), 0)
    const focusOut = (event: FocusEvent) => {
      if (active && !active.contains(event.relatedTarget as Node | null)) close()
    }
    const keyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerover', pointerOver)
    document.addEventListener('pointerout', pointerOut)
    document.addEventListener('focusin', focusIn)
    document.addEventListener('focusout', focusOut)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', keyDown)
    document.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      close()
      document.removeEventListener('pointerover', pointerOver)
      document.removeEventListener('pointerout', pointerOut)
      document.removeEventListener('focusin', focusIn)
      document.removeEventListener('focusout', focusOut)
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', keyDown)
      document.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [id])

  useLayoutEffect(() => {
    if (!tip || !tooltipRef.current) return
    const { width, height } = tooltipRef.current.getBoundingClientRect()
    const { rect } = tip
    const above = rect.top - height - 8
    setPosition({
      left: Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(above >= 8 ? above : rect.bottom + 8, window.innerHeight - height - 8)),
    })
  }, [tip])

  if (!tip) return null
  return createPortal(
    <div ref={tooltipRef} id={id} role="tooltip"
      className="pointer-events-none fixed z-[200] max-w-[min(18rem,calc(100vw-1rem))] break-words rounded-lg border border-border bg-popover px-3 py-2 text-xs font-medium leading-relaxed text-popover-foreground shadow-lg"
      style={position}>
      {tip.text}
    </div>,
    document.body
  )
}
