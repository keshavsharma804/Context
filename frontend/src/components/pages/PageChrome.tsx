import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Copy, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  icon: LucideIcon
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  backTo?: string
  backLabel?: string
}

export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  actions,
  backTo,
  backLabel = 'Back',
}: PageHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="min-w-0">
        {backTo && (
          <Link
            to={backTo}
            className="link-underline mb-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            {backLabel}
          </Link>
        )}
        {eyebrow && (
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/50">
            {eyebrow}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="mt-1.5 text-[13px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  )
}

export function ErrorPanel({
  error,
  onRetry,
  retrying,
  className,
}: {
  error: unknown
  onRetry: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/60 px-6 py-12 text-center',
        className
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-400 light:text-red-600">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-foreground">Couldn&apos;t load this page</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
        {error instanceof Error ? error.message : 'The backend may be offline.'}
      </p>
      <Button variant="outline" size="sm" sound="thud" onClick={onRetry} disabled={retrying}>
        <RefreshCw className={cn('h-3 w-3', retrying && 'animate-spin')} />
        Retry
      </Button>
    </div>
  )
}

export function EmptyCommand({
  icon: Icon = Sparkles,
  title,
  hint,
  description,
  command,
  className,
}: {
  icon?: LucideIcon
  title: string
  hint?: string
  description?: string
  command?: string
  className?: string
}) {
  const displayHint = hint ?? description
  const copy = async () => {
    if (!command) return
    try {
      await navigator.clipboard.writeText(command)
      toast.success('Command copied', { description: command })
    } catch {
      toast.error('Could not copy — select the command manually')
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface-2 text-muted-foreground/70">
        <Icon className="h-4 w-4" strokeWidth={1.6} />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {displayHint && (
        <p className="max-w-sm text-[11px] leading-relaxed text-muted-foreground/70">{displayHint}</p>
      )}
      {command && (
        <button
          onClick={copy}
          className="group mt-1 inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface-inset px-3 py-1.5 font-mono text-[11px] text-foreground/80 transition-colors hover:border-primary/30 hover:text-foreground"
          title="Copy command"
        >
          <span className="text-primary/70">›</span>
          {command}
          <Copy className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary" />
        </button>
      )}
    </div>
  )
}

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-44 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

export function CopiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-500">
      <Check className="h-2.5 w-2.5" /> copied
    </span>
  )
}
