import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  hint?: string
  className?: string
}

export default function EmptyState({
  icon: Icon,
  title,
  hint,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center',
        className
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface-2 text-muted-foreground/70">
        <Icon className="h-4 w-4" strokeWidth={1.6} />
      </span>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {hint ? (
        <p className="max-w-[26ch] text-[11px] leading-relaxed text-muted-foreground/60">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
