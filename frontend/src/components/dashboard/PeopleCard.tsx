import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { Cake, Send, Users } from 'lucide-react'
import {
  postPersonContacted,
  type PeopleBrief,
} from '@/lib/api'
import { initials } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import CardHeading from './CardHeading'
import { MotionCard } from './MotionCard'
import { itemEnter, staggerContainer } from '@/lib/animations'
import { useSound } from '@/hooks/useSound'
import { cn } from '@/lib/utils'

const EMPTY: PeopleBrief = {
  total: 0,
  upcoming_birthdays: [],
  needing_contact: [],
}

interface PeopleCardProps {
  people?: PeopleBrief
  className?: string
}

export default function PeopleCard({
  people = EMPTY,
  className,
}: PeopleCardProps) {
  const queryClient = useQueryClient()
  const playClick = useSound('click')
  const contacted = useMutation({
    mutationFn: postPersonContacted,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home'] })
      toast.success('Marked as contacted')
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not update'),
  })

  const birthdays = people.upcoming_birthdays ?? []
  const reachOut = people.needing_contact ?? []

  return (
    <MotionCard className={className}>
      <CardHeading
        icon={Users}
        title="People"
        subtitle={`${people.total} ${
          people.total === 1 ? 'person' : 'people'
        } in your orbit`}
      />

      <div className="mt-4 grid flex-1 grid-cols-1 divide-y divide-hairline px-5 pb-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:gap-5">
        {/* Birthdays */}
        <section className="pb-4 sm:pb-0">
          <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            <Cake className="h-3 w-3" />
            Upcoming birthdays
          </div>
          {birthdays.length === 0 ? (
            <p className="py-3 text-[11px] leading-relaxed text-muted-foreground/60">
              No birthdays in the next 30 days.
            </p>
          ) : (
            <motion.ul
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="space-y-2"
            >
              {birthdays.map((birthday) => {
                const soon = birthday.in_days <= 3
                return (
                  <motion.li
                    variants={itemEnter}
                    key={birthday.name}
                    className="group relative flex items-center gap-2.5 overflow-hidden rounded-lg border border-transparent px-1.5 py-1.5 transition-colors hover:border-hairline"
                  >
                    <span className="absolute inset-0 origin-left scale-x-0 bg-surface-2 transition-transform duration-200 ease-out group-hover:scale-x-100" />
                    <span
                      className={cn(
                        'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 text-fuchsia-300 ring-1 ring-inset ring-fuchsia-400/20 transition-transform duration-200 group-hover:scale-[1.08] light:text-fuchsia-700',
                        soon && 'birthday-glow ring-amber-400/40'
                      )}
                    >
                      <motion.span
                        animate={{ y: [0, -1.5, 0] }}
                        transition={{
                          duration: 2.2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: (birthday.in_days % 3) * 0.2,
                        }}
                      >
                        <Cake className="h-3.5 w-3.5" strokeWidth={1.7} />
                      </motion.span>
                    </span>
                    <div className="relative min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-foreground/90">
                        {birthday.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {birthday.birthday}
                      </p>
                    </div>
                    <Badge
                      variant="default"
                      className={cn(
                        'relative shrink-0',
                        soon && 'bg-amber-500/15 text-amber-500'
                      )}
                    >
                      {birthday.in_days === 0
                        ? 'Today'
                        : `in ${birthday.in_days}d`}
                    </Badge>
                  </motion.li>
                )
              })}
            </motion.ul>
          )}
        </section>

        {/* Reach out */}
        <section className="pt-4 sm:pt-0 sm:pl-5">
          <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            <Send className="h-3 w-3" />
            Reach out
          </div>
          {reachOut.length === 0 ? (
            <p className="py-3 text-[11px] leading-relaxed text-muted-foreground/60">
              You&apos;re up to date with everyone.
            </p>
          ) : (
            <motion.ul
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="space-y-2"
            >
              {reachOut.map((person) => (
                <motion.li
                  variants={itemEnter}
                  key={person.name}
                  className="group relative flex items-center gap-2.5 overflow-hidden rounded-lg border border-transparent px-1.5 py-1.5 transition-colors hover:border-hairline"
                >
                  <span className="absolute inset-0 origin-left scale-x-0 bg-surface-2 transition-transform duration-200 ease-out group-hover:scale-x-100" />
                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary ring-1 ring-inset ring-primary/20 transition-transform duration-200 group-hover:scale-[1.08]">
                    {initials(person.name)}
                  </span>
                  <div className="relative min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-foreground/90">
                      {person.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      last spoke {person.days_since}d ago
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Mark ${person.name} as contacted`}
                    onClick={() => {
                      playClick()
                      contacted.mutate(person.name)
                    }}
                    disabled={contacted.isPending}
                    className="relative rounded-md p-1 text-muted-foreground/40 opacity-0 transition-all hover:bg-primary/10 hover:text-primary group-hover:opacity-100 disabled:opacity-30"
                  >
                    <Send className="h-3 w-3" />
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </section>
      </div>
    </MotionCard>
  )
}
