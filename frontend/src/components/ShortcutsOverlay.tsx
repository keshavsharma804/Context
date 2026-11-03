import { AnimatePresence, motion } from 'motion/react'
import { Keyboard, X } from 'lucide-react'
import { spring } from '@/lib/animations'

interface ShortcutRow {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  title: string
  rows: ShortcutRow[]
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    rows: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'M'], description: 'Go to Money' },
      { keys: ['G', 'P'], description: 'Go to People' },
      { keys: ['G', 'C'], description: 'Go to Calendar' },
      { keys: ['G', 'E'], description: 'Go to Email' },
      { keys: ['G', 'J'], description: 'Go to Jobs' },
      { keys: ['G', 'F'], description: 'Go to Files' },
      { keys: ['G', 'S'], description: 'Go to Settings' },
    ],
  },
  {
    title: 'Actions',
    rows: [
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['?'], description: 'Show this overlay' },
      { keys: ['Esc'], description: 'Close any dialog' },
    ],
  },
  {
    title: 'Ask',
    rows: [
      { keys: ['⌘', 'J'], description: 'Open floating Ask' },
      { keys: ['Esc'], description: 'Collapse Ask' },
      { keys: ['↵'], description: 'Send a question' },
    ],
  },
]

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((key) => (
        <kbd
          key={key}
          className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border/70 bg-surface-2 px-1.5 font-sans text-[10px] font-medium text-foreground/80 shadow-sm"
        >
          {key}
        </kbd>
      ))}
    </span>
  )
}

export default function ShortcutsOverlay({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.button
            aria-label="Close shortcuts"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={spring.snappy}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-start justify-between border-b border-border/70 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Keyboard className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-[14px] font-semibold text-foreground">
                    Keyboard shortcuts
                  </h2>
                  <p className="text-[10.5px] text-muted-foreground/60">
                    Press G, then a letter within one second.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-3">
              {GROUPS.map((group) => (
                <section key={group.title}>
                  <h3 className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/45">
                    {group.title}
                  </h3>
                  <div className="space-y-1">
                    {group.rows.map((row) => (
                      <div
                        key={`${group.title}-${row.description}`}
                        className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface-2"
                      >
                        <span className="text-[11px] text-muted-foreground">
                          {row.description}
                        </span>
                        <Keys keys={row.keys} />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="border-t border-border/70 px-5 py-2.5 text-[9.5px] text-muted-foreground/45">
              Tip: the floating Ask follows you across every page.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
