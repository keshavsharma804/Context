import { cn } from '@/lib/utils'

interface ContextLogoProps {
  className?: string
  size?: number
  variant?: 'tile' | 'mark'
}

/**
 * Genuine, trustworthy, minimalist brandmark for Context OS.
 * Crafted with timeless Swiss/Bauhaus geometric precision:
 * A confident circular aperture forming the letter 'C' around an authentic focus nucleus.
 */
export function ContextLogo({ className = '', size = 32, variant = 'tile' }: ContextLogoProps) {
  if (variant === 'mark') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('shrink-0 select-none', className)}
        style={{ width: size, height: size }}
      >
        {/* Bold geometric C aperture */}
        <path
          d="M17 7.5A6.5 6.5 0 1 0 17 16.5"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <div
      className={cn(
        'group relative flex items-center justify-center shrink-0 rounded-xl border border-white/15 bg-[#14161b] shadow-sm select-none transition-transform duration-200',
        className
      )}
      style={{ width: size, height: size }}
    >
      {/* Subtle top bevel hairline */}
      <div className="absolute inset-x-1.5 top-0 h-px bg-white/20 rounded-t" />

      {/* SVG Icon Graphic */}
      <svg
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[62%] h-[62%]"
      >
        {/* Precision geometric C aperture */}
        <path
          d="M19.5 8.8A7.2 7.2 0 1 0 19.5 19.2"
          className="stroke-stone-100"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

/**
 * Context Hardware Hallmark Stamp.
 * An understated, authentic industrial maker's stamp.
 */
export function ContextSeal({ className = '', size = 42 }: { className?: string; size?: number }) {
  return (
    <div tabIndex={0}
      className={cn(
        'group relative flex flex-col items-center justify-center rounded-lg border border-stone-700/80 bg-[#121316] shadow-sm cursor-default select-none transition-colors hover:border-stone-500',
        className
      )}
      style={{ width: size, height: size }}
      data-ui-tooltip="Context Hardware Vault · 100% Local Silicon"
    >
      {/* Authentic inner double border */}
      <div className="absolute inset-[2.5px] rounded border border-stone-800 pointer-events-none group-hover:border-stone-700 transition-colors" />

      {/* Hallmark Monogram */}
      <span className="font-mono text-[9px] font-bold tracking-widest text-stone-300 leading-none">
        CTX
      </span>
      <span className="font-mono text-[6.5px] font-semibold text-stone-500 tracking-wider uppercase mt-0.5">
        LOCAL
      </span>
    </div>
  )
}
