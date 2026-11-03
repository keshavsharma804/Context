with open('frontend/src/pages/Calendar.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update DayActionModal props signature
target1 = """function DayActionModal({
  day,
  events,
  spends,
  debts,
  symbol,
  onClose,
}: {
  day: Date
  events: CalEvent[]
  spends: CalSpend[]
  debts: CalDebt[]
  symbol: string
  onClose: () => void
}) {"""

replacement1 = """function DayActionModal({
  day,
  events,
  spends,
  debts,
  applications = [],
  interviews = [],
  symbol,
  onClose,
}: {
  day: Date
  events: CalEvent[]
  spends: CalSpend[]
  debts: CalDebt[]
  applications?: JobApplication[]
  interviews?: { id?: number; company: string; scheduled_at: string; prep_docs?: any[] }[]
  symbol: string
  onClose: () => void
}) {"""

assert target1 in text, "Target 1 not found"
text = text.replace(target1, replacement1, 1)

# 2. Add job state and mutation to DayActionModal
target2 = """  const [activeTab, setActiveTab] = useState<'nlp' | 'event' | 'spend' | 'debt'>('nlp')"""
replacement2 = """  const [activeTab, setActiveTab] = useState<'nlp' | 'event' | 'spend' | 'debt' | 'job'>('nlp')

  // 4. Job Application State
  const [jobCompany, setJobCompany] = useState('')
  const [jobRole, setJobRole] = useState('')
  const [jobStatus, setJobStatus] = useState<string>('applied')
  const [jobInterviewTime, setJobInterviewTime] = useState('11:00')"""

assert target2 in text, "Target 2 not found"
text = text.replace(target2, replacement2, 1)

# 3. Add addJobMutation and handleJobSubmit
target3 = """  // Add Debt Mutation (Connects to /debts)"""
replacement3 = """  // Add Job Mutation (Connects to /jobs)
  const addJobMutation = useMutation({
    mutationFn: (payload: { company: string; role?: string; status?: string; interview_at?: string }) =>
      postJobAdd(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      playChime()
      toast.success(res.message || 'Job application logged!')
      setJobCompany('')
      setJobRole('')
      setNlpInput('')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to log job application')
    },
  })

  // Add Debt Mutation (Connects to /debts)"""

assert target3 in text, "Target 3 not found"
text = text.replace(target3, replacement3, 1)

# 4. Update handleAIFastSubmit for type === 'job'
target4 = """    } else if (nlpParsed.type === 'debt') {"""
replacement4 = """    } else if (nlpParsed.type === 'job') {
      if (!nlpParsed.company) {
        toast.error('Please specify company name e.g. "Applied Google"')
        return
      }
      addJobMutation.mutate({
        company: nlpParsed.company,
        role: nlpParsed.role || undefined,
        status: nlpParsed.status,
      })
    } else if (nlpParsed.type === 'debt') {"""

assert target4 in text, "Target 4 not found"
text = text.replace(target4, replacement4, 1)

# 5. Add handleJobSubmit handler
target5 = """  const handleDebtSubmit = (e: React.FormEvent) => {"""
replacement5 = """  const handleJobSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!jobCompany.trim()) {
      toast.error('Please enter company name')
      return
    }
    const interviewAt = jobStatus === 'interview' && jobInterviewTime ? `${dayStr}T${jobInterviewTime}` : undefined
    addJobMutation.mutate({
      company: jobCompany.trim(),
      role: jobRole.trim() || undefined,
      status: jobStatus,
      interview_at: interviewAt,
    })
  }

  const handleDebtSubmit = (e: React.FormEvent) => {"""

assert target5 in text, "Target 5 not found"
text = text.replace(target5, replacement5, 1)

# 6. Update header counts in DayActionModal
target6 = """{events.length} Events · {spends.length} Spends · {debts.length} Debts"""
replacement6 = """{events.length} Events · {spends.length} Spends · {debts.length} Debts · {applications.length + interviews.length} Jobs"""

assert target6 in text, "Target 6 not found"
text = text.replace(target6, replacement6, 1)

# 7. Update empty check in DayActionModal
target7 = """{events.length === 0 && spends.length === 0 && debts.length === 0 ? ("""
replacement7 = """{events.length === 0 && spends.length === 0 && debts.length === 0 && applications.length === 0 && interviews.length === 0 ? ("""

assert target7 in text, "Target 7 not found"
text = text.replace(target7, replacement7, 1)

# 8. Render jobs and interviews in Logged on this date
target8 = """                {/* Debts list (Lent / Borrowed) */}
                {debts.map((db) => (
                  <div
                    key={`db-${db.id}`}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-3 py-2 text-xs shadow-xs',
                      db.direction === 'lent'
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-blue-500/30 bg-blue-500/5'
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded',
                          db.direction === 'lent' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                        )}
                      >
                        <HandCoins className="h-3 w-3" />
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-foreground truncate">
                          {db.direction === 'lent' ? 'Lent to' : 'Borrowed from'} {db.person}
                        </p>
                        {db.notes && <p className="text-[10px] text-muted-foreground truncate italic">{db.notes}</p>}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'font-mono text-xs font-bold shrink-0 ml-2',
                        db.direction === 'lent' ? 'text-emerald-400' : 'text-blue-400'
                      )}
                    >
                      {db.direction === 'lent' ? '+' : '-'}{money(db.amount, symbol)}
                    </span>
                  </div>
                ))}"""

replacement8 = target8 + """

                {/* Job Applications list */}
                {applications.map((app) => (
                  <div
                    key={`job-app-${app.id || app.company}`}
                    className="flex items-center justify-between rounded-xl border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-500/20 text-violet-400">
                        <Briefcase className="h-3 w-3" />
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-foreground truncate">{app.company}</p>
                        <p className="text-[10px] text-violet-400 font-mono">
                          💼 {app.role || 'Application'} · <span className="capitalize">{app.status}</span>
                        </p>
                      </div>
                    </div>
                    <a
                      href="/jobs"
                      className="text-[10px] text-violet-400 hover:underline shrink-0 ml-2 font-medium"
                    >
                      Jobs ↗
                    </a>
                  </div>
                ))}

                {/* Scheduled Interviews list */}
                {interviews.map((int) => (
                  <div
                    key={`job-int-${int.id || int.company}`}
                    className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-500/20 text-amber-400">
                        <Clock className="h-3 w-3" />
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-foreground truncate">{int.company}</p>
                        <p className="text-[10px] text-amber-400 font-mono">
                          🎯 Interview at {int.scheduled_at.slice(11, 16) || int.scheduled_at}
                        </p>
                      </div>
                    </div>
                    <a
                      href="/jobs"
                      className="text-[10px] text-amber-300 hover:underline shrink-0 ml-2 font-semibold"
                    >
                      Prep ↗
                    </a>
                  </div>
                ))}"""

assert target8 in text, "Target 8 not found"
text = text.replace(target8, replacement8, 1)

# 9. Add Job tab button to Segmented Mode Selector
target9 = """                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setActiveTab('debt')
                  }}
                  className={cn(
                    'rounded-lg px-2 py-1 text-[11px] font-semibold transition',
                    activeTab === 'debt'
                      ? 'bg-emerald-500 text-black shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  🤝 IOU
                </button>"""

replacement9 = target9 + """
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setActiveTab('job')
                  }}
                  className={cn(
                    'rounded-lg px-2 py-1 text-[11px] font-semibold transition',
                    activeTab === 'job'
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  💼 Job / App
                </button>"""

assert target9 in text, "Target 9 not found"
text = text.replace(target9, replacement9, 1)

# 10. Add Job form in DayActionModal
target10 = """                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground">
                    🤝 Auto-syncs to your Debts & IOUs deck
                  </span>
                  <button
                    type="submit"
                    disabled={addDebtMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-black shadow-sm hover:bg-emerald-400 active:scale-95 transition disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Record IOU ↵</span>
                  </button>
                </div>
              </form>
            )}"""

replacement10 = target10 + """

            {/* Mode 4: Job Application / Interview Logging */}
            {activeTab === 'job' && (
              <form onSubmit={handleJobSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-foreground">Company Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Google, Stripe, Microsoft"
                      value={jobCompany}
                      onChange={(e) => setJobCompany(e.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-violet-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-foreground">Role / Position (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Frontend Engineer, SDE"
                      value={jobRole}
                      onChange={(e) => setJobRole(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-violet-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-foreground">Status</label>
                    <select
                      value={jobStatus}
                      onChange={(e) => setJobStatus(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs text-foreground focus:border-violet-400 focus:outline-none"
                    >
                      <option value="applied">Applied</option>
                      <option value="interview">Interview</option>
                      <option value="offered">Offered</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  {jobStatus === 'interview' && (
                    <div>
                      <label className="text-[11px] font-medium text-amber-400">Interview Time</label>
                      <input
                        type="time"
                        value={jobInterviewTime}
                        onChange={(e) => setJobInterviewTime(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-amber-500/40 bg-surface-2 px-3 py-2 text-xs text-foreground focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground">
                    💼 Auto-syncs across Calendar and Job Search board
                  </span>
                  <button
                    type="submit"
                    disabled={addJobMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-500 active:scale-95 transition disabled:opacity-40 cursor-pointer"
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>Log Application ↵</span>
                  </button>
                </div>
              </form>
            )}"""

assert target10 in text, "Target 10 not found"
text = text.replace(target10, replacement10, 1)

# 11. In CalendarPage, extract applications and interviews
target11 = """  const events = calendarQuery.data?.events ?? []
  const spends = calendarQuery.data?.spends ?? []
  const debts = calendarQuery.data?.debts ?? []"""

replacement11 = """  const events = calendarQuery.data?.events ?? []
  const spends = calendarQuery.data?.spends ?? []
  const debts = calendarQuery.data?.debts ?? []
  const applications = calendarQuery.data?.applications ?? []
  const interviews = calendarQuery.data?.interviews ?? []"""

assert target11 in text, "Target 11 not found"
text = text.replace(target11, replacement11, 1)

# 12. In CalendarPage, add applicationsFor and interviewsFor
target12 = """  const debtsFor = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return debts.filter((d) => {
      const taken = (d.taken_at || '').slice(0, 10)
      const due = (d.due_date || '').slice(0, 10)
      return taken === dayStr || due === dayStr
    })
  }"""

replacement12 = target12 + """

  const applicationsFor = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return applications.filter((a) => (a.applied_at || '').slice(0, 10) === dayStr)
  }

  const interviewsFor = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return interviews.filter((i) => (i.scheduled_at || '').slice(0, 10) === dayStr)
  }"""

assert target12 in text, "Target 12 not found"
text = text.replace(target12, replacement12, 1)

# 13. In MonthView, get dayApps and dayInterviews and update totalItems
target13 = """                const dayEvents = eventsFor(day)
                const daySpends = spendsFor(day)
                const dayDebts = debtsFor(day)
                const today = isSameDay(day, now)
                const inMonth = day.getMonth() === anchor.getMonth()
                const totalSpend = daySpends.reduce((acc, s) => acc + s.amount, 0)
                const totalItems = dayEvents.length + daySpends.length + dayDebts.length"""

replacement13 = """                const dayEvents = eventsFor(day)
                const daySpends = spendsFor(day)
                const dayDebts = debtsFor(day)
                const dayApps = applicationsFor(day)
                const dayInterviews = interviewsFor(day)
                const today = isSameDay(day, now)
                const inMonth = day.getMonth() === anchor.getMonth()
                const totalSpend = daySpends.reduce((acc, s) => acc + s.amount, 0)
                const totalItems = dayEvents.length + daySpends.length + dayDebts.length + dayApps.length + dayInterviews.length"""

assert target13 in text, "Target 13 not found"
text = text.replace(target13, replacement13, 1)

# 14. Render dayApps and dayInterviews badges in MonthView
target14 = """                        {/* 3. Debts (Lent / Borrowed) */}
                        {dayDebts.slice(0, 1).map((d) => (
                          <div
                            key={`db-${d.id}`}
                            className={cn(
                              'flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[8.5px] font-mono',
                              d.direction === 'lent'
                                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : 'border border-blue-500/30 bg-blue-500/10 text-blue-300'
                            )}
                          >
                            <span className="shrink-0">{d.direction === 'lent' ? '🤝' : '📥'}</span>
                            <span className="truncate font-sans font-medium">{d.person}</span>
                            <span className="ml-auto font-bold">{symbol}{d.amount}</span>
                          </div>
                        ))}"""

replacement14 = target14 + """

                        {/* 4. Job Applications & Interviews */}
                        {dayApps.slice(0, 1).map((app) => (
                          <div
                            key={`job-${app.id || app.company}`}
                            className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[8.5px] border border-violet-500/30 bg-violet-500/10 text-violet-300 font-medium"
                          >
                            <span className="shrink-0">💼</span>
                            <span className="truncate">{app.company}</span>
                          </div>
                        ))}
                        {dayInterviews.slice(0, 1).map((int) => (
                          <div
                            key={`int-${int.id || int.company}`}
                            className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[8.5px] border border-amber-500/40 bg-amber-500/15 text-amber-200 font-medium"
                          >
                            <span className="shrink-0">🎯</span>
                            <span className="truncate">Int: {int.company}</span>
                          </div>
                        ))}"""

assert target14 in text, "Target 14 not found"
text = text.replace(target14, replacement14, 1)

# 15. Pass applications and interviews to DayActionModal
target15 = """        {selectedDay && (
          <DayActionModal
            day={selectedDay}
            events={eventsFor(selectedDay)}
            spends={spendsFor(selectedDay)}
            debts={debtsFor(selectedDay)}
            symbol={symbol}
            onClose={() => setSelectedDay(null)}
          />
        )}"""

replacement15 = """        {selectedDay && (
          <DayActionModal
            day={selectedDay}
            events={eventsFor(selectedDay)}
            spends={spendsFor(selectedDay)}
            debts={debtsFor(selectedDay)}
            applications={applicationsFor(selectedDay)}
            interviews={interviewsFor(selectedDay)}
            symbol={symbol}
            onClose={() => setSelectedDay(null)}
          />
        )}"""

assert target15 in text, "Target 15 not found"
text = text.replace(target15, replacement15, 1)

with open('frontend/src/pages/Calendar.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Calendar.tsx successfully updated with job applications & interviews integration!")
