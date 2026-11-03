import type * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 rounded-lg border border-transparent bg-surface-2 px-3 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70',
        'hover:bg-surface-3 focus-visible:border-primary/50 focus-visible:bg-surface-inset focus-visible:ring-2 focus-visible:ring-primary/15',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { Input }
