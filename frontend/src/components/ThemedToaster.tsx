import { Toaster } from 'sonner'
import { useUIStore } from '@/store/ui'

export default function ThemedToaster() {
  const theme = useUIStore(s => s.theme)

  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'hsl(var(--popover))',
          border: '1px solid hsl(var(--border))',
          color: 'hsl(var(--popover-foreground))',
        },
      }}
    />
  )
}
