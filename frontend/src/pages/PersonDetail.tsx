import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import {
  Cake,
  CalendarDays,
  Check,
  Heart,
  MessageCircle,
  Plus,
  Quote,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import {
  fetchPerson,
  postPersonContacted,
  postPersonFact,
} from '@/lib/api'
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

const FACT_TONE: Record<string, string> = {
  work: 'bg-violet-500/10 text-violet-300 ring-violet-400/20 light:text-violet-700',
  health: 'bg-red-500/10 text-red-300 ring-red-400/20 light:text-red-700',
  life: 'bg-amber-500/10 text-amber-300 ring-amber-400/20 light:text-amber-700',
  plans: 'bg-blue-500/10 text-blue-300 ring-blue-400/20 light:text-blue-700',
  family: 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/20 light:text-emerald-700',
  other: 'bg-surface-2 text-muted-foreground ring-hairline',
}

export default function PersonDetail() {
  const { name = '' } = useParams()
  const queryClient = useQueryClient()
  const playClick = useSound('click')
  const playChime = useSound('chime')
  const playThud = useSound('thud')
  const [adding, setAdding] = useState(false)
  const [fact, setFact] = useState('')
  const [heart, setHeart] = useState(false)

  const personQuery = useQuery({
    queryKey: ['person', name],
    queryFn: () => fetchPerson(name),
    enabled: Boolean(name),
  })

  const markContacted = useMutation({
    mutationFn: () => postPersonContacted(name),
    onSuccess: () => {
      playChime()
      setHeart(true)
      window.setTimeout(() => setHeart(false), 900)
      toast.success(`Marked ${name} as contacted`)
      queryClient.invalidateQueries({ queryKey: ['person', name] })
      queryClient.invalidateQueries({ queryKey: ['people'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not update')
    },
  })

  const addFact = useMutation({
    mutationFn: () => postPersonFact(name, fact.trim()),
    onSuccess: () => {
      playChime()
      toast.success('Fact added')
      setFact('')
      setAdding(false)
      queryClient.invalidateQueries({ queryKey: ['person', name] })
      queryClient.invalidateQueries({ queryKey: ['people'] })
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not save fact')
    },
  })

  if (personQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-3 w-16" />
        <div className="mt-6 flex items-center gap-5">
          <Skeleton className="h-28 w-28 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (personQuery.isError || !personQuery.data) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-6 lg:px-8">
        <PageHeader icon={User} title={name || 'Person'} backTo="/people" backLabel="People" />
        <ErrorPanel
          error={personQuery.error}
          onRetry={() => personQuery.refetch()}
          retrying={personQuery.isFetching}
          className="mt-6"
        />
      </div>
    )
  }

  const person = personQuery.data
  const gradient = avatarGradient(person.name)
  const birthdaySoon = isBirthdaySoon(person.birthday)
  const factCount = person.facts.length

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={User}
        eyebrow="Person"
        title={person.name}
        subtitle={`${factCount} ${factCount === 1 ? 'fact' : 'facts'} · ${person.last_contacted ? `last spoke ${relativeTime(person.last_contacted)}` : 'never contacted'}`}
        backTo="/people"
        backLabel="All people"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                playClick()
                setAdding((value) => !value)
              }}
            >
              {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              Add fact
            </Button>
            <Button
              size="sm"
              onClick={() => markContacted.mutate()}
              disabled={markContacted.isPending}
            >
              {markContacted.isPending ? <SpinnerArc /> : <Send className="h-3.5 w-3.5" />}
              Mark contacted
            </Button>
          </>
        }
      />

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative mt-6 overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-xl"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="relative">
            <motion.div
              layoutId={`avatar-${person.name}`}
              className={cn(
                'flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br text-3xl font-semibold text-white shadow-2xl',
                gradient,
                birthdaySoon && 'ring-2 ring-amber-400/80 ring-offset-4 ring-offset-card'
              )}
            >
              {initials(person.name)}
            </motion.div>
            <AnimatePresence>
              {heart && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.4, y: 6 }}
                  animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.35, 1.1, 0.9], y: -34 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9 }}
                  className="pointer-events-none absolute inset-0 flex items-start justify-center text-rose-400"
                >
                  <Heart className="h-7 w-7 fill-current" />
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="min-w-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{person.name}</h2>
              {birthdaySoon && (
                <Badge variant="warning" className="gap-1">
                  <Cake className="h-2.5 w-2.5" /> birthday soon
                </Badge>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Cake className="h-3 w-3 text-muted-foreground/50" />
                {person.birthday || 'No birthday saved'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3 text-muted-foreground/50" />
                {person.last_contacted ? relativeTime(person.last_contacted) : 'Not contacted yet'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="h-3 w-3 text-muted-foreground/50" />
                {factCount} facts
              </span>
            </p>
          </motion.div>
        </div>
      </motion.section>

      <AnimatePresence>
        {adding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            onSubmit={(event) => {
              event.preventDefault()
              if (!fact.trim() || addFact.isPending) return
              addFact.mutate()
            }}
            className="mt-3 overflow-hidden"
          >
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 p-2">
              <Sparkles className="ml-1 h-3.5 w-3.5 shrink-0 text-primary/70" />
              <Input
                autoFocus
                value={fact}
                onChange={(event) => setFact(event.target.value)}
                placeholder={`Something new about ${person.name}…`}
                className="h-8 border-transparent bg-transparent shadow-none"
                aria-label="New fact"
              />
              <Button type="submit" size="sm" disabled={!fact.trim() || addFact.isPending}>
                {addFact.isPending ? <SpinnerArc /> : <Check className="h-3 w-3" />}
                Save
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Facts timeline */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-foreground">Facts timeline</h3>
          <span className="text-[10px] text-muted-foreground/60">newest first</span>
        </div>

        {person.facts.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-border/60 bg-card/50">
            <EmptyCommand
              icon={Quote}
              title="No facts yet"
              hint={`Add one thing worth remembering about ${person.name}.`}
              command={`person ${person.name}: got a new job`}
            />
          </div>
        ) : (
          <div className="relative mt-4 pl-6">
            <span className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-primary/60 via-primary/25 to-transparent" />
            <div className="space-y-3">
              {person.facts.map((item, index) => (
                <motion.article
                  key={`${item.created_at}-${index}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + index * 0.06, duration: 0.35 }}
                  className="group relative rounded-xl border border-border/60 bg-card/55 p-4 backdrop-blur-xl transition-colors hover:border-primary/25"
                >
                  <span className="absolute -left-[23px] top-5 flex h-3 w-3 items-center justify-center rounded-full border border-primary/40 bg-background">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary transition-transform duration-200 group-hover:scale-125" />
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide ring-1 ring-inset',
                        FACT_TONE[item.category] ?? FACT_TONE.other
                      )}
                    >
                      {item.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">
                      {new Date(item.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{item.fact}</p>
                </motion.article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
