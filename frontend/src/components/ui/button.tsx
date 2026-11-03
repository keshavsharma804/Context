import * as React from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { useSound, type SoundName } from '@/hooks/useSound'

const buttonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline:
          'border border-border bg-transparent text-foreground hover:border-border hover:bg-surface-2',
        ghost:
          'text-muted-foreground hover:bg-surface-3 hover:text-foreground',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-7 rounded-md px-2.5 text-xs',
        xs: 'h-6 rounded-md px-2 text-[11px]',
        lg: 'h-11 rounded-xl px-6',
        icon: 'h-8 w-8',
        iconSm: 'h-6 w-6 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

interface RippleItem {
  id: number
  x: number
  y: number
  size: number
}

let rippleId = 0

function Button({
  className,
  variant,
  size,
  sound = 'click',
  onClick,
  onPointerDown,
  children,
  disabled,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { sound?: SoundName | false }) {
  const playClick = useSound('click')
  const [ripples, setRipples] = React.useState<RippleItem[]>([])

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return
    const rect = event.currentTarget.getBoundingClientRect()
    const diameter = Math.max(rect.width, rect.height) * 2
    const ripple: RippleItem = {
      id: rippleId++,
      x: event.clientX - rect.left - diameter / 2,
      y: event.clientY - rect.top - diameter / 2,
      size: diameter,
    }
    setRipples((current) => [...current, ripple])
    window.setTimeout(() => {
      setRipples((current) => current.filter((item) => item.id !== ripple.id))
    }, 620)
    onPointerDown?.(event)
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (sound) playClick()
    onClick?.(event)
  }

  const motionProps = props as unknown as HTMLMotionProps<'button'>

  return (
    <motion.button
      data-slot="button"
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled}
      {...motionProps}
    >
      {children}
      <span aria-hidden className="pointer-events-none absolute inset-0">
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="ripple-ink absolute rounded-full bg-foreground/20"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
            }}
          />
        ))}
      </span>
    </motion.button>
  )
}

export { Button, buttonVariants }
