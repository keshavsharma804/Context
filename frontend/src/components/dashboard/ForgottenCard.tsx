import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { EyeOff, FileQuestion, FileText } from 'lucide-react'
import { postIgnore, type ForgottenFile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import CardHeading from './CardHeading'
import { MotionCard } from './MotionCard'
import { itemEnter, spring, staggerContainer } from '@/lib/animations'
import { useSound } from '@/hooks/useSound'

function DrawnCheck() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.08]">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M5 12.5 10 17.5 19 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="check-path text-emerald-500"
        />
      </svg>
    </span>
  )
}

interface ForgottenCardProps {
  forgotten: ForgottenFile[]
  className?: string
}

export default function ForgottenCard({
  forgotten,
  className,
}: ForgottenCardProps) {
  const queryClient = useQueryClient()
  const playSwoosh = useSound('swoosh')
  const playThud = useSound('thud')
  const [hidden, setHidden] = useState<string[]>([])

  const visible = forgotten.filter((file) => !hidden.includes(file.path))

  const ignore = useMutation({
    mutationFn: postIgnore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home'] })
      toast.success('File ignored')
    },
    onError: (error) => {
      playThud()
      toast.error(error instanceof Error ? error.message : 'Could not ignore')
    },
  })

  const handleIgnore = (path: string) => {
    playSwoosh()
    setHidden((current) => [...current, path])
    ignore.mutate(path, {
      onError: () => setHidden((current) => current.filter((item) => item !== path)),
    })
  }

  return (
    <MotionCard className={className}>
      <CardHeading
        icon={FileQuestion}
        title="You're forgetting"
        subtitle="Files that slipped through"
        action={
          visible.length > 0 ? (
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {visible.length}
            </span>
          ) : null
        }
      />

      {visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-4 py-8 text-center">
          <DrawnCheck />
          <p className="text-xs font-medium text-muted-foreground">
            Nothing forgotten today. Nice.
          </p>
          <p className="max-w-[26ch] text-[11px] leading-relaxed text-muted-foreground/60">
            Downloaded files you haven&apos;t opened will show up here.
          </p>
        </div>
      ) : (
        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="mt-4 flex-1 space-y-1.5 px-5 pb-5"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((file) => (
              <motion.li
                key={file.path}
                variants={itemEnter}
                layout
                exit={{ opacity: 0, height: 0, marginTop: 0, x: -10 }}
                transition={spring.gentle}
                className="group flex items-center gap-2.5 overflow-hidden rounded-lg border border-transparent px-1.5 py-2 transition-colors hover:border-hairline hover:bg-surface-2"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/[0.08] text-amber-400 ring-1 ring-inset ring-amber-500/10 light:text-amber-700">
                  <FileText className="h-3.5 w-3.5" strokeWidth={1.7} />
                </span>

                <div className="min-w-0 flex-1">
                  <p tabIndex={0}
                    className="truncate text-[12px] font-medium text-foreground/90"
                    data-ui-tooltip={file.name}
                  >
                    {file.name}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground/70">
                    {file.message || `${file.category} · unopened`}
                  </p>
                </div>

                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
                  {file.age_days}d
                </span>

                <Button
                  variant="ghost"
                  size="xs"
                  sound={false}
                  onClick={() => handleIgnore(file.path)}
                  disabled={ignore.isPending}
                  className="shrink-0 gap-1 text-muted-foreground/70 opacity-80 group-hover:text-foreground group-hover:opacity-100"
                >
                  <EyeOff className="h-3 w-3" />
                  Ignore
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </MotionCard>
  )
}
