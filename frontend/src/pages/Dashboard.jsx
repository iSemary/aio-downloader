import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardPaste,
  Film,
  HardDrive,
  Image as ImageIcon,
  Layers,
  LineChart as LineChartIcon,
  Link2,
  Loader2,
  Music2,
  PieChart as PieChartIcon,
  Send,
  StopCircle,
  XCircle,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { JobWebSocketListener } from '@/components/JobWebSocketListener'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatBytes } from '@/lib/formatBytes'
import { cn } from '@/lib/utils'
import { useDownloadStore } from '@/store/useDownloadStore'
import { useAuthStore } from '@/store/useAuthStore'

const PLATFORM_COLORS = {
  youtube: '#ef4444',
  instagram: '#ec4899',
  tiktok: '#06b6d4',
  facebook: '#3b82f6',
  twitter: '#0f172a',
  generic: '#64748b',
}

function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return null
  const s = Math.round(Number(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

function StatCard({ title, value, delta, accent, icon: Icon, sinceRefresh, noChange }) {
  return (
    <Card className={cn('overflow-hidden border-s-4', accent)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardDescription>{title}</CardDescription>
          {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
        </div>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        {delta != null && delta !== 0 ? (
          <span className={delta > 0 ? 'text-emerald-600' : 'text-rose-600'}>
            {delta > 0 ? '+' : ''}
            {delta} {sinceRefresh}
          </span>
        ) : (
          <span>{noChange}</span>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState('mp4')
  const [quality, setQuality] = useState('best')
  const [analyzeBundle, setAnalyzeBundle] = useState({ forUrl: '', meta: null })
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [range, setRange] = useState('7d')
  const [stats, setStats] = useState(null)
  const [prevStats, setPrevStats] = useState(null)
  const [series, setSeries] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [recent, setRecent] = useState([])
  const [wsIds, setWsIds] = useState([])
  const activeJobs = useDownloadStore((s) => s.activeJobs)
  const upsertJob = useDownloadStore((s) => s.upsertJob)
  const updateJob = useDownloadStore((s) => s.updateJobProgress)
  const user = useAuthStore((s) => s.user)

  const refresh = useCallback(async () => {
    try {
      const [s, ts, pl, jobs] = await Promise.all([
        api.get('/downloads/stats/'),
        api.get('/downloads/timeseries/', { params: { range } }),
        api.get('/downloads/platforms/'),
        api.get('/downloads/', { params: { page_size: 8, page: 1 } }),
      ])
      setStats((prev) => {
        setPrevStats(prev)
        return s.data
      })
      setSeries(ts.data)
      setPlatforms(pl.data)
      setRecent(jobs.data.results ?? jobs.data ?? [])
    } catch {
      toast.error(t('dashboard.toast.loadFailed'))
    }
  }, [range, t])

  useEffect(() => {
    const t0 = setTimeout(() => {
      void refresh()
    }, 0)
    const timer = setInterval(refresh, 15000)
    return () => {
      clearTimeout(t0)
      clearInterval(timer)
    }
  }, [refresh])

  const deltas = useMemo(() => {
    if (!stats || !prevStats) return { a: 0, b: 0, c: 0, d: 0, e: 0 }
    return {
      a: stats.urls_fetched - prevStats.urls_fetched,
      b: stats.successfully_downloaded - prevStats.successfully_downloaded,
      c: stats.sent_to_telegram - prevStats.sent_to_telegram,
      d: stats.failed - prevStats.failed,
      e: Math.round((stats.gb_stored - prevStats.gb_stored) * 1000) / 1000,
    }
  }, [stats, prevStats])

  useEffect(() => {
    const trimmed = url.trim()
    if (!trimmed) {
      setAnalyzeBundle({ forUrl: '', meta: null })
      setAnalyzeError(null)
      setAnalyzeLoading(false)
      return undefined
    }

    setAnalyzeLoading(true)
    setAnalyzeError(null)
    const ac = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.post('/downloads/analyze/', { url: trimmed }, { signal: ac.signal })
        setAnalyzeBundle({ forUrl: trimmed, meta: data })
        if (!data.ok) {
          setAnalyzeError(data.detail || t('dashboard.newDownload.analyzeFailedShort'))
        } else {
          setAnalyzeError(null)
        }
      } catch (err) {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return
        setAnalyzeBundle({ forUrl: trimmed, meta: null })
        setAnalyzeError(err.response?.data?.detail || t('dashboard.newDownload.analyzeFailedShort'))
      } finally {
        if (!ac.signal.aborted) setAnalyzeLoading(false)
      }
    }, 700)

    return () => {
      clearTimeout(timer)
      ac.abort()
    }
  }, [url, t])

  const trimmedUrl = url.trim()
  const analyzeMeta = analyzeBundle.forUrl === trimmedUrl ? analyzeBundle.meta : null

  useEffect(() => {
    if (!analyzeMeta) return
    const d = analyzeMeta.defaults || { format: 'mp4', quality: 'best' }
    const af = analyzeMeta.allowed_formats || ['mp4']
    const aq = analyzeMeta.allowed_qualities || ['best']
    setFormat((f) => (af.includes(f) ? f : d.format))
    setQuality((q) => (aq.includes(q) ? q : d.quality))
  }, [analyzeMeta])

  const optionsLevel = analyzeMeta?.options_level ?? null
  const qualityChoices = useMemo(() => {
    const base = analyzeMeta?.allowed_qualities ?? ['best', '1080p', '720p', '480p', 'audio_only']
    if (format === 'mp3') return base.filter((q) => q === 'best' || q === 'audio_only')
    return base
  }, [analyzeMeta, format])

  useEffect(() => {
    if (!qualityChoices.length) return
    setQuality((q) => (qualityChoices.includes(q) ? q : qualityChoices[0]))
  }, [qualityChoices])

  async function onDownload(e) {
    e.preventDefault()
    if (!url.trim()) return
    const trimmed = url.trim()
    const level = analyzeMeta?.options_level ?? 'none'
    const defaults = analyzeMeta?.defaults ?? { format: 'mp4', quality: 'best' }
    const effectiveFormat = level === 'none' ? defaults.format : format
    const effectiveQuality = level === 'none' ? defaults.quality : quality
    try {
      const { data } = await api.post('/downloads/', {
        url: trimmed,
        format: effectiveFormat,
        quality: effectiveQuality,
      })
      toast.success(t('dashboard.toast.started'))
      upsertJob(data)
      setWsIds((ids) => [...new Set([...ids, data.id])])
      setUrl('')
      setAnalyzeBundle({ forUrl: '', meta: null })
      setAnalyzeError(null)
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || t('dashboard.toast.startFailed'))
    }
  }

  async function cancelJob(id) {
    try {
      await api.delete(`/downloads/${id}/`)
      updateJob(id, { status: 'cancelled' })
      toast.message(t('dashboard.toast.stopRequested'))
    } catch {
      toast.error(t('dashboard.toast.cancelFailed'))
    }
  }

  async function sendTelegram(id) {
    try {
      await api.post(`/integrations/telegram/push/${id}/`)
      toast.success(t('dashboard.toast.sentTg'))
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || t('dashboard.toast.tgFailed'))
    }
  }

  const pieData = useMemo(() => {
    const total = platforms.reduce((acc, p) => acc + (p.bytes || 0), 0) || 1
    return platforms.map((p) => ({
      name: p.platform,
      value: p.bytes || 0,
      pct: Math.round(((p.bytes || 0) / total) * 1000) / 10,
    }))
  }, [platforms])

  const barData = useMemo(() => {
    const order = ['youtube', 'instagram', 'tiktok', 'facebook', 'twitter']
    const map = Object.fromEntries(platforms.map((p) => [p.platform, (p.bytes || 0) / 1024 ** 3]))
    return order.map((k) => ({ name: k, gb: +(map[k] || 0).toFixed(3) }))
  }, [platforms])

  const statMeta = useMemo(
    () => ({
      since: t('dashboard.stats.sinceRefresh'),
      noChange: t('dashboard.stats.noChange'),
    }),
    [t],
  )

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      {wsIds.map((id) => (
        <JobWebSocketListener key={id} jobId={id} />
      ))}

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                <Link2 className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-xl">{t('dashboard.newDownload.title')}</CardTitle>
                <CardDescription className="text-pretty">{t('dashboard.newDownload.description')}</CardDescription>
              </div>
            </div>
            {analyzeMeta?.ok ? (
              <Badge variant="secondary" className="shrink-0 capitalize sm:mt-1">
                {analyzeMeta.platform}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <form className="space-y-6" onSubmit={onDownload}>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="download-url" className="text-foreground">
                  {t('dashboard.newDownload.urlLabel')}
                </Label>
                {analyzeLoading ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    {t('dashboard.newDownload.analyzing')}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <Input
                  id="download-url"
                  className="min-h-11 font-mono text-sm sm:flex-1"
                  placeholder={t('dashboard.newDownload.placeholder')}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 flex-1 sm:flex-initial"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText()
                        setUrl(text)
                      } catch {
                        toast.error(t('dashboard.toast.clipboardDenied'))
                      }
                    }}
                  >
                    <ClipboardPaste className="me-2 size-4" />
                    {t('dashboard.newDownload.paste')}
                  </Button>
                  <Button type="submit" className="min-h-11 min-w-[8.5rem] gap-2" disabled={!trimmedUrl}>
                    <Send className="size-4 shrink-0" />
                    {t('dashboard.newDownload.download')}
                  </Button>
                </div>
              </div>
              {analyzeError && trimmedUrl ? (
                <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
                  {analyzeError}. {t('dashboard.newDownload.analyzeFailedHint')}
                </p>
              ) : null}
            </div>

            {analyzeLoading && trimmedUrl ? (
              <div className="grid gap-4 rounded-xl border bg-card/50 p-4 sm:grid-cols-[140px_1fr]">
                <Skeleton className="aspect-video w-full max-w-[200px] rounded-lg sm:max-w-none" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-3/4 max-w-md" />
                  <Skeleton className="h-4 w-1/2 max-w-xs" />
                  <Skeleton className="h-4 w-1/3 max-w-[10rem]" />
                </div>
              </div>
            ) : null}

            {!analyzeLoading && analyzeMeta?.ok && trimmedUrl ? (
              <div className="grid gap-4 rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 sm:grid-cols-[minmax(0,200px)_1fr]">
                <div className="relative overflow-hidden rounded-lg border bg-muted/40 shadow-inner">
                  {analyzeMeta.thumbnail ? (
                    <img
                      src={analyzeMeta.thumbnail}
                      alt=""
                      className="aspect-video w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-muted text-muted-foreground">
                      {analyzeMeta.media_kind === 'audio' ? (
                        <Music2 className="size-10 opacity-60" aria-hidden />
                      ) : analyzeMeta.media_kind === 'image' ? (
                        <ImageIcon className="size-10 opacity-60" aria-hidden />
                      ) : (
                        <Film className="size-10 opacity-60" aria-hidden />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-col justify-center gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {analyzeMeta.media_kind === 'video' ? (
                      <Badge variant="outline" className="gap-1 font-normal">
                        <Film className="size-3" aria-hidden />
                        {t('dashboard.newDownload.kindVideo')}
                      </Badge>
                    ) : null}
                    {analyzeMeta.media_kind === 'audio' ? (
                      <Badge variant="outline" className="gap-1 font-normal">
                        <Music2 className="size-3" aria-hidden />
                        {t('dashboard.newDownload.kindAudio')}
                      </Badge>
                    ) : null}
                    {analyzeMeta.media_kind === 'image' ? (
                      <Badge variant="outline" className="gap-1 font-normal">
                        <ImageIcon className="size-3" aria-hidden />
                        {t('dashboard.newDownload.kindImage')}
                      </Badge>
                    ) : null}
                    {analyzeMeta.is_playlist ? (
                      <Badge variant="secondary">
                        {t('dashboard.newDownload.playlistBadge', { count: analyzeMeta.playlist_item_count })}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-base font-medium leading-snug text-foreground">
                    {analyzeMeta.title || t('dashboard.newDownload.untitled')}
                  </p>
                  {analyzeMeta.uploader ? (
                    <p className="text-sm text-muted-foreground">{analyzeMeta.uploader}</p>
                  ) : null}
                  {formatDuration(analyzeMeta.duration_seconds) ? (
                    <p className="text-xs text-muted-foreground">
                      {t('dashboard.newDownload.duration')}{' '}
                      <span className="font-medium text-foreground tabular-nums">
                        {formatDuration(analyzeMeta.duration_seconds)}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {optionsLevel === 'full' || optionsLevel === 'audio' ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">{t('dashboard.newDownload.outputOptions')}</p>
                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="space-y-2 sm:min-w-[11rem]">
                    <Label className="text-muted-foreground">{t('dashboard.newDownload.outputFormat')}</Label>
                    <Select value={format} onValueChange={setFormat}>
                      <SelectTrigger className="w-full min-w-0 sm:w-[180px]">
                        <SelectValue placeholder={t('dashboard.newDownload.outputFormat')} />
                      </SelectTrigger>
                      <SelectContent>
                        {(analyzeMeta?.allowed_formats ?? ['mp4', 'mp3', 'webm']).map((f) => (
                          <SelectItem key={f} value={f}>
                            {t(`dashboard.newDownload.format_${f}`, { defaultValue: f })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:min-w-[11rem]">
                    <Label className="text-muted-foreground">
                      {optionsLevel === 'audio'
                        ? t('dashboard.newDownload.qualityLabelAudio')
                        : t('dashboard.newDownload.qualityLabelVideo')}
                    </Label>
                    <Select value={quality} onValueChange={setQuality}>
                      <SelectTrigger className="w-full min-w-0 sm:w-[200px]">
                        <SelectValue placeholder={t('dashboard.newDownload.videoQuality')} />
                      </SelectTrigger>
                      <SelectContent>
                        {qualityChoices.map((q) => (
                          <SelectItem key={q} value={q}>
                            {t(`dashboard.newDownload.quality_${q}`, { defaultValue: q })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ) : trimmedUrl && analyzeMeta?.ok && optionsLevel === 'none' ? (
              <p className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                <ImageIcon className="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden />
                {analyzeMeta.media_kind === 'image'
                  ? t('dashboard.newDownload.hintImage')
                  : t('dashboard.newDownload.hintGeneric')}
              </p>
            ) : !trimmedUrl ? (
              <p className="text-sm text-muted-foreground">{t('dashboard.newDownload.emptyHint')}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title={t('dashboard.stats.urlsFetched')}
          value={stats?.urls_fetched ?? '—'}
          delta={deltas.a}
          accent="border-s-violet-500"
          icon={Link2}
          sinceRefresh={statMeta.since}
          noChange={statMeta.noChange}
        />
        <StatCard
          title={t('dashboard.stats.downloaded')}
          value={stats?.successfully_downloaded ?? '—'}
          delta={deltas.b}
          accent="border-s-emerald-500"
          icon={CheckCircle2}
          sinceRefresh={statMeta.since}
          noChange={statMeta.noChange}
        />
        <StatCard
          title={t('dashboard.stats.sentTelegram')}
          value={stats?.sent_to_telegram ?? '—'}
          delta={deltas.c}
          accent="border-s-sky-500"
          icon={Send}
          sinceRefresh={statMeta.since}
          noChange={statMeta.noChange}
        />
        <StatCard
          title={t('dashboard.stats.failed')}
          value={stats?.failed ?? '—'}
          delta={deltas.d}
          accent="border-s-rose-500"
          icon={XCircle}
          sinceRefresh={statMeta.since}
          noChange={statMeta.noChange}
        />
        <StatCard
          title={t('dashboard.stats.gbStored')}
          value={stats?.gb_stored ?? '—'}
          delta={deltas.e}
          accent="border-s-amber-500"
          icon={HardDrive}
          sinceRefresh={statMeta.since}
          noChange={statMeta.noChange}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <LineChartIcon className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <div>
                <CardTitle>{t('dashboard.activity.title')}</CardTitle>
                <CardDescription>{t('dashboard.activity.description')}</CardDescription>
              </div>
            </div>
            <Tabs value={range} onValueChange={setRange}>
              <TabsList>
                <TabsTrigger value="7d">{t('dashboard.activity.range7d')}</TabsTrigger>
                <TabsTrigger value="30d">{t('dashboard.activity.range30d')}</TabsTrigger>
                <TabsTrigger value="all">{t('dashboard.activity.rangeAll')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tickFormatter={(v) => (v ? String(v).slice(0, 10) : '')} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="downloaded"
                  stroke="#10b981"
                  name={t('dashboard.activity.legendDownloaded')}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="sent_tg"
                  stroke="#0ea5e9"
                  name={t('dashboard.activity.legendSentTg')}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="failed"
                  stroke="#f43f5e"
                  name={t('dashboard.activity.legendFailed')}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <PieChartIcon className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <div>
                <CardTitle>{t('dashboard.donut.title')}</CardTitle>
                <CardDescription>{t('dashboard.donut.description')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(v, _n, p) => [formatBytes(p.payload.value), p.payload.name]} />
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name + index} fill={PLATFORM_COLORS[entry.name] || PLATFORM_COLORS.generic} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center text-sm text-muted-foreground">
              {t('dashboard.donut.total')} {formatBytes(platforms.reduce((a, p) => a + (p.bytes || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <BarChart3 className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <CardTitle>{t('dashboard.platformBars.title')}</CardTitle>
              <CardDescription>{t('dashboard.platformBars.description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="gb" radius={[6, 6, 0, 0]} animationDuration={800}>
                {barData.map((e) => (
                  <Cell key={e.name} fill={PLATFORM_COLORS[e.name] || PLATFORM_COLORS.generic} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Activity className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <CardTitle>{t('dashboard.active.title')}</CardTitle>
              <CardDescription>{t('dashboard.active.description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(activeJobs).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.active.empty')}</p>
          ) : (
            Object.values(activeJobs).map((job) => (
              <div key={job.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{job.title || job.url || job.id}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{job.platform || 'generic'}</Badge>
                      <span>{job.speed}</span>
                      <span>{job.eta}</span>
                      {job.file_size ? <span>{formatBytes(job.file_size)}</span> : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled title={t('dashboard.active.pauseTitle')}>
                      {t('dashboard.active.pause')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => cancelJob(job.id)}>
                      <StopCircle className="me-1 size-4" />
                      {t('dashboard.active.stop')}
                    </Button>
                    {job.status === 'done' ? (
                      <Button variant="secondary" size="sm" onClick={() => sendTelegram(job.id)}>
                        {t('dashboard.active.telegram')}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3">
                  <Progress
                    value={job.progress || 0}
                    className={cn(
                      'h-3 transition-all',
                      job.status === 'done' && '[&>div]:bg-emerald-500',
                      job.status === 'downloading' && '[&>div]:animate-pulse',
                    )}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recent.title')}</CardTitle>
            <CardDescription>{t('dashboard.recent.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dashboard.recent.colTitle')}</TableHead>
                  <TableHead>{t('dashboard.recent.colPlatform')}</TableHead>
                  <TableHead>{t('dashboard.recent.colSize')}</TableHead>
                  <TableHead>{t('dashboard.recent.colStatus')}</TableHead>
                  <TableHead>{t('dashboard.recent.colTg')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="max-w-[200px] truncate">{j.title || j.url}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{j.platform}</Badge>
                    </TableCell>
                    <TableCell>{formatBytes(j.file_size)}</TableCell>
                    <TableCell>
                      <Badge>{j.status}</Badge>
                    </TableCell>
                    <TableCell>{j.sent_to_telegram ? t('dashboard.recent.yes') : t('dashboard.recent.no')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Layers className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <div>
                <CardTitle>{t('dashboard.breakdown.title')}</CardTitle>
                <CardDescription>{t('dashboard.breakdown.description')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {platforms.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('dashboard.breakdown.empty')}</p>
            ) : (
              platforms.map((p) => {
                const max = Math.max(...platforms.map((x) => x.bytes || 0), 1)
                const pct = ((p.bytes || 0) / max) * 100
                return (
                  <div key={p.platform}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="capitalize">{p.platform}</span>
                      <span>{((p.bytes || 0) / 1024 ** 3).toFixed(2)} GB</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: PLATFORM_COLORS[p.platform] || PLATFORM_COLORS.generic,
                        }}
                      />
                    </div>
                  </div>
                )
              })
            )}
            <div className="pt-2 text-xs text-muted-foreground">
              {t('dashboard.breakdown.loggedInAs')}{' '}
              <span className="font-medium text-foreground">{user?.email}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
