import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowUp,
  Check,
  GripHorizontal,
  Minus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { postAsk } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useSound } from '@/hooks/useSound'
import { useAskStore, type AskMessage } from '@/store/ask'
import { celebrateHabitMilestone } from '@/lib/celebrate'
import { toast } from 'sonner'
import { AnswerBody } from '@/components/dashboard/AskHero'

type Mode = 'closed' | 'input' | 'chat'

const POSITION_KEY = 'context:ask-position'
const PANEL_WIDTH = 400
const PANEL_HEIGHT = 600

const SUGGESTIONS = {
  money: [
    'How much did I spend this week?',
    "What's my food budget?",
    'Biggest purchase?',
  ],
  people: [
    'Who should I reach out to?',
    'Any upcoming birthdays?',
    'Who have I not talked to in a while?',
  ],
  calendar: ["What's today?", 'Any collisions?', 'Next event?'],
  home: ['What did I spend?', 'What patterns?', "What's due today?"],
  general: ['What did I spend?', 'What patterns?', "What's due today?"],
}

function suggestionsFor(pathname: string): string[] {
  if (pathname.startsWith('/money')) return SUGGESTIONS.money
  if (pathname.startsWith('/people')) return SUGGESTIONS.people
  if (pathname.startsWith('/calendar')) return SUGGESTIONS.calendar
  if (pathname === '/') return SUGGESTIONS.home
  return SUGGESTIONS.general
}

function loadPosition(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { x?: number; y?: number }
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return { x: parsed.x, y: parsed.y }
    }
  } catch {
    // ignore malformed storage
  }
  return null
}

function clampPosition(
  position: { x: number; y: number },
  width = PANEL_WIDTH,
  height = PANEL_HEIGHT
) {
  const maxX = Math.max(8, window.innerWidth - width - 8)
  const maxY = Math.max(8, window.innerHeight - height - 8)
  return {
    x: Math.min(Math.max(8, position.x), maxX),
    y: Math.min(Math.max(8, position.y), maxY),
  }
}

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const sync = () => setMobile(query.matches)
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return mobile
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-0.5" aria-label="Thinking">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-primary/70"
          animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: index * 0.14,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  )
}

