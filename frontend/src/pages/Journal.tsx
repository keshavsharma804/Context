import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import {
  BookOpen,
  Calendar,
  Flame,
  Sparkles,
  Save,
  Trash2,
  Tag,
  ChevronLeft,
  ChevronRight,
  Smile,
  Frown,
  Meh,
  Sun,
  CloudRain,
  Heart,
  Quote,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchJournal,
  postJournalSave,
  deleteJournalEntry,
  type JournalEntry,
  type MoodDay,
} from '@/lib/api'
import { PageHeader, EmptyCommand, ErrorPanel } from '@/components/pages/PageChrome'
import { CountUp } from '@/components/motion/CountUp'
import { cn } from '@/lib/utils'
import { useSound } from '@/hooks/useSound'

const MOODS = [
  { level: 1, label: 'Awful', emoji: '😫', color: '#ef4444', desc: 'Draining, difficult' },
  { level: 2, label: 'Low', emoji: '🙁', color: '#f97316', desc: 'Sluggish, uneasy' },
  { level: 3, label: 'Neutral', emoji: '😐', color: '#eab308', desc: 'Balanced, standard' },
  { level: 4, label: 'Good', emoji: '🙂', color: '#10b981', desc: 'Upbeat, productive' },
  { level: 5, label: 'Radiant', emoji: '🤩', color: '#8b5cf6', desc: 'Thriving, energized' },
]

const QUICK_TAGS = ['productive', 'coding', 'health', 'reading', 'family', 'creative', 'rest', 'focus']

