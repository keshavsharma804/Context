import { useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
} from 'motion/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { ArrowRight, Check, FileText, Search, Sparkles, Zap } from 'lucide-react'
import { postAsk, type AskResult } from '@/lib/api'
import { celebrateHabitMilestone } from '@/lib/celebrate'
import { toast } from 'sonner'
import { MotionCard } from './MotionCard'
import { MagneticButton } from '../motion/MagneticButton'
import { SpinnerArc } from '../motion/SpinnerArc'
import { useSound } from '../../hooks/useSound'
import { spring } from '../../lib/animations'

const SUGGESTIONS = [
  'What did I spend this week?',
  'What is due this week?',
  'Who should I reach out to?',
  'What did I download recently?',
  'Any promises I made?',
  'What did I work on yesterday?',
]

/** Minimal inline markdown — bold only, enough for Groq's answers. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={index} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  )
}

/** Renders the answer's light markdown (headings, bullets, bold) without a dependency. */
export function AnswerBody({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-[13px] leading-relaxed text-foreground/90">
      {text.split('\n').map((line, index) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={index} className="h-1.5" />

        if (/^[-*]\s+/.test(trimmed)) {
          return (
            <div key={index} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary/70" />
              <span>
                <Inline text={trimmed.replace(/^[-*]\s+/, '')} />
              </span>
            </div>
          )
        }

        const numbered = trimmed.match(/^(\d+)\.\s+(.*)$/)
        if (numbered) {
          return (
            <div key={index} className="flex gap-2">
              <span className="shrink-0 tabular-nums text-primary/70">
                {numbered[1]}.
              </span>
              <span>
                <Inline text={numbered[2]} />
              </span>
            </div>
          )
        }

        if (/^#{1,6}\s+/.test(trimmed)) {
          return (
            <p key={index} className="pt-1 font-semibold text-foreground">
              <Inline text={trimmed.replace(/^#{1,6}\s+/, '')} />
            </p>
          )
        }

        return (
          <p key={index}>
            <Inline text={trimmed} />
          </p>
        )
      })}
    </div>
  )
}

interface AskHeroProps {
  hasGroq: boolean
  className?: string
}

export default function AskHero({ hasGroq, className }: AskHeroProps) {
  const [question, setQuestion] = useState('')
  const [focused, setFocused] = useState(false)
  const [paused, setPaused] = useState(false)
  const [start, setStart] = useState(0)
  const ask = useMutation({ mutationFn: postAsk })
  const queryClient = useQueryClient()

  const playPop = useSound('pop')
  const playClick = useSound('click')
  const playChime = useSound('chime')
  const playThud = useSound('thud')
  const lastAnswer = useRef<AskResult | null>(null)
  const lastError = useRef(false)

  const mx = useMotionValue(-240)
  const my = useMotionValue(-240)
  const spotlight = useMotionTemplate`radial-gradient(340px circle at ${mx}px ${my}px, hsl(var(--primary) / 0.22), transparent 68%)`

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    mx.set(event.clientX - rect.left)
    my.set(event.clientY - rect.top)
  }

  useEffect(() => {
    if (ask.data && ask.data !== lastAnswer.current) {
      lastAnswer.current = ask.data
      playChime()
      if (ask.data.action) {
        queryClient.invalidateQueries({ queryKey: ['home'] })
        if (ask.data.action.kind === 'expense') {
          queryClient.invalidateQueries({ queryKey: ['money'] })
        }
        if (ask.data.action.kind === 'logged_habit') {
          queryClient.invalidateQueries({ queryKey: ['habits'] })
          if (ask.data.action.milestone) {
            celebrateHabitMilestone()
            toast.success(
              `🔥 ${ask.data.action.milestone}-day streak on ${ask.data.action.habit_name ?? 'your habit'}!`,
              { duration: 5000 }
            )
          }
        }
      }
    }
  }, [ask.data, playChime, queryClient])

  useEffect(() => {
    if (ask.isError && !lastError.current) playThud()
    lastError.current = ask.isError
  }, [ask.isError, playThud])

  useEffect(() => {
    if (paused || ask.isPending) return
    const timer = window.setInterval(() => {
      setStart((current) => (current + 1) % SUGGESTIONS.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [paused, ask.isPending])

  const submit = (text?: string) => {
    const q = (text ?? question).trim()
    if (!q || ask.isPending) return
    playPop()
    setQuestion(q)
    ask.mutate(q)
  }

  const suggestions = [0, 1, 2].map(
    (offset) => SUGGESTIONS[(start + offset) % SUGGESTIONS.length]
  )

  return (
    <MotionCard
      className={cn(className, 'ask-hero group relative overflow-hidden')}
      onMouseMove={handleMove}
      onMouseLeave={() => {
        mx.set(-240)
        my.set(-240)
      }}
    >
      {/* Cursor-following spotlight */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: spotlight }}
      />

      <div className="relative z-10 flex h-full flex-col p-6 md:p-7">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-primary/80">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
          Ask your context
        </div>

        <h2 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-foreground md:text-[28px]">
          Everything you know,{' '}
          <span className="gradient-text">one question away.</span>
        </h2>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          Search across your files, emails, calendar, spending and notes — in
          plain language.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="mt-5 flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <motion.span
              aria-hidden
              className="pointer-events-none absolute -inset-1 rounded-2xl bg-primary/15 blur-lg"
              animate={{ opacity: focused ? 1 : 0, scale: focused ? 1 : 0.96 }}
              transition={{ duration: 0.25 }}
            />
            <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              aria-label="Ask your context"
              placeholder={
                hasGroq
                  ? 'Ask anything about your context…'
                  : 'Type “did gym today” — or connect Groq in Settings…'
              }
              className="relative h-12 w-full rounded-xl border border-border bg-surface-inset pl-10 pr-4 text-sm text-foreground shadow-inner shadow-black/20 light:shadow-black/5 outline-none transition-all placeholder:text-muted-foreground/60 hover:border-border focus:border-primary/60 focus:bg-surface-inset focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <MagneticButton
            type="submit"
            disabled={!question.trim() || ask.isPending}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Ask"
          >
            {ask.isPending ? (
              <SpinnerArc className="border-primary-foreground/70" />
            ) : (
              <Zap className="h-4 w-4" strokeWidth={2} />
            )}
            Ask
            <ArrowRight className="h-3.5 w-3.5 opacity-70" />
          </MagneticButton>
        </form>

        <div
          className="mt-3 flex min-h-7 flex-wrap items-center gap-2"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {suggestions.map((s) => (
              <motion.button
                key={s}
                layout
                initial={{ opacity: 0, y: 4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={spring.gentle}
                type="button"
                onClick={() => {
                  playClick()
                  submit(s)
                }}
                disabled={!hasGroq || ask.isPending}
                className="rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
              >
                {s}
              </motion.button>
            ))}
          </AnimatePresence>
          {!hasGroq && (
            <span className="text-[11px] text-amber-400 light:text-amber-700">
              No Groq key connected — add one in Settings.
            </span>
          )}
        </div>

        <AnimatePresence mode="wait">
          {ask.isPending && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-4 space-y-2 rounded-xl border border-hairline bg-surface-inset px-4 py-3"
            >
              <div className="skeleton-shimmer h-2.5 w-4/5 rounded-full" />
              <div className="skeleton-shimmer h-2.5 w-full rounded-full" />
              <div className="skeleton-shimmer h-2.5 w-2/3 rounded-full" />
              <p className="flex items-center gap-1.5 pt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">
                <SpinnerArc className="h-2.5 w-2.5" /> Reading your context
              </p>
            </motion.div>
          )}

          {ask.isError && !ask.isPending && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs text-red-300 light:text-red-700"
            >
              {ask.error instanceof Error
                ? ask.error.message
                : 'Something went wrong — try again.'}
            </motion.div>
          )}

          {ask.data && !ask.isPending && (
            <motion.div
              key="answer"
              initial={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6 }}
              transition={spring.snappy}
              className="mt-4 rounded-xl border border-primary/20 bg-surface-inset p-4 backdrop-blur-sm"
            >
              {ask.data.action && (
                <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-medium text-emerald-500 light:text-emerald-700">
                  <Check className="h-2.5 w-2.5" />
                  {ask.data.action.kind === 'logged_habit'
                    ? 'Saved to Habits'
                    : 'Saved to your data'}
                </span>
              )}
              <AnswerBody text={ask.data.answer} />
              {ask.data.sources?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-hairline pt-3">
                  {ask.data.sources.slice(0, 6).map((source, i) => (
                    <span
                      key={`${source.title}-${i}`}
                      className="inline-flex max-w-[240px] items-center gap-1 truncate rounded-md border border-hairline bg-surface-2 px-1.5 py-1 text-[10px] text-muted-foreground"
                    >
                      <FileText className="h-2.5 w-2.5 shrink-0 text-primary/70" />
                      <span className="truncate">{source.title}</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionCard>
  )
}
