import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { JobWebSocketListener } from '@/components/JobWebSocketListener'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatBytes } from '@/lib/formatBytes'
import { useDownloadStore } from '@/store/useDownloadStore'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
const ACTIVE = new Set(['pending', 'downloading', 'processing', 'paused'])

export default function JobDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const patch = useDownloadStore((s) => (id ? s.activeJobs[id] : undefined))

  const merged = useMemo(() => {
    if (!id) return null
    if (job && patch) return { ...job, ...patch }
    return job || patch || null
  }, [id, job, patch])

  const load = useCallback(async () => {
    if (!id || !UUID_RE.test(id)) {
      setLoading(false)
      setJob(null)
      return
    }
    setLoading(true)
    try {
      const { data } = await api.get(`/downloads/${id}/`)
      setJob(data)
    } catch {
      setJob(null)
      toast.error(t('jobDetail.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    load()
  }, [load])

  const wsActive = merged && ACTIVE.has(merged.status)

  if (!id || !UUID_RE.test(id)) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">{t('jobDetail.invalidId')}</p>
        <Button variant="outline" asChild>
          <Link to="/history">{t('jobDetail.backHistory')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      {wsActive ? <JobWebSocketListener jobId={id} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-2" asChild>
          <Link to="/queue">
            <ArrowLeft className="size-4" />
            {t('jobDetail.backQueue')}
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="gap-2" asChild>
          <Link to="/history">{t('jobDetail.backHistory')}</Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          {t('jobDetail.loading')}
        </div>
      ) : !merged ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('jobDetail.notFound')}</CardTitle>
            <CardDescription>{t('jobDetail.notFoundHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/history">{t('jobDetail.backHistory')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-xl leading-snug">{merged.title || t('queue.untitled')}</CardTitle>
                <CardDescription className="break-all font-mono text-xs">
                  {merged.source_url || merged.url}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize">
                  {merged.engine}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {merged.media_kind}
                </Badge>
                <StatusBadge status={merged.status} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a href={merged.source_url || merged.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  {t('jobDetail.openUrl')}
                </a>
              </Button>
              {merged.engine === 'http' && merged.status === 'downloading' ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={async () => {
                    try {
                      await api.post(`/downloads/${id}/pause/`)
                      toast.success(t('queue.paused'))
                      load()
                    } catch (e) {
                      toast.error(e.response?.data?.detail || 'Pause failed')
                    }
                  }}
                >
                  <Pause className="size-3.5" /> {t('queue.pause')}
                </Button>
              ) : null}
              {merged.engine === 'http' && merged.status === 'paused' ? (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={async () => {
                    try {
                      await api.post(`/downloads/${id}/resume/`)
                      toast.success(t('queue.resumed'))
                      load()
                    } catch (e) {
                      toast.error(e.response?.data?.detail || 'Resume failed')
                    }
                  }}
                >
                  <Play className="size-3.5" /> {t('queue.resume')}
                </Button>
              ) : null}
              {['error', 'cancelled'].includes(merged.status) ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={async () => {
                    try {
                      await api.post(`/downloads/${id}/retry/`)
                      toast.success(t('queue.retryQueued'))
                      load()
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
                disabled={merged.status !== 'done'}
                onClick={async () => {
                  try {
                    await api.post(`/integrations/telegram/push/${id}/`)
                    toast.success(t('dashboard.toast.sentTg'))
                    load()
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
                    await api.delete(`/downloads/${id}/`)
                    toast.success(t('queue.cancelled'))
                    navigate('/history')
                  } catch {
                    toast.error(t('queue.cancelFailed'))
                  }
                }}
              >
                <Trash2 className="size-3.5" /> {t('queue.cancelJob')}
              </Button>
            </div>

            <Separator />

            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="font-medium text-foreground">{t('jobDetail.id')}</span>{' '}
                <span className="font-mono text-xs">{merged.id}</span>
              </div>
              <div>
                <span className="font-medium text-foreground">{t('queue.size')}</span>{' '}
                {formatBytes(merged.file_size || merged.bytes_downloaded || 0)}
                {merged.expected_size ? ` / ${formatBytes(merged.expected_size)}` : ''}
              </div>
              <div>
                <span className="font-medium text-foreground">{t('queue.speed')}</span> {merged.speed || '—'} · ETA:{' '}
                {merged.eta || '—'}
              </div>
              <div>
                <span className="font-medium text-foreground">{t('jobDetail.progress')}</span> {merged.progress ?? 0}%
              </div>
              <div>
                <span className="font-medium text-foreground">{t('jobDetail.format')}</span> {merged.format || '—'} /{' '}
                {merged.quality || '—'}
              </div>
              <div>
                <span className="font-medium text-foreground">{t('jobDetail.platform')}</span> {merged.platform || '—'}
              </div>
              {merged.playlist?.id ? (
                <div className="sm:col-span-2">
                  <span className="font-medium text-foreground">{t('jobDetail.playlistParent')}</span>{' '}
                  <Link className="text-primary underline-offset-4 hover:underline" to="/playlists">
                    {merged.playlist.title || merged.playlist.source_url || merged.playlist.id}
                  </Link>
                </div>
              ) : merged.playlist_parent ? (
                <div className="sm:col-span-2">
                  <span className="font-medium text-foreground">{t('jobDetail.playlistParent')}</span>{' '}
                  <Link className="text-primary underline-offset-4 hover:underline" to="/playlists">
                    {merged.playlist_parent}
                  </Link>
                </div>
              ) : null}
              {merged.error_message ? (
                <div className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                  {merged.error_message}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