export default function Journal() {
  const queryClient = useQueryClient()
  const playClick = useSound('click')
  const playChime = useSound('chime')

  const todayIso = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(todayIso)

  // Editor states
  const [mood, setMood] = useState(4)
  const [headline, setHeadline] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [customTag, setCustomTag] = useState('')

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['journal'],
    queryFn: () => fetchJournal(30),
  })

  const matrix = data?.matrix
  const entries = data?.entries ?? []

  // Load selected date entry if exists
  useEffect(() => {
    const existing = entries.find((e) => e.date === selectedDate)
    if (existing) {
      setMood(existing.mood)
      setHeadline(existing.headline || '')
      setContent(existing.content || '')
      setTags(existing.tags_list || [])
    } else {
      setMood(3)
      setHeadline('')
      setContent('')
      setTags([])
    }
  }, [selectedDate, entries])

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: (payload: { date: string; mood: number; headline: string; content: string; tags: string[] }) =>
      postJournalSave(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['journal'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      toast.success(`Saved journal for ${res.entry.date}!`)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save reflection')
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (dateStr: string) => deleteJournalEntry(dateStr),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] })
      toast.success('Journal entry deleted')
    },
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate({
      date: selectedDate,
      mood,
      headline: headline.trim(),
      content: content.trim(),
      tags,
    })
  }

  const toggleTag = (tag: string) => {
    playClick()
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleAddCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customTag.trim()) {
      e.preventDefault()
      const t = customTag.trim().toLowerCase()
      if (!tags.includes(t)) {
        setTags([...tags, t])
      }
      setCustomTag('')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={BookOpen}
        eyebrow="Mindfulness & Tracking"
        title="Daily Journal & Mood Matrix"
        subtitle={
          matrix
            ? `${matrix.entries_count} of 30 days recorded · ${matrix.streak} day streak · Avg mood: ${matrix.average_mood}/5`
            : 'Capture daily reflections, track emotional states, and visualize mental momentum'
        }
      />

      {isError && (
        <div className="mt-6">
          <ErrorPanel error={error as Error} onRetry={() => refetch()} />
        </div>
      )}

      {/* Mood Heatmap Matrix */}
      {matrix && (
        <div className="mt-6 rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                30-Day Mood Matrix
              </h3>
              <p className="text-xs text-muted-foreground">
                Hover or click any day to view or record that day's reflection
              </p>
            </div>

            {/* Quick Legend */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>Low</span>
              <div className="flex items-center gap-1">
                {MOODS.map((m) => (
                  <span
                    key={m.level}
                    className="h-3 w-3 rounded-md shadow-sm"
                    style={{ backgroundColor: m.color }}
                    title={`${m.level} - ${m.label}`}
                  />
                ))}
              </div>
              <span>Radiant</span>
            </div>
          </div>

          {/* Matrix Grid */}
          <div className="mt-6 flex flex-wrap gap-2">
            {matrix.matrix.map((day) => {
              const isSelected = day.date === selectedDate
              const isToday = day.date === todayIso
              const moodObj = day.mood ? MOODS.find((m) => m.level === day.mood) : null

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => {
                    playClick()
                    setSelectedDate(day.date)
                  }}
                  className={cn(
                    'group relative flex h-14 w-12 flex-col items-center justify-between rounded-xl p-1.5 transition-all',
                    isSelected
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
                      : 'hover:scale-105',
                    day.has_entry
                      ? 'shadow-sm'
                      : 'border border-dashed border-border/60 bg-surface-1/40 hover:border-primary/50'
                  )}
                  style={{
                    backgroundColor: moodObj ? `${moodObj.color}22` : undefined,
                    borderColor: moodObj ? moodObj.color : undefined,
                  }}
                >
                  <span className="text-[9px] font-medium text-muted-foreground/80 uppercase">
                    {day.day_of_week}
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {day.day_number}
                  </span>
                  <span className="text-xs leading-none">
                    {day.mood_emoji || (isToday ? '✏️' : '·')}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Stat Pills */}
          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-hairline pt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Flame className="h-4 w-4 text-amber-500" />
              {matrix.streak} Day Streak
            </span>
            <span>·</span>
            <span>
              Average Score: <strong className="text-foreground">{matrix.average_mood} / 5.0</strong>
            </span>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <span>Top tags:</span>
              {matrix.top_tags.map((t) => (
                <span
                  key={t.tag}
                  className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-foreground font-medium"
                >
                  #{t.tag} ({t.count})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout: Reflection Editor & Past Log */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Reflection Form */}
        <div className="lg:col-span-7">
          <form
            onSubmit={handleSave}
            className="rounded-2xl border border-border/70 bg-card/70 p-6 backdrop-blur-xl shadow-sm space-y-6"
          >
            {/* Date bar */}
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {new Date(selectedDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                {selectedDate === todayIso && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    Today
                  </span>
                )}
              </div>

              {/* Date switchers */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(selectedDate)
                    d.setDate(d.getDate() - 1)
                    setSelectedDate(d.toISOString().slice(0, 10))
                  }}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
                  title="Previous Day"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayIso)}
                  className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(selectedDate)
                    d.setDate(d.getDate() + 1)
                    setSelectedDate(d.toISOString().slice(0, 10))
                  }}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
                  title="Next Day"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 5-Point Mood Selector */}
            <div>
              <label className="text-xs font-semibold text-foreground">How was your day?</label>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {MOODS.map((m) => {
                  const active = mood === m.level
                  return (
                    <button
                      key={m.level}
                      type="button"
                      onClick={() => {
                        playClick()
                        setMood(m.level)
                      }}
                      className={cn(
                        'flex flex-col items-center justify-center rounded-xl p-3 transition-all',
                        active
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105 shadow-md'
                          : 'border border-border/60 bg-surface-1/40 hover:bg-surface-2/60 opacity-70 hover:opacity-100'
                      )}
                      style={{
                        backgroundColor: active ? `${m.color}25` : undefined,
                        borderColor: active ? m.color : undefined,
                      }}
                    >
                      <span className="text-2xl">{m.emoji}</span>
                      <span className="mt-1 text-[11px] font-semibold text-foreground">
                        {m.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Headline / Theme of the day */}
            <div>
              <label className="text-xs font-semibold text-foreground">
                One-Line Summary / Headline
              </label>
              <input
                type="text"
                placeholder="e.g. Cleared my backlog, great evening walk, feeling calm"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border/80 bg-surface-1 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
              />
            </div>

            {/* Reflection Text Area */}
            <div>
              <label className="text-xs font-semibold text-foreground">
                Daily Reflection & Thoughts
              </label>
              <textarea
                rows={5}
                placeholder="What went well today? What drained your energy? What are you grateful for?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border/80 bg-surface-1 p-3.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none leading-relaxed"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-semibold text-foreground">Tags & Context</label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_TAGS.map((t) => {
                  const active = tags.includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-medium transition',
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'border border-border/60 bg-surface-2/60 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      #{t}
                    </button>
                  )
                })}
              </div>
              <input
                type="text"
                placeholder="Add custom tag (press Enter)..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={handleAddCustomTag}
                className="mt-2 w-full max-w-xs rounded-lg border border-border/70 bg-surface-1/60 px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-hairline pt-4">
              {entries.some((e) => e.date === selectedDate) ? (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Delete this journal entry?')) {
                      deleteMutation.mutate(selectedDate)
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 transition"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              ) : (
                <span />
              )}

              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'Saving...' : 'Save Reflection'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Recent Entries Timeline */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Recent Reflections</h3>

          {entries.length === 0 ? (
            <EmptyCommand
              icon={BookOpen}
              title="No journal entries yet"
              hint="Record your thoughts today using the editor on the left or type 'note: ...' in quick capture."
            />
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => {
                const moodObj = MOODS.find((m) => m.level === entry.mood)
                const isSelected = entry.date === selectedDate

                return (
                  <motion.div
                    key={entry.id}
                    onClick={() => {
                      playClick()
                      setSelectedDate(entry.date)
                    }}
                    className={cn(
                      'cursor-pointer rounded-2xl border p-4 backdrop-blur-xl transition shadow-sm hover:shadow-md',
                      isSelected
                        ? 'border-primary/60 bg-card/90 ring-1 ring-primary'
                        : 'border-border/70 bg-card/50 hover:border-primary/40'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{entry.mood_emoji}</span>
                        <div>
                          <span className="text-xs font-semibold text-foreground">
                            {new Date(entry.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="ml-2 text-[10px] text-muted-foreground capitalize">
                            · {entry.mood_label}
                          </span>
                        </div>
                      </div>

                      {entry.tags_list.length > 0 && (
                        <div className="flex items-center gap-1">
                          {entry.tags_list.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] text-muted-foreground font-medium"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {entry.headline && (
                      <h4 className="mt-2 text-xs font-semibold text-foreground line-clamp-1">
                        {entry.headline}
                      </h4>
                    )}

                    {entry.content && (
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {entry.content}
                      </p>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
