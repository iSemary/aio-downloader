import { cn } from '@/lib/utils'

export function LogoMark({ className, email }) {
  const initial = (email?.trim()?.[0] || '?').toUpperCase()
  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-medium text-sidebar-primary-foreground',
        className,
      )}
      aria-hidden
    >
      {initial}
    </div>
  )
}
