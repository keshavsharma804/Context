import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchNotifications, postNotificationAction, postNotificationsReadAll } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

export function useReminders(enabled = true, poll = false) {
  const user = useAuthStore(state => state.user)
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const query = useQuery({
    queryKey: ['notifications', timezone],
    queryFn: () => fetchNotifications(timezone),
    enabled: enabled && Boolean(user),
    staleTime: 30_000,
    // The bell owns polling; Today reads the same cached query.
    refetchInterval: poll ? 60_000 : false,
    refetchOnWindowFocus: true,
  })
  return { ...query, timezone }
}

export function useReminderActions(timezone: string) {
  const client = useQueryClient()
  const refresh = () => { void client.invalidateQueries({ queryKey: ['notifications'] }) }
  const action = useMutation({
    mutationKey: ['notifications', 'action'],
    mutationFn: ({ id, action, minutes }: { id: string; action: 'read' | 'snooze' | 'dismiss'; minutes?: number }) =>
      postNotificationAction(id, action, timezone, minutes),
    onSuccess: (_result, variables) => {
      refresh()
      if (variables.action === 'snooze') toast.success(`Reminder snoozed for ${variables.minutes ?? 15} minutes`)
      if (variables.action === 'dismiss') toast.success('Reminder dismissed')
    },
    onError: error => { refresh(); toast.error(error.message) },
  })
  const readAll = useMutation({
    mutationKey: ['notifications', 'read-all'],
    mutationFn: () => postNotificationsReadAll(timezone),
    onSuccess: () => { refresh(); toast.success('All reminders marked as read') },
    onError: error => toast.error(error.message),
  })
  return { action, readAll }
}
