import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StickyNote } from 'lucide-react'
import { toast } from 'sonner'
import { fetchNote, putNote } from '@/lib/api'
import { PageHeader, ErrorPanel } from '@/components/pages/PageChrome'
import { Button } from '@/components/ui/button'

function Editor({ id, initial }: { id: string; initial: string }) {
  const [content, setContent] = useState(initial)
  const client = useQueryClient()
  const save = useMutation({
    mutationKey: ['notes', 'update'],
    mutationFn: () => putNote(id, content.trim()),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['note', id] }); void client.invalidateQueries({ queryKey: ['global-search'] }); toast.success('Note saved') },
  })
  return <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); save.mutate() }}>
    <label className="block text-sm font-medium">Note<textarea rows={14} maxLength={10000} required value={content} onChange={event => setContent(event.target.value)} className="mt-2 w-full rounded-xl border border-border bg-card p-4 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring" /></label>
    {save.error && <p role="alert" className="text-sm text-red-400 light:text-red-700">{save.error.message}</p>}
    <Button type="submit" disabled={save.isPending || !content.trim()}>{save.isPending ? 'Saving…' : 'Save note'}</Button>
  </form>
}

export default function NoteDetail() {
  const { id = '' } = useParams()
  const location = useLocation()
  const returnTo = typeof location.state?.returnTo === 'string' && /^\/search(?:\?|$)/.test(location.state.returnTo) ? location.state.returnTo : '/search?kind=note'
  const query = useQuery({ queryKey: ['note', id], queryFn: () => fetchNote(id), enabled: /^\d+$/.test(id) })
  return <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
    <PageHeader icon={StickyNote} title="Note" subtitle="Captured thoughts, ready to revisit." />
    <Link to={returnTo} className="mt-4 inline-block text-xs text-primary hover:underline">Back to notes search</Link>
    {!/^\d+$/.test(id) ? <p className="mt-6 text-sm">Note not found.</p> : query.isPending ? <p role="status" className="mt-6 text-sm text-muted-foreground">Loading note…</p> : query.isError ? <ErrorPanel className="mt-6" error={query.error} onRetry={() => { void query.refetch() }} retrying={query.isFetching} /> : <Editor key={id} id={id} initial={query.data.note.content} />}
  </div>
}
