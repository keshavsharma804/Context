import type * as React from 'react'
import type { VariantProps } from 'class-variance-authority'
import { Button, type buttonVariants } from '@/components/ui/button'
import type { SoundName } from '@/hooks/useSound'

interface SoundButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  sound?: SoundName | false
}

/**
 * A Button that clicks with the app's sound system. Button already does this
 * by default; SoundButton exists as the explicit, named wrapper for call sites
 * that want to choose a different sound (or opt out).
 */
export function SoundButton({ sound = 'click', ...props }: SoundButtonProps) {
  return <Button sound={sound} {...props} />
}
