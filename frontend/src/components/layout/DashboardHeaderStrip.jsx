import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Activity, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatBps, sumActiveDownloadSpeedBps } from '@/lib/parseSpeed'
import { cn } from '@/lib/utils'
import { useDashboardHeaderStore } from '@/store/useDashboardHeaderStore'
import { useDownloadStore } from '@/store/useDownloadStore'

export function DashboardHeaderStrip() {
  const { t } = useTranslation()
  const [tick, setTick] = useState(0)
  const activeJobs = useDownloadStore((s) => s.activeJobs)
  const hasFetched = useDashboardHeaderStore((s) => s.hasFetched)
  const lastFetchOk = useDashboardHeaderStore((s) => s.lastFetchOk)
  const lastSuccessAt = useDashboardHeaderStore((s) => s.lastSuccessAt)
  const pulseDownloadingCount = useDashboardHeaderStore((s) => s.pulseDownloadingCount)
  const nextPending = useDashboardHeaderStore((s) => s.nextPending)

  const wsSessionCount = useMemo(() => Object.keys(activeJobs).length, [activeJobs])
  const speedBps = useMemo(() => sumActiveDownloadSpeedBps(activeJobs), [activeJobs])

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  void tick

  const ageSec =
    lastSuccessAt != null ? Math.max(0, Math.floor((Date.now() - lastSuccessAt) / 1000)) : null

  let freshnessLabel = null
  let freshnessClass = 'text-muted-foreground'
  if (hasFetched && !lastFetchOk) {
    freshnessLabel = t('dashboard.siteHeader.offline')
    freshnessClass = 'text-rose-600 dark:text-rose-400'
  } else if (hasFetched && lastFetchOk && wsSessionCount > 0) {
    freshnessLabel = t('dashboard.siteHeader.live')
    freshnessClass = 'text-emerald-600 dark:text-emerald-400'
  } else if (hasFetched && lastFetchOk && ageSec != null) {
    freshnessLabel = t('dashboard.siteHeader.updated', { seconds: ageSec })
    freshnessClass = 'text-muted-foreground'
  }

  const activeCount = pulseDownloadingCount
  const speedStr = formatBps(speedBps)
  const activeLine =
    activeCount > 0 || (speedStr && speedBps > 0)
      ? t('dashboard.siteHeader.activeLine', {
          count: activeCount,
          speed: speedStr ?? '—',
        })
      : t('dashboard.siteHeader.activeIdle')

  const nextTitle = (nextPending?.title || '').trim()
  const nextLine = nextTitle
    ? t('dashboard.siteHeader.nextWithTitle', { title: nextTitle })
    : t('dashboard.siteHeader.nextEmpty')

  return (
    <div className="flex min-w-0 max-w-[min(100%,20rem)] shrink flex-col items-end gap-0.5 text-end text-xs sm:max-w-[min(100%,28rem)]">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {freshnessLabel ? (
          <span className={cn('inline-flex items-center gap-1 tabular-nums', freshnessClass)}>
            {wsSessionCount > 0 && lastFetchOk ? (
              <Radio className="size-3 shrink-0" aria-hidden />
            ) : null}
            {freshnessLabel}
          </span>
        ) : null}
        <Badge variant="secondary" className="max-w-full gap-1 font-normal tabular-nums">
          <Activity className="size-3 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{activeLine}</span>
        </Badge>
      </div>
      <Link
        to="/queue"
        className="line-clamp-1 max-w-full text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        title={nextLine}
      >
        {nextLine}
      </Link>
    </div>
  )
}
