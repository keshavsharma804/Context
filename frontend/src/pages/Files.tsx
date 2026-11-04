import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowUpRight,
  Code2,
  File,
  FileText,
  FolderOpen,
  Grid2X2,
  Image as ImageIcon,
  List,
  Receipt,
  RefreshCw,
  Search,
  Ticket,
  User,
  X,
} from 'lucide-react'
import { fetchFiles, type FileResult, type FilesData } from '@/lib/api'
import { shortDate } from '@/lib/format'
import { PageHeader, ErrorPanel, EmptyCommand } from '@/components/pages/PageChrome'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const CHIPS = [
  { key: 'all', label: 'All', db: 'all' },
  { key: 'pdf', label: 'PDF', db: 'pdf' },
  { key: 'docx', label: 'DOCX', db: 'doc' },
  { key: 'code', label: 'Code', db: 'code' },
  { key: 'images', label: 'Images', db: 'image' },
  { key: 'invoices', label: 'Invoices', db: 'invoice' },
] as const

function iconFor(category: string) {
  switch (category) {
    case 'pdf':
      return { Icon: FileText, color: 'text-red-400 light:text-red-600', bg: 'bg-red-500/10' }
    case 'doc':
      return { Icon: FileText, color: 'text-blue-400 light:text-blue-600', bg: 'bg-blue-500/10' }
    case 'code':
      return { Icon: Code2, color: 'text-emerald-400 light:text-emerald-600', bg: 'bg-emerald-500/10' }
    case 'image':
      return { Icon: ImageIcon, color: 'text-violet-400 light:text-violet-600', bg: 'bg-violet-500/10' }
    case 'invoice':
      return { Icon: Receipt, color: 'text-amber-400 light:text-amber-600', bg: 'bg-amber-500/10' }
    case 'resume':
      return { Icon: User, color: 'text-fuchsia-400 light:text-fuchsia-600', bg: 'bg-fuchsia-500/10' }
    case 'ticket':
      return { Icon: Ticket, color: 'text-cyan-400 light:text-cyan-600', bg: 'bg-cyan-500/10' }
    default:
      return { Icon: File, color: 'text-muted-foreground', bg: 'bg-surface-2' }
  }
}

function sizeLabel(kb?: number) {
  if (!kb || kb <= 0) return '—'
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`
  return `${Math.round(kb)} KB`
}

function fileUrl(path: string) {
  const normalized = path.replace(/\\/g, '/')
  return `file:///${normalized.replace(/^\/+/, '')}`
}

function cleanSnippet(snippet?: string) {
  return (snippet || '').replace(/<\/?b>/g, '')
}

function FileCard({ file, index }: { file: FileResult; index: number }) {
  const { Icon, color, bg } = iconFor(file.category)
  return (
    <motion.a
      layout
      href={fileUrl(file.path)}
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ delay: Math.min(index * 0.012, 0.18), duration: 0.25 }}
      whileHover={{ y: -3 }}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border/60 bg-card/55 p-3.5 backdrop-blur-xl transition-shadow hover:shadow-[0_12px_30px_-16px_hsl(var(--primary)/0.32)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', bg, color)}>
          <Icon className="h-4 w-4" />
        </span>
        <Badge variant="secondary" className="capitalize">
          {file.category}
        </Badge>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-medium text-foreground" title={file.name}>
          {file.name}
        </p>
        {file.snip && (
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground/60">
            {cleanSnippet(file.snip)}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between text-[9px] text-muted-foreground/60">
        <span className="tabular-nums">{sizeLabel(file.size_kb)}</span>
        <span>{shortDate(file.downloaded)}</span>
      </div>
      <span className="flex items-center gap-1 text-[9px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        Open <ArrowUpRight className="h-2.5 w-2.5" />
      </span>
    </motion.a>
  )
}

function FileRow({ file, index }: { file: FileResult; index: number }) {
  const { Icon, color, bg } = iconFor(file.category)
  return (
    <motion.a
      layout
      href={fileUrl(file.path)}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ delay: Math.min(index * 0.008, 0.14), duration: 0.22 }}
      className="group flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-hairline hover:bg-surface-2"
    >
      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', bg, color)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-foreground/90">{file.name}</p>
        <p className="truncate text-[9px] text-muted-foreground/50">{file.path}</p>
      </div>
      <Badge variant="secondary" className="hidden capitalize sm:inline-flex">
        {file.category}
      </Badge>
      <span className="hidden w-14 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground/60 sm:block">
        {sizeLabel(file.size_kb)}
      </span>
      <span className="hidden w-16 shrink-0 text-right text-[9px] text-muted-foreground/60 md:block">
        {shortDate(file.downloaded)}
      </span>
      <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/25 transition-colors group-hover:text-primary" />
    </motion.a>
  )
}