function MessageBubble({ message }: { message: AskMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[90%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed',
          isUser
            ? 'rounded-br-md border border-primary/25 bg-primary/15 text-foreground'
            : message.error
              ? 'rounded-bl-md border border-red-500/25 bg-red-500/10 text-red-500 light:text-red-600'
              : 'rounded-bl-md border border-border/60 bg-card/80 text-foreground/90'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : message.content ? (
          <AnswerBody text={message.content} />
        ) : (
          <TypingDots />
        )}
      </div>

      {message.role === 'assistant' && message.saved && (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-medium text-emerald-500 light:text-emerald-700">
          <Check className="h-2.5 w-2.5" />
          {message.savedLabel ?? 'Saved to your data'}
        </span>
      )}

      {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {message.sources.slice(0, 6).map((source, index) => (
            <span
              key={`${source.title}-${index}`}
              className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border border-border/60 bg-surface-1 px-2 py-0.5 text-[9.5px] text-muted-foreground"
              title={`${source.type}: ${source.title}`}
            >
              <span className="h-1 w-1 shrink-0 rounded-full bg-primary/60" />
              <span className="truncate">{source.title}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FloatingAsk() {
  const { pathname } = useLocation()
  const isMobile = useIsMobile()
  const reduced = useReducedMotion()
  const queryClient = useQueryClient()
  const messages = useAskStore((state) => state.messages)
  const addMessage = useAskStore((state) => state.addMessage)
  const updateMessage = useAskStore((state) => state.updateMessage)
  const clear = useAskStore((state) => state.clear)

  const playPop = useSound('pop')
  const playChime = useSound('chime')
  const playThud = useSound('thud')

  const [mode, setMode] = useState<Mode>('closed')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [position, setPosition] = useState(loadPosition)
  const [dragging, setDragging] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
  }))

  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const streamTimer = useRef<number | null>(null)
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null)
  const dragStartPoint = useRef<{ x: number; y: number } | null>(null)
  const draggedRef = useRef(false)
  const lastDragEnd = useRef(0)
  const dragCleanup = useRef<(() => void) | null>(null)
  const confirmTimer = useRef<number | null>(null)

  const suggestions = suggestionsFor(pathname)
  const isOpen = mode !== 'closed'

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
      setPosition((current) =>
        current
          ? clampPosition(
              current,
              mode === 'closed' ? 56 : PANEL_WIDTH,
              mode === 'closed' ? 56 : mode === 'chat' ? PANEL_HEIGHT : 240
            )
          : current
      )
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mode])

  useEffect(() => {
    if (!position || isMobile) return
    setPosition((current) =>
      current
        ? clampPosition(
            current,
            mode === 'closed' ? 56 : PANEL_WIDTH,
            mode === 'closed' ? 56 : mode === 'chat' ? PANEL_HEIGHT : 240
          )
        : current
    )
  }, [mode, isMobile])

  useEffect(() => {
    const toggle = () => {
      setMode((current) => (current === 'closed' ? 'chat' : 'closed'))
    }
    const escape = () => {
      setMode('closed')
      setConfirmClear(false)
    }
    window.addEventListener('context:toggle-ask', toggle)
    window.addEventListener('context:escape', escape)
    return () => {
      window.removeEventListener('context:toggle-ask', toggle)
      window.removeEventListener('context:escape', escape)
    }
  }, [])

  useEffect(() => {
    if (mode === 'closed') return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 140)
    return () => window.clearTimeout(timer)
  }, [mode])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, busy])

  useEffect(
    () => () => {
      if (streamTimer.current) window.clearInterval(streamTimer.current)
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
      dragCleanup.current?.()
    },
    []
  )

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return
      setMode('closed')
      setConfirmClear(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMode('closed')
        setConfirmClear(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const openInput = () => {
    // A real drag ends with a click on the FAB. Ignore only that click, and
    // let the next deliberate click open the panel.
    if (Date.now() - lastDragEnd.current < 350) return
    playPop()
    setMode((current) => (current === 'closed' ? 'input' : current))
  }

  const send = async (text?: string) => {
    const question = (text ?? draft).trim()
    if (!question || busy) return
    playPop()
    setDraft('')
    setMode('chat')
    setBusy(true)

    addMessage({ role: 'user', content: question })
    const answerId = addMessage({ role: 'assistant', content: '' })

    try {
      const result = await postAsk(question)
      const answer = (result.answer ?? '').trim() || 'I could not find anything for that.'
      const sources = result.sources ?? []
      const saved = Boolean(result.action)
      const savedLabel =
        result.action?.kind === 'logged_habit'
          ? 'Saved to Habits'
          : result.action?.kind === 'debt'
          ? 'Saved to Debts & IOUs'
          : result.action?.kind === 'subscription'
          ? 'Saved to Subscriptions'
          : result.action?.kind === 'note'
          ? 'Saved to Notes'
          : result.action?.kind === 'contact'
          ? 'Updated Contact'
          : result.action
            ? 'Saved to your data'
            : undefined

      if (result.action) {
        queryClient.invalidateQueries({ queryKey: ['home'] })
        if (result.action.kind === 'expense') {
          queryClient.invalidateQueries({ queryKey: ['money'] })
          queryClient.invalidateQueries({ queryKey: ['money-summary'] })
        }
        if (result.action.kind === 'debt') {
          queryClient.invalidateQueries({ queryKey: ['debts'] })
        }
        if (result.action.kind === 'subscription') {
          queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
        }
        if (result.action.kind === 'contact') {
          queryClient.invalidateQueries({ queryKey: ['people'] })
        }
        if (result.action.kind === 'logged_habit') {
          queryClient.invalidateQueries({ queryKey: ['habits'] })
          if (result.action.milestone) {
            celebrateHabitMilestone()
            toast.success(
              `🔥 ${result.action.milestone}-day streak on ${result.action.habit_name ?? 'your habit'}!`,
              { duration: 5000 }
            )
          }
        }
      }

      if (reduced) {
        updateMessage(answerId, { content: answer, sources, saved, savedLabel }, true)
        setBusy(false)
        playChime()
        return
      }

      let index = 0
      streamTimer.current = window.setInterval(() => {
        index += 1
        updateMessage(answerId, { content: answer.slice(0, index) })
        if (index >= answer.length) {
          if (streamTimer.current) window.clearInterval(streamTimer.current)
          streamTimer.current = null
          updateMessage(answerId, { content: answer, sources, saved, savedLabel }, true)
          setBusy(false)
          playChime()
        }
      }, 5)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not reach the model. Try again.'
      updateMessage(answerId, { content: message, error: true }, true)
      setBusy(false)
      playThud()
    }
  }

  const requestClear = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
      confirmTimer.current = window.setTimeout(() => setConfirmClear(false), 3000)
      return
    }
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
    setConfirmClear(false)
    clear()
    playThud()
  }

  const handleDragStart = (
    event: React.PointerEvent<HTMLDivElement>,
    allowButton = false
  ) => {
    // The closed orb is draggable on every viewport. The full-screen mobile
    // sheet keeps its bottom-sheet layout.
    if (isMobile && mode !== 'closed') return
    draggedRef.current = false
    dragStartPoint.current = { x: event.clientX, y: event.clientY }
    if (!allowButton && (event.target as HTMLElement).closest('button')) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    dragOffset.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top }
    setDragging(true)

    // Track the drag on `window` rather than using pointer capture on the
    // wrapper: capture retargets the follow-up `click`, so the FAB's own
    // onClick would never fire. Window listeners keep the click on the button
    // and still deliver pointer moves once the cursor leaves the element.
    const handleMove = (moveEvent: PointerEvent) => handleDragMove(moveEvent)
    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
      dragCleanup.current = null
    }
    const handleUp = () => {
      cleanup()
      handleDragEnd()
    }
    dragCleanup.current?.()
    dragCleanup.current = cleanup
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
  }

  const handleDragMove = (event: { clientX: number; clientY: number }) => {
    if (!dragOffset.current || !dragStartPoint.current) return
    if (!draggedRef.current) {
      const moved = Math.hypot(
        event.clientX - dragStartPoint.current.x,
        event.clientY - dragStartPoint.current.y
      )
      if (moved < 4) return
      draggedRef.current = true
    }
    setPosition(
      clampPosition(
        {
          x: event.clientX - dragOffset.current.dx,
          y: event.clientY - dragOffset.current.dy,
        },
        mode === 'closed' ? 56 : PANEL_WIDTH,
        mode === 'closed' ? 56 : mode === 'chat' ? PANEL_HEIGHT : 240
      )
    )
  }

  const handleDragEnd = () => {
    dragCleanup.current?.()
    if (!dragOffset.current) return
    if (draggedRef.current) lastDragEnd.current = Date.now()
    draggedRef.current = false
    dragOffset.current = null
    dragStartPoint.current = null
    setDragging(false)
    setPosition((current) => {
      if (current) {
        try {
          localStorage.setItem(POSITION_KEY, JSON.stringify(current))
        } catch {
          // ignore
        }
      }
      return current
    })
  }

  const width = mode === 'closed' ? 56 : PANEL_WIDTH
  const height =
    mode === 'chat' ? Math.min(PANEL_HEIGHT, viewport.height - 48) : undefined

  const panelStyle: CSSProperties = isMobile
    ? mode === 'closed'
      ? position
        ? { left: position.x, top: position.y, width: 56, height: 56 }
        : { right: 16, bottom: 16, width: 56, height: 56 }
      : {}
    : position
      ? { left: position.x, top: position.y, width, ...(height ? { height } : {}) }
      : { right: 24, bottom: 24, width, ...(height ? { height } : {}) }

  return (
    <div className="pointer-events-none fixed inset-0 z-40" aria-live="polite">
      <AnimatePresence>
        {isMobile && isOpen && (
          <motion.button
            key="ask-backdrop"
            aria-label="Close ask"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setMode('closed')}
            className="pointer-events-auto absolute inset-0 bg-black/55 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <motion.div
        ref={panelRef}
        style={panelStyle}
        className={cn(
          'pointer-events-auto absolute flex flex-col border-border bg-popover/95 shadow-2xl backdrop-blur-2xl',
          !dragging && 'transition-[width,height] duration-200 ease-out',
          mode === 'closed'
            ? 'overflow-visible rounded-full border-0 bg-transparent shadow-none'
            : 'overflow-hidden rounded-2xl border',
          isMobile && mode === 'chat' && 'inset-0 h-dvh w-full rounded-none border-0',
          isMobile &&
            mode === 'input' &&
            'inset-x-0 bottom-0 w-full rounded-b-none rounded-t-2xl border-x-0 border-b-0'
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'closed' && (
            <motion.div
              key="closed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.12 }}
              onPointerDown={(event) => handleDragStart(event, true)}
              className={cn(
                'h-full w-full',
                !isMobile && 'cursor-grab touch-none active:cursor-grabbing'
              )}
            >
              <button
                type="button"
                onClick={openInput}
                aria-label="Ask Context"
                title="Ask Context · ⌘J — drag to move"
                className="group relative flex h-14 w-14 cursor-grab items-center justify-center rounded-full text-primary-foreground shadow-lg outline-none transition-transform duration-200 hover:scale-[1.08] active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                style={{
                  background:
                    'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--theme-accent)) 100%)',
                  boxShadow: '0 12px 34px -10px var(--theme-glow)',
                }}
              >
                <span aria-hidden className="fab-pulse absolute inset-0 rounded-full bg-primary/45" />
                <Sparkles className="relative h-5 w-5" strokeWidth={2} />
                {messages.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[8px] font-bold text-primary-foreground">
                    {messages.length > 9 ? '9+' : messages.length}
                  </span>
                )}
              </button>
            </motion.div>
          )}

          {mode === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.15 }}
              className="p-2"
            >
              {!isMobile && (
                <div
                  onPointerDown={handleDragStart}
                  title="Drag to move"
                  className="mb-1.5 flex cursor-grab touch-none select-none items-center gap-1.5 px-1 pb-1 active:cursor-grabbing"
                >
                  <GripHorizontal className="h-3 w-3 text-muted-foreground/35" />
                  <span className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/50">
                    Ask Context
                  </span>
                </div>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  send()
                }}
                className="flex h-12 items-center gap-2 rounded-xl border border-border/70 bg-surface-inset px-3"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      setMode('closed')
                    }
                  }}
                  placeholder="Ask or capture: 'spent 40 on chai', 'lent 500 to Alex', 'note: ...'"
                  aria-label="Ask anything"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/55"
                />
                <button
                  type="submit"
                  aria-label="Send question"
                  disabled={!draft.trim()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-2 flex flex-wrap gap-1.5 px-0.5 pb-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-full border border-border/70 bg-surface-1 px-2.5 py-1 text-[10.5px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/[0.06] hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {mode === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.15 }}
              className="flex h-full min-h-0 flex-col"
            >
              <div
                onPointerDown={handleDragStart}
                title={isMobile ? undefined : 'Drag to move'}
                className={cn(
                  'flex shrink-0 select-none items-center gap-2 border-b border-border/60 px-3 py-2.5',
                  isMobile ? 'cursor-default' : 'cursor-grab touch-none active:cursor-grabbing'
                )}
              >
                {!isMobile && (
                  <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground/35" />
                )}
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold leading-none text-foreground">
                    Ask Context
                  </p>
                  <p className="mt-0.5 truncate text-[9.5px] text-muted-foreground/55">
                    {pathname === '/' ? 'your whole context' : pathname.replace('/', '')}
                  </p>
                </div>

                <div className="ml-auto flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={requestClear}
                    aria-label={confirmClear ? 'Confirm clear history' : 'Clear history'}
                    title={confirmClear ? 'Click again to clear' : 'Clear history'}
                    className={cn(
                      'flex h-7 items-center justify-center rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground',
                      confirmClear && 'w-auto gap-1 text-red-400 light:text-red-600'
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {confirmClear && <span className="text-[9px] font-semibold">Sure?</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('input')}
                    aria-label="Minimize"
                    title="Minimize"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('closed')}
                    aria-label="Close"
                    title="Close"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div ref={scrollRef} className="ask-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-3 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Sparkles className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-[13px] font-medium text-foreground">
                        Ask anything about your context
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/60">
                        Files, email, money, people and plans — answered from your own data.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => send(suggestion)}
                          className="rounded-full border border-border/70 bg-surface-1 px-2.5 py-1 text-[10.5px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/[0.06] hover:text-foreground"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))
                )}
              </div>

              <div className="shrink-0 border-t border-border/60 bg-popover/80 p-2">
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    send()
                  }}
                  className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface-inset px-3 py-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15"
                >
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        setMode('closed')
                      }
                    }}
                    placeholder={busy ? 'Answering…' : 'Ask a follow-up…'}
                    aria-label="Ask a follow-up"
                    disabled={busy}
                    className="min-w-0 flex-1 bg-transparent py-1 text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground/55 disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || busy}
                    aria-label="Send"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-35"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                </form>

                {messages.length > 0 && !busy && (
                  <div className="mt-1.5 flex flex-wrap gap-1 px-0.5">
                    {suggestions.slice(0, 3).map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => send(suggestion)}
                        className="rounded-full px-2 py-0.5 text-[9.5px] text-muted-foreground/60 transition-colors hover:bg-surface-2 hover:text-foreground"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
