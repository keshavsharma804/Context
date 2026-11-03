import {
  useCallback,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

interface RippleItem {
  id: number
  x: number
  y: number
  size: number
}

let rippleId = 0

/**
 * Material-style ripple button. Any clickable surface can be wrapped with it;
 * the ripple is rendered inside an overflow-hidden layer so it never leaks.
 */
export function Ripple({
  children,
  className,
  onClick,
  disabled,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  const [ripples, setRipples] = useState<RippleItem[]>([])

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (disabled) return
      const rect = event.currentTarget.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 2
      const ripple: RippleItem = {
        id: rippleId++,
        x: event.clientX - rect.left - size / 2,
        y: event.clientY - rect.top - size / 2,
        size,
      }
      setRipples((current) => [...current, ripple])
      window.setTimeout(() => {
        setRipples((current) => current.filter((item) => item.id !== ripple.id))
      }, 600)
      onClick?.(event)
    },
    [disabled, onClick]
  )

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      className={cn('relative overflow-hidden', className)}
      {...rest}
    >
      {children}
      <span aria-hidden className="pointer-events-none absolute inset-0">
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="ripple-ink absolute rounded-full bg-white/25"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
            }}
          />
        ))}
      </span>
    </button>
  )
}
