import { Globe, FileText, ArrowUpRight, Search, X } from 'lucide-react'
import type { FileRow, HistoryRow } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { MotionCard } from './MotionCard'
import CardHeading from './CardHeading'

export default function SearchResultsCard({
  q,
  files,
  history,
  onClear,
}: {
  q: string
  files: FileRow[]
  history: HistoryRow[]
  onClear: () => void
}) {
  const total = files.length + history.length

  return (
    <MotionCard className="lg:col-span-2">
      <CardHeading
        icon={Search}
        title={`Results for “${q}”`}
        subtitle={`${total} match${total === 1 ? '' : 'es'} across files and pages`}
        action={
          <Button variant="ghost" size="xs" onClick={onClear} className="gap-1">
            <X className="h-3 w-3" />
            Clear
          </Button>
        }
      />

      {total === 0 ? (
        <p className="px-5 pb-5 pt-4 text-xs text-muted-foreground">
          Nothing matched. Try a broader phrase.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 px-5 pb-5 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground/40">
              Files
            </p>
            <ul className="space-y-0.5">
              {files.slice(0, 4).map((file) => (
                <li
                  key={file.path}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-surface-2"
                >
                  <FileText className="h-3 w-3 shrink-0 text-amber-400 light:text-amber-700" />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/80">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-[9px] capitalize text-muted-foreground/40">
                    {file.category}
                  </span>
                </li>
              ))}
              {files.length === 0 && (
                <li className="px-1.5 py-1.5 text-[11px] text-muted-foreground/40">
                  No file matches
                </li>
              )}
            </ul>
          </div>

          <div>
            <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground/40">
              Pages
            </p>
            <ul className="space-y-0.5">
              {history.slice(0, 4).map((page) => (
                <li key={page.url}>
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noreferrer"
                    className="link-underline group flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-surface-2"
                  >
                    <Globe className="h-3 w-3 shrink-0 text-blue-400 light:text-blue-700" />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/80">
                      {page.title || page.url}
                    </span>
                    <ArrowUpRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground/30 group-hover:text-primary" />
                  </a>
                </li>
              ))}
              {history.length === 0 && (
                <li className="px-1.5 py-1.5 text-[11px] text-muted-foreground/40">
                  No page matches
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </MotionCard>
  )
}

