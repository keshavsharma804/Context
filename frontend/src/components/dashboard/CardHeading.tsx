import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CardHeadingProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}

export default function CardHeading({
  icon: Icon,
  title,
  subtitle,
  action,
  className,
}: CardHeadingProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 px-5 pt-5',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          {subtitle ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
