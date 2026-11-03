import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function CardShell({
  className,
  children,
}: {
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-5 shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-2 w-32" />
        </div>
      </div>
      {children}
    </div>
  )
}

function Rows({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-4 space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <Skeleton className="h-6 w-6 shrink-0 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-2.5" style={{ width: `${70 - i * 8}%` }} />
            <Skeleton className="h-2 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Loading state mirroring the real dashboard grid. */
export default function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
      <div className="space-y-2">
        <Skeleton className="h-2.5 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3 w-80" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <CardShell className="h-[236px]">
            <div className="mt-6 space-y-2">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-2.5 w-72" />
            </div>
            <div className="mt-5 flex gap-2">
              <Skeleton className="h-12 flex-1 rounded-xl" />
              <Skeleton className="h-12 w-28 rounded-xl" />
            </div>
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-5 w-40 rounded-full" />
              <Skeleton className="h-5 w-32 rounded-full" />
            </div>
          </CardShell>
        </div>

        <div className="lg:col-span-2">
          <CardShell className="h-[168px]">
            <div className="mt-4 space-y-2">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          </CardShell>
        </div>

        <CardShell className="h-[316px]">
          <div className="mt-5 space-y-1">
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="mt-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-2 w-16" />
                  <Skeleton className="h-2 w-10" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </CardShell>

        <CardShell className="h-[316px]">
          <div className="mt-5 grid grid-cols-2 gap-4">
            <Rows count={2} />
            <Rows count={2} />
          </div>
        </CardShell>

        <div className="lg:col-span-2">
          <CardShell className="h-[232px]">
            <div className="mt-5 space-y-4 pl-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-2.5 w-10" />
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-2.5 w-1/3" />
                    <Skeleton className="h-2 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </CardShell>
        </div>

        <div className="lg:col-span-2">
          <CardShell className="h-[232px]">
            <div className="mt-5 grid grid-cols-2 gap-6">
              <Rows count={3} />
              <Rows count={3} />
            </div>
          </CardShell>
        </div>

        <CardShell className="h-[280px]">
          <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-lg bg-surface-1 p-2">
                <Skeleton className="h-2 w-12" />
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            ))}
          </div>
        </CardShell>

        <CardShell className="h-[280px]">
          <Rows count={3} />
        </CardShell>

        <CardShell className="h-[280px]">
          <Rows count={3} />
        </CardShell>

        <CardShell className="h-[280px]">
          <Rows count={3} />
        </CardShell>
      </div>
    </div>
  )
}
