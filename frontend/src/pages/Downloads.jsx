import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { api } from '@/api/client'
import { formatBytes } from '@/lib/formatBytes'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Download,
  Pause,
  Play,
  RefreshCw,
  RotateCw,
  Send,
  SquareArrowOutUpRight,
  Trash2,
} from 'lucide-react'
import { DataTable } from '@/components/ui/data-table'

export default function DownloadsPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const filter = searchParams.get('filter')
  const category = searchParams.get('category')
  const [selectedJob, setSelectedJob] = useState(null)
  const [jobLoading, setJobLoading] = useState(false)
  const tableRef = useRef(null)

  const statusParam = (() => {
    if (filter === 'finished') return 'done'
    if (filter === 'unfinished') return 'pending,queued,downloading,processing,paused'
    if (filter === 'scheduled') return 'pending'
    return undefined
  })()

  const externalParams = {}
  if (statusParam) externalParams.status = statusParam
  if (category) externalParams.category = category

  const fetchData = (params) => api.get('/downloads/', { params })

  const columns = [
    { accessorKey: 'title', header: t('dashboard.recent.colTitle'), cell: (info) => info.getValue() || info.row.original.source_url || info.row.original.url },
    { accessorKey: 'platform', header: t('dashboard.recent.colPlatform') },
    {
      accessorKey: 'file_size',
      header: t('dashboard.recent.colSize'),
      cell: (info) => formatBytes(info.getValue() || 0),
    },
    { accessorKey: 'created_at', header: t('history.colDate'), cell: (info) => String(info.getValue() || '').slice(0, 19) },
    {
      accessorKey: 'status',
      header: t('dashboard.recent.colStatus'),
      cell: (info) => <StatusBadge status={info.getValue()} />,
    },
    {
      id: 'tg',
      header: t('dashboard.recent.colTg'),
      cell: ({ row }) => (row.original.sent_to_telegram ? t('dashboard.recent.yes') : t('dashboard.recent.no')),
    },
    {
      id: 'actions',
      header: '',
      meta: { disableSorting: true },
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="min-h-9 gap-1.5"
            onClick={async () => {
              setSelectedJob(row.original.id)
              setJobLoading(true)
              try {
                const { data } = await api.get(`/downloads/${row.original.id}/`)
                setSelectedJob(data)
              } catch (e) {
                toast.error(e.response?.data?.detail || 'Failed to load job details')
              } finally {
                setJobLoading(false)
              }
            }}
          >
            <SquareArrowOutUpRight className="size-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t('history.details')}</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-9 gap-1.5"
            onClick={async () => {
              try {
                await api.post(`/downloads/${row.original.id}/retry/`)
                toast.success('Retry queued')
                tableRef.current?.refresh()
              } catch (e) {
                toast.error(e.response?.data?.detail || 'Retry failed')
              }
            }}
          >
            <RotateCw className="size-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t('history.retry')}</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-9 gap-1.5"
            onClick={async () => {
              try {
                await api.delete(`/downloads/${row.original.id}/`)
                toast.success('Cancelled / removed')
                tableRef.current?.refresh()
              } catch {
                toast.error('Delete failed')
              }
            }}
          >
            <Trash2 className="size-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t('history.delete')}</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="min-h-9 gap-1.5"
            disabled={row.original.status !== 'done'}
            onClick={async () => {
              try {
                await api.post(`/integrations/telegram/push/${row.original.id}/`)
                toast.success('Sent to Telegram')
                tableRef.current?.refresh()
              } catch (e) {
                toast.error(e.response?.data?.detail || 'Telegram failed')
              }
            }}
          >
            <Send className="size-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t('dashboard.active.telegram')}</span>
          </Button>
        </div>
      ),
    },
  ]

  const getTitle = () => {
    if (filter === 'unfinished') return t('layout.downloads.unfinished')
    if (filter === 'finished') return t('layout.downloads.finished')
    if (filter === 'scheduled') return t('layout.downloads.scheduled')
    return t('layout.downloads.all')
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
          <Download className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h5 className="text-2xl font-bold tracking-tight text-foreground">{getTitle()}</h5>
          <p className="text-pretty text-muted-foreground">{t('history.pageDescription')}</p>
        </div>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <DataTable
            ref={tableRef}
            columns={columns}
            fetchData={fetchData}
            searchPlaceholder={t('table.searchPlaceholder')}
            pageSize={15}
            externalParams={externalParams}
            enableDateFilter
            dateFields={[
              { value: 'created_at', label: 'Created' },
              { value: 'updated_at', label: 'Updated' },
              { value: 'scheduled_at', label: 'Scheduled' },
              { value: 'started_at', label: 'Started' },
              { value: 'completed_at', label: 'Completed' },
            ]}
          />
        </CardContent>
      </Card>

      {/* Job Details Sheet */}
      <Sheet open={!!selectedJob} onOpenChange={(open) => { if (!open) setSelectedJob(null) }}>
        <SheetTrigger asChild>
          <div />
        </SheetTrigger>
        <SheetContent side="right" showCloseButton className="p-5" style={{ width: '50vw', maxWidth: '50vw' }}>
          <SheetHeader>
            <SheetTitle>{selectedJob ? selectedJob.title || t('queue.untitled') : t('jobDetail.loading')}</SheetTitle>
            <SheetDescription className="break-all font-mono text-xs">
              {selectedJob ? selectedJob.source_url || selectedJob.url : ''}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 pt-6 overflow-y-auto flex-1 min-h-0 pb-6">
            {jobLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                {t('jobDetail.loading')}
              </div>
            ) : !selectedJob ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('jobDetail.notFound')}</CardTitle>
                  <CardDescription>{t('jobDetail.notFoundHint')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild onClick={() => setSelectedJob(null)}>
                    {t('jobDetail.backHistory')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h5 className="text-xl leading-snug">{selectedJob.title || t('queue.untitled')}</h5>
                    <p className="break-all font-mono text-xs">
                      {selectedJob.source_url || selectedJob.url}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="capitalize">
                      {selectedJob.engine}
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      {selectedJob.media_kind}
                    </Badge>
                    <StatusBadge status={selectedJob.status} />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <div>
                    <span className="font-medium text-foreground">{t('jobDetail.id')}</span>{' '}
                    <span className="font-mono text-xs">{selectedJob.id}</span>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">{t('queue.size')}</span>{' '}
                    {formatBytes(selectedJob.file_size || selectedJob.bytes_downloaded || 0)}
                    {selectedJob.expected_size ? ` / ${formatBytes(selectedJob.expected_size)}` : ''}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">{t('queue.speed')}</span> {selectedJob.speed || '—'} · ETA:{' '}
                    {selectedJob.eta || '—'}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">{t('jobDetail.progress')}</span> {selectedJob.progress ?? 0}%
                  </div>
                  <div>
                    <span className="font-medium text-foreground">{t('jobDetail.format')}</span> {selectedJob.format || '—'} /{' '}
                    {selectedJob.quality || '—'}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">{t('jobDetail.platform')}</span> {selectedJob.platform || '—'}
                  </div>
                  {selectedJob.playlist?.id ? (
                    <div className="sm:col-span-2">
                      <span className="font-medium text-foreground">{t('jobDetail.playlistParent')}</span>{' '}
                      <a href={selectedJob.playlist.source_url || '#'} className="text-primary underline-offset-4 hover:underline">
                        {selectedJob.playlist.title || selectedJob.playlist.source_url || selectedJob.playlist.id}
                      </a>
                    </div>
                  ) : selectedJob.playlist_parent ? (
                    <div className="sm:col-span-2">
                      <span className="font-medium text-foreground">{t('jobDetail.playlistParent')}</span>{' '}
                      <a href="#" className="text-primary underline-offset-4 hover:underline">
                        {selectedJob.playlist_parent}
                      </a>
                    </div>
                  ) : null}
                  {selectedJob.error_message ? (
                    <div className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                      {selectedJob.error_message}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" asChild>
                    <a href={selectedJob.source_url || selectedJob.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-3.5" />
                      {t('jobDetail.openUrl')}
                    </a>
                  </Button>
                  {selectedJob.engine === 'http' && selectedJob.status === 'downloading' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={async () => {
                        try {
                          await api.post(`/downloads/${selectedJob.id}/pause/`)
                          toast.success(t('queue.paused'))
                          setSelectedJob(null)
                        } catch (e) {
                          toast.error(e.response?.data?.detail || 'Pause failed')
                        }
                      }}
                    >
                      <Pause className="size-3.5" /> {t('queue.pause')}
                    </Button>
                  ) : null}
                  {selectedJob.engine === 'http' && selectedJob.status === 'paused' ? (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={async () => {
                        try {
                          await api.post(`/downloads/${selectedJob.id}/resume/`)
                          toast.success(t('queue.resumed'))
                          setSelectedJob(null)
                        } catch (e) {
                          toast.error(e.response?.data?.detail || 'Resume failed')
                        }
                      }}
                    >
                      <Play className="size-3.5" /> {t('queue.resume')}
                    </Button>
                  ) : null}
                  {['error', 'cancelled'].includes(selectedJob.status) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={async () => {
                        try {
                          await api.post(`/downloads/${selectedJob.id}/retry/`)
                          toast.success(t('queue.retryQueued'))
                          setSelectedJob(null)
                        } catch (e) {
                          toast.error(e.response?.data?.detail || 'Retry failed')
                        }
                      }}
                    >
                      <RefreshCw className="size-3.5" /> {t('queue.retry')}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1.5"
                    disabled={selectedJob.status !== 'done'}
                    onClick={async () => {
                      try {
                        await api.post(`/integrations/telegram/push/${selectedJob.id}/`)
                        toast.success(t('dashboard.toast.sentTg'))
                        setSelectedJob(null)
                      } catch (e) {
                        toast.error(e.response?.data?.detail || t('dashboard.toast.tgFailed'))
                      }
                    }}
                  >
                    <Send className="size-3.5" /> {t('dashboard.active.telegram')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={async () => {
                      try {
                        await api.delete(`/downloads/${selectedJob.id}/`)
                        toast.success(t('queue.cancelled'))
                        setSelectedJob(null)
                      } catch {
                        toast.error(t('queue.cancelFailed'))
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" /> {t('queue.cancelJob')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