export default function Files() {
  const [params] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') || '')
  const [debounced, setDebounced] = useState(() => params.get('q') || '')
  const [category, setCategory] = useState<string>('all')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const inputRef = useRef<HTMLInputElement>(null)
  const typing = query !== debounced

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const filesQuery = useQuery({
    queryKey: ['files', debounced, category],
    queryFn: () => fetchFiles(debounced, category),
  })

  const counts = useMemo(() => {
    const data = filesQuery.data as FilesData | undefined
    const map: Record<string, number> = { all: data?.total ?? 0 }
    data?.categories.forEach((entry) => {
      map[entry.category] = entry.count
    })
    return map
  }, [filesQuery.data])

  if (filesQuery.isLoading && !filesQuery.data) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="mt-5 h-10 w-full rounded-xl" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (filesQuery.isError || !filesQuery.data) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <PageHeader icon={FolderOpen} eyebrow="Files" title="Your files" />
        <ErrorPanel
          error={filesQuery.error}
          onRetry={() => filesQuery.refetch()}
          retrying={filesQuery.isFetching}
          className="mt-6"
        />
      </div>
    )
  }

  const data = filesQuery.data
  const files = data.files

  return (
    <div className="relative mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
      <div aria-hidden className="files-grid-bg pointer-events-none absolute inset-0" data-active={typing} />

      <PageHeader
        icon={FolderOpen}
        eyebrow="Files"
        title="Your files"
        subtitle={`${data.total} indexed · ${files.length} shown${debounced ? ` for “${debounced}”` : ''}`}
        actions={
          <div className="relative flex rounded-lg border border-border bg-surface-2 p-0.5">
            {(
              [
                ['grid', Grid2X2],
                ['list', List],
              ] as const
            ).map(([key, Icon]) => (
              <button
                key={key}
                onClick={() => setLayout(key)}
                aria-label={`${key} view`}
                className={cn(
                  'relative z-10 flex h-7 w-8 items-center justify-center rounded-md transition-colors',
                  layout === key ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {layout === key && (
                  <motion.span
                    layoutId="files-layout-pill"
                    className="absolute inset-0 -z-10 rounded-md bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        }
      />

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
        <Input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${data.total} files — invoices, CVs, notes, code…`}
          className="h-10 pl-10 pr-9"
          aria-label="Search files"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
        {CHIPS.map((chip) => {
          const active = category === chip.key
          return (
            <button
              key={chip.key}
              onClick={() => setCategory(chip.key)}
              className={cn(
                'relative rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors',
                active
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-surface-1 text-muted-foreground hover:border-primary/20 hover:text-foreground'
              )}
            >
              {active && (
                <motion.span
                  layoutId="files-chip"
                  className="absolute inset-0 -z-10 rounded-full bg-primary/10"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              {chip.label}
              <span className="ml-1 tabular-nums opacity-60">
                {counts[chip.db === 'all' ? 'all' : chip.db] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      <div className="relative mt-4">
        {files.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/50">
            <EmptyCommand
              icon={FolderOpen}
              title={debounced ? `No files match “${debounced}”` : 'No files in this category'}
              hint="Try a broader search, or rescan your Downloads and Documents folders."
              command="rescan"
            />
          </div>
        ) : layout === 'grid' ? (
          <motion.div layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {files.map((file, index) => (
                <FileCard key={`${file.path}-${file.name}`} file={file} index={index} />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div layout className="rounded-2xl border border-border/60 bg-card/45 p-1.5 backdrop-blur-xl">
            <AnimatePresence mode="popLayout">
              {files.map((file, index) => (
                <FileRow key={`${file.path}-${file.name}`} file={file} index={index} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/35">
        <RefreshCw className="h-2.5 w-2.5" />
        {typing ? 'Searching…' : 'Indexed locally · no uploads'}
      </p>
    </div>
  )
}
