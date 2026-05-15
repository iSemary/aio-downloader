import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const colorMap = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  queued: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  downloading: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  done: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  discovered: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  downloaded: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  skipped: 'bg-muted text-muted-foreground',
  idle: 'bg-muted text-muted-foreground',
  crawling: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  inactive: 'bg-muted text-muted-foreground',
}

function StatusBadge({ status, className, children, ...props }) {
  const colorClass = colorMap[status?.toLowerCase()] || 'bg-secondary text-secondary-foreground'
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : ''

  return (
    <Badge className={cn(colorClass, className)} {...props}>
      {children}
      {label}
    </Badge>
  )
}

export { StatusBadge }
