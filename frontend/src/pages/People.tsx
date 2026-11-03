import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import {
  ArrowRight,
  Cake,
  CalendarDays,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { fetchPeople, postQuick, type Person } from '@/lib/api'
import { initials, relativeTime } from '@/lib/format'
import { avatarGradient, isBirthdaySoon } from '@/lib/people'
import { PageHeader, ErrorPanel, EmptyCommand } from '@/components/pages/PageChrome'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SpinnerArc } from '@/components/motion/SpinnerArc'
import { useSound } from '@/hooks/useSound'
import { cn } from '@/lib/utils'

function lastContactedLabel(value?: string | null) {
  if (!value) return 'Never contacted'
  const label = relativeTime(value)
  if (/less than a minute|minute/i.test(label)) return 'Today'
  return label
}

type SortKey = 'recent' | 'az' | 'birthday'

function SortToggle({ value, onChange }: { value: SortKey; onChange: (value: SortKey) => void }) {
  return (
    <div className="relative flex rounded-lg border border-border bg-surface-2 p-0.5">
      {(
        [
          ['recent', 'Recent'],
          ['az', 'A–Z'],
          ['birthday', 'Birthday'],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'relative z-10 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors',
            value === key ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {value === key && (
            <motion.span
              layoutId="people-sort-pill"
              className="absolute inset-0 -z-10 rounded-md bg-primary"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
          {label}
        </button>
      ))}
    </div>
  )
}

function PersonCard({ person }: { person: Person }) {
  const navigate = useNavigate()
  const playClick = useSound('click')
  const gradient = avatarGradient(person.name)
  const birthday = isBirthdaySoon(person.birthday)

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      whileHover={{ y: -3 }}
      onClick={() => {
        playClick()
        navigate(`/people/${encodeURIComponent(person.name)}`)
      }}
      className="group relative flex w-full flex-col items-start gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card/55 p-4 text-left backdrop-blur-xl transition-shadow hover:shadow-[0_14px_36px_-16px_hsl(var(--primary)/0.3)]"
    >
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 translate-y-full bg-gradient-to-t from-primary/[0.07] to-transparent transition-transform duration-300 group-hover:translate-y-0" />

      <div className="flex w-full items-start justify-between gap-2">
        <div className="relative">
          <motion.div
            layoutId={`avatar-${person.name}`}
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br text-[15px] font-semibold text-white shadow-lg',
              gradient,
              birthday && 'ring-2 ring-amber-400/80 ring-offset-2 ring-offset-card'
            )}
          >
            {initials(person.name)}
          </motion.div>
          {birthday && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] text-black shadow">
              🎂
            </span>
          )}
        </div>
        <Badge variant="secondary" className="shrink-0">
          <MessageSquare className="h-2.5 w-2.5" />
          {person.fact_count} {person.fact_count === 1 ? 'fact' : 'facts'}
        </Badge>
      </div>

      <div className="w-full min-w-0">
        <p className="truncate text-[14px] font-semibold text-foreground">{person.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
          <CalendarDays className="h-3 w-3 shrink-0 text-muted-foreground/50" />
          {lastContactedLabel(person.last_contacted)}
        </p>
        {person.birthday && (
          <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <Cake className="h-2.5 w-2.5" />
            {person.birthday}
          </p>
        )}
      </div>

      <span className="flex items-center gap-1 text-[10px] font-medium text-primary opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
        Open <ArrowRight className="h-3 w-3" />
      </span>
    </motion.button>
  )
}

function AddPersonDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const playChime = useSound('chime')
  const playThud = useSound('thud')
  const [name, setName] = useState('')
  const [fact, setFact] = useState('')

  const add = useMutation({
    mutationFn: () => postQuick(`person ${name.trim()}: ${fact.trim()}`),
    onSuccess: (result) => {
      playChime()
      toast.success(result.message || 'Person added')
      queryClient.invalidateQueries({ queryKey: ['people'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      queryClient.invalidateQueries({ queryKey: ['config'] })
      onClose()
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not add person')
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <motion.button
        aria-label="Close"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.form
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim().length < 2 || !fact.trim() || add.isPending) return
          add.mutate()
        }}
        className="relative w-full max-w-sm rounded-2xl border border-border bg-popover p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">Add a person</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Saved as a manual note. Everything stays on this device.
        </p>
        <div className="mt-4 space-y-2.5">
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            aria-label="Name"
          />
          <Input
            value={fact}
            onChange={(event) => setFact(event.target.value)}
            placeholder="One thing worth remembering"
            aria-label="Fact"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} sound={false}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={name.trim().length < 2 || !fact.trim() || add.isPending}>
            {add.isPending ? <SpinnerArc /> : <Sparkles className="h-3 w-3" />}
            Add person
          </Button>
        </div>
      </motion.form>
    </div>
  )
}

export default function People() {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [adding, setAdding] = useState(false)
  const playClick = useSound('click')

  const peopleQuery = useQuery({ queryKey: ['people'], queryFn: fetchPeople })

  const people = useMemo(() => {
    const all = peopleQuery.data?.people ?? []
    const query = search.trim().toLowerCase()
    const filtered = query
      ? all.filter(
          (person) =>
            person.name.toLowerCase().includes(query) ||
            (person.birthday ?? '').toLowerCase().includes(query)
        )
      : all

    const sorted = [...filtered]
    if (sort === 'az') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'birthday') {
      sorted.sort((a, b) => {
        if (!a.birthday && !b.birthday) return a.name.localeCompare(b.name)
        if (!a.birthday) return 1
        if (!b.birthday) return -1
        return a.birthday.localeCompare(b.birthday)
      })
    } else {
      sorted.sort((a, b) => {
        const aTime = a.last_contacted ? new Date(a.last_contacted).getTime() : 0
        const bTime = b.last_contacted ? new Date(b.last_contacted).getTime() : 0
        return bTime - aTime
      })
    }
    return sorted
  }, [peopleQuery.data, search, sort])

  if (peopleQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (peopleQuery.isError || !peopleQuery.data) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <PageHeader icon={Users} eyebrow="People" title="Your orbit" />
        <ErrorPanel
          error={peopleQuery.error}
          onRetry={() => peopleQuery.refetch()}
          retrying={peopleQuery.isFetching}
          className="mt-6"
        />
      </div>
    )
  }

  const total = peopleQuery.data.total

  return (
    <div className="relative mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
      {/* floating particles */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {[
          { left: '12%', top: '24%', size: 3, delay: '0s' },
          { left: '32%', top: '62%', size: 2, delay: '1.2s' },
          { left: '58%', top: '18%', size: 4, delay: '2.4s' },
          { left: '76%', top: '48%', size: 2, delay: '0.6s' },
          { left: '88%', top: '72%', size: 3, delay: '3.1s' },
        ].map((particle, index) => (
          <span
            key={index}
            className="people-particle absolute rounded-full bg-primary/40"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              animationDelay: particle.delay,
            }}
          />
        ))}
      </div>

      <PageHeader
        icon={Users}
        eyebrow="People"
        title={`People (${total})`}
        subtitle="Facts, birthdays and the last time you spoke."
        actions={
          <Button
            size="sm"
            onClick={() => {
              playClick()
              setAdding(true)
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add person
          </Button>
        }
      />

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people…"
            className="pl-9"
            aria-label="Search people"
          />
        </div>
        <SortToggle
          value={sort}
          onChange={(value) => {
            playClick()
            setSort(value)
          }}
        />
      </div>

      {people.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/50">
          <EmptyCommand
            icon={Users}
            title={search ? 'No one matches that search' : 'Your orbit is empty'}
            hint={
              search
                ? 'Try a shorter name, or clear the search.'
                : 'Add a person with one fact worth remembering.'
            }
            command="person <name>: got a new job"
          />
        </div>
      ) : (
        <motion.div layout className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {people.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>{adding && <AddPersonDialog onClose={() => setAdding(false)} />}</AnimatePresence>
    </div>
  )
}
