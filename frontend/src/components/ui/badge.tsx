import type * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-primary/20 bg-primary/10 text-primary',
        secondary: 'border-border bg-surface-2 text-muted-foreground',
        outline: 'border-border bg-transparent text-muted-foreground',
        success:
          'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 light:text-emerald-600',
        warning: 'border-amber-500/20 bg-amber-500/10 text-amber-400 light:text-amber-700',
        danger: 'border-red-500/20 bg-red-500/10 text-red-400 light:text-red-600',
        info: 'border-blue-500/20 bg-blue-500/10 text-blue-400 light:text-blue-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
