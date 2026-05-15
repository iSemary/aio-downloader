import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Cloud,
  ClipboardPaste,
  Clock,
  Film,
  HardDrive,
  Image as ImageIcon,
  Inbox,
  Layers,
  Link2,
  ListPlus,
  Loader2,
  Music2,
  PieChart as PieChartIcon,
  Send,
  StopCircle,
} from 'lucide-react';
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
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { syncDashboardHeader } from '@/lib/syncDashboardHeader';
import { JobWebSocketListener } from '@/components/JobWebSocketListener';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Download as DownloadIcon, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDuration } from '@/lib/formatDuration';
import { formatBytes } from '@/lib/formatBytes';
import { formatBps, sumActiveDownloadSpeedBps } from '@/lib/parseSpeed';
import { cn } from '@/lib/utils';
import { useDownloadStore } from '@/store/useDownloadStore';
import { useAuthStore } from '@/store/useAuthStore';

const PLATFORM_COLORS = {
  youtube: '#ef4444',
  instagram: '#ec4899',
  tiktok: '#06b6d4',
  facebook: '#3b82f6',
  twitter: '#0f172a',
  http: '#6366f1',
  generic: '#64748b',
  'yt-dlp': '#22c55e',
  ytdlp: '#22c55e',
};

function formatApproxEta(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const m = Math.ceil(seconds / 60);
  if (m < 60) return `~${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (rm === 0) return `~${h}h`;
  return `~${h}h ${rm}m`;
}

function buildHeatmapColumns(heatmap) {
  if (!heatmap?.length) return [];
  const byDate = Object.fromEntries(heatmap.map((h) => [h.date, h.count]));
  const first = heatmap[0].date;
  const last = heatmap[heatmap.length - 1].date;
  const start = new Date(`${first}T12:00:00`);
  const end = new Date(`${last}T12:00:00`);
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const totalDays = Math.floor((end - gridStart) / 86400000) + 1;
  const numCols = Math.ceil(totalDays / 7);
  const columns = [];
  for (let w = 0; w < numCols; w += 1) {
    const week = [];
    for (let r = 0; r < 7; r += 1) {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + w * 7 + r);
      const iso = d.toISOString().slice(0, 10);
      const inRange = iso >= first && iso <= last;
      week.push({ date: iso, count: inRange ? (byDate[iso] ?? 0) : null });
    }
    columns.push(week);
  }
  return columns;
}

function ContributionHeatmap({ heatmap, t }) {
  const columns = useMemo(() => buildHeatmapColumns(heatmap), [heatmap]);
  const maxCount = useMemo(() => {
    const nums = heatmap.map((h) => h.count).filter((n) => n > 0);
    return nums.length ? Math.max(...nums) : 1;
  }, [heatmap]);

  if (!heatmap.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('dashboard.heatmap.empty')}
      </p>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex max-w-full gap-0.5 overflow-x-auto pb-1">
        {columns.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((cell) => {
              if (cell.count === null) {
                return (
                  <div
                    key={cell.date}
                    className="size-2.5 shrink-0 rounded-sm bg-transparent"
                    aria-hidden
                  />
                );
              }
              const intensity =
                cell.count === 0
                  ? 0
                  : Math.min(1, 0.25 + (cell.count / maxCount) * 0.75);
              return (
                <Tooltip key={cell.date}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'size-2.5 shrink-0 rounded-sm border border-transparent transition-colors',
                        cell.count === 0 ? 'bg-muted/50' : 'border-emerald-900/5',
                      )}
                      style={
                        cell.count > 0
                          ? {
                              backgroundColor: `rgba(16, 185, 129, ${intensity})`,
                            }
                          : undefined
                      }
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    {t('dashboard.heatmap.tooltip', {
                      date: cell.date,
                      count: cell.count,
                    })}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('best');
  const [analyzeBundle, setAnalyzeBundle] = useState({
    forUrl: '',
    meta: null,
  });
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [recent, setRecent] = useState([]);
  const [wsIds, setWsIds] = useState([]);
  const [uploadToGdrive, setUploadToGdrive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeJobs = useDownloadStore((s) => s.activeJobs);
  const upsertJob = useDownloadStore((s) => s.upsertJob);
  const updateJob = useDownloadStore((s) => s.updateJobProgress);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const refresh = useCallback(async () => {
    try {
      const dashResult = await syncDashboardHeader();
      if (!dashResult.ok) {
        toast.error(t('dashboard.toast.loadFailed'));
        return;
      }
      setDashboard(dashResult.data);
      const { data: jobs } = await api.get('/downloads/', {
        params: { page_size: 8, page: 1 },
      });
      setRecent(jobs.results ?? jobs ?? []);
    } catch {
      toast.error(t('dashboard.toast.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    const t0 = setTimeout(() => {
      void refresh();
    }, 0);
    const timer = setInterval(refresh, 15000);
    return () => {
      clearTimeout(t0);
      clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      setAnalyzeBundle({ forUrl: '', meta: null });
      setAnalyzeError(null);
      setAnalyzeLoading(false);
      return undefined;
    }

    setAnalyzeLoading(true);
    setAnalyzeError(null);
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.post(
          '/downloads/analyze/',
          { url: trimmed },
          { signal: ac.signal },
        );
        setAnalyzeBundle({ forUrl: trimmed, meta: data });
        if (!data.ok) {
          setAnalyzeError(
            data.detail || t('dashboard.newDownload.analyzeFailedShort'),
          );
        } else {
          setAnalyzeError(null);
        }
      } catch (err) {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError')
          return;
        setAnalyzeBundle({ forUrl: trimmed, meta: null });
        setAnalyzeError(
          err.response?.data?.detail ||
            t('dashboard.newDownload.analyzeFailedShort'),
        );
      } finally {
        if (!ac.signal.aborted) setAnalyzeLoading(false);
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [url, t]);

  const trimmedUrl = url.trim();
  const analyzeMeta =
    analyzeBundle.forUrl === trimmedUrl ? analyzeBundle.meta : null;

  useEffect(() => {
    if (!analyzeMeta) return;
    const d = analyzeMeta.defaults || { format: 'mp4', quality: 'best' };
    const af = analyzeMeta.allowed_formats || ['mp4'];
    const aq = analyzeMeta.allowed_qualities || ['best'];
    setFormat((f) => (af.includes(f) ? f : d.format));
    setQuality((q) => (aq.includes(q) ? q : d.quality));
  }, [analyzeMeta]);

  const optionsLevel = analyzeMeta?.options_level ?? null;
  const qualityChoices = useMemo(() => {
    const base = analyzeMeta?.allowed_qualities ?? [
      'best',
      '1080p',
      '720p',
      '480p',
      'audio_only',
    ];
    if (format === 'mp3')
      return base.filter((q) => q === 'best' || q === 'audio_only');
    return base;
  }, [analyzeMeta, format]);

  useEffect(() => {
    if (!qualityChoices.length) return;
    setQuality((q) => (qualityChoices.includes(q) ? q : qualityChoices[0]));
  }, [qualityChoices]);

  async function onDownload(e) {
    e.preventDefault();
    if (!url.trim()) return;
    const trimmed = url.trim();
    const level = analyzeMeta?.options_level ?? 'none';
    const defaults = analyzeMeta?.defaults ?? {
      format: 'mp4',
      quality: 'best',
    };
    const effectiveFormat = level === 'none' ? defaults.format : format;
    const effectiveQuality = level === 'none' ? defaults.quality : quality;
    setIsSubmitting(true);
    try {
      const { data } = await api.post('/downloads/', {
        source_url: trimmed,
        url: trimmed,
        format: effectiveFormat,
        quality: effectiveQuality,
        upload_to_google_drive: uploadToGdrive,
      })
      const isPlaylist = data && data.total_count != null && data.engine === undefined
      toast.success(t('dashboard.toast.started'))
      if (isPlaylist) {
        refresh()
        setUrl('')
        setAnalyzeBundle({ forUrl: '', meta: null })
        setAnalyzeError(null)
        return
      }
      upsertJob(data)
      setWsIds((ids) => [...new Set([...ids, data.id])])
      setUrl('')
      setAnalyzeBundle({ forUrl: '', meta: null })
      setAnalyzeError(null)
      refresh()
    } catch (err) {
      toast.error(
        err.response?.data?.detail || t('dashboard.toast.startFailed'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function cancelJob(id) {
    try {
      await api.delete(`/downloads/${id}/`);
      updateJob(id, { status: 'cancelled' });
      toast.message(t('dashboard.toast.stopRequested'));
    } catch {
      toast.error(t('dashboard.toast.cancelFailed'));
    }
  }

  async function sendTelegram(id) {
    try {
      await api.post(`/integrations/telegram/push/${id}/`);
      toast.success(t('dashboard.toast.sentTg'));
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('dashboard.toast.tgFailed'));
    }
  }

  const platforms = dashboard?.platforms ?? [];
  const pulse = dashboard?.pulse;
  const health = dashboard?.health;
  const largest = dashboard?.largest;
  const heatmap = dashboard?.heatmap ?? [];
  const speedHistogram = dashboard?.speed_histogram ?? [];

  const exportToExcel = useCallback(() => {
    try {
      const data = recent.map((j) => ({
        Title: j.title || j.source_url || j.url,
        Platform: j.platform,
        Size: formatBytes(j.file_size),
        Status: j.status,
        'Telegram Sent': j.sent_to_telegram ? 'Yes' : 'No',
        Date: j.created_at ? new Date(j.created_at).toLocaleString() : '-',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Recent Downloads');
      XLSX.writeFile(wb, 'aio_downloader_recent.xlsx');
      toast.success('Excel file exported');
    } catch (err) {
      console.error('Export failed', err);
      toast.error('Failed to export Excel');
    }
  }, [recent, t]);

  const exportHeatmapToExcel = useCallback(() => {
    try {
      const data = heatmap.map((h) => ({
        Date: h.date,
        'Completed Downloads': h.count,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Download Activity');
      XLSX.writeFile(wb, 'aio_downloader_activity.xlsx');
      toast.success('Activity data exported');
    } catch (err) {
      console.error('Heatmap export failed', err);
      toast.error('Failed to export activity data');
    }
  }, [heatmap]);

  const sortedPlatforms = useMemo(() => {
    const list = [...platforms];
    list.sort(
      (a, b) =>
        (b.total_bytes ?? b.bytes ?? 0) - (a.total_bytes ?? a.bytes ?? 0),
    );
    return list;
  }, [platforms]);

  const pieBytesData = useMemo(() => {
    const total =
      sortedPlatforms.reduce(
        (acc, p) => acc + (p.total_bytes ?? p.bytes ?? 0),
        0,
      ) || 1;
    return sortedPlatforms.map((p) => {
      const b = p.total_bytes ?? p.bytes ?? 0;
      return {
        name: p.platform,
        value: b,
        pct: Math.round((b / total) * 1000) / 10,
        kind: 'bytes',
      };
    });
  }, [sortedPlatforms]);

  const pieCountData = useMemo(() => {
    const total =
      sortedPlatforms.reduce((acc, p) => acc + (p.count || 0), 0) || 1;
    return sortedPlatforms.map((p) => ({
      name: p.platform,
      value: p.count || 0,
      pct: Math.round(((p.count || 0) / total) * 1000) / 10,
      kind: 'count',
    }));
  }, [sortedPlatforms]);

  const speedBarData = useMemo(
    () => speedHistogram.map((b) => ({ name: b.label, count: b.count })),
    [speedHistogram],
  );

  const activeSpeedBps = useMemo(
    () => sumActiveDownloadSpeedBps(activeJobs),
    [activeJobs],
  );
  const downloadingWsCount = useMemo(
    () =>
      Object.values(activeJobs).filter((j) => j?.status === 'downloading')
        .length,
    [activeJobs],
  );

  const weightedAvgFileBytes = useMemo(() => {
    let bytes = 0;
    let n = 0;
    for (const p of platforms) {
      const c = p.count || 0;
      bytes += p.total_bytes ?? p.bytes ?? 0;
      n += c;
    }
    if (!n) return null;
    return bytes / n;
  }, [platforms]);

  const sparklineData = useMemo(
    () =>
      (health?.success_rate_series_7d ?? []).map((row) => ({
        day: row.day?.slice(5) ?? row.day,
        rate: row.rate != null ? Math.round(row.rate * 1000) / 10 : null,
      })),
    [health],
  );

  const diskPct = useMemo(() => {
    const u = health?.disk?.used_bytes;
    const tot = health?.disk?.total_bytes;
    if (!tot || tot <= 0) return 0;
    return Math.min(100, (u / tot) * 100);
  }, [health]);

  const diskBarClass = useMemo(() => {
    if (diskPct >= 95) return '[&>div]:bg-rose-500';
    if (diskPct >= 80) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-emerald-600';
  }, [diskPct]);

  const successRatePct = useMemo(() => {
    const r = health?.success_rate_7d;
    if (r == null) return null;
    return Math.round(Number(r) * 1000) / 10;
  }, [health]);

  const successColorClass = useMemo(() => {
    if (successRatePct == null) return 'text-muted-foreground';
    if (successRatePct >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (successRatePct >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  }, [successRatePct]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      {wsIds.map((id) => (
        <JobWebSocketListener key={id} jobId={id} />
      ))}

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                <Link2 className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-xl">
                  {t('dashboard.newDownload.title')}
                </CardTitle>
                <CardDescription className="text-pretty">
                  {t('dashboard.newDownload.description')}
                </CardDescription>
              </div>
            </div>
            <div className="flex shrink-0 flex-row items-center gap-2 self-end sm:self-start">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="size-9 shrink-0" asChild>
                      <Link
                        to="/bulk-add"
                        aria-label={t('dashboard.newDownload.bulkAddLink')}
                      >
                        <ListPlus className="size-4" aria-hidden />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end" className="max-w-xs">
                    {t('dashboard.newDownload.bulkAddLink')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {analyzeMeta?.ok ? (
                <Badge
                  variant="secondary"
                  className="shrink-0 capitalize"
                >
                  {analyzeMeta.platform}
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <form className="space-y-2" onSubmit={onDownload}>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
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
                    className="min-h-11 flex-1 sm:flex-initial cursor-pointer"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        setUrl(text);
                      } catch {
                        toast.error(t('dashboard.toast.clipboardDenied'));
                      }
                    }}
                  >
                    <ClipboardPaste className="me-2 size-4" />
                    {t('dashboard.newDownload.paste')}
                  </Button>
                  <Button
                    type="submit"
                    className="min-h-11 min-w-[8.5rem] gap-2 cursor-pointer"
                    disabled={!trimmedUrl || analyzeLoading || !analyzeMeta?.ok || isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="size-4 shrink-0 animate-spin" />
                    ) : (
                      <Send className="size-4 shrink-0" />
                    )}
                    {t('dashboard.newDownload.download')}
                  </Button>
                </div>
              </div>
              {analyzeError && trimmedUrl ? (
                <p
                  className="text-sm text-amber-700 dark:text-amber-400"
                  role="status"
                >
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
                        {t('dashboard.newDownload.playlistBadge', {
                          count: analyzeMeta.playlist_item_count,
                        })}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-base font-medium leading-snug text-foreground">
                    {analyzeMeta.title || t('dashboard.newDownload.untitled')}
                  </p>
                  {analyzeMeta.uploader ? (
                    <p className="text-sm text-muted-foreground">
                      {analyzeMeta.uploader}
                    </p>
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
              <div className="space-y-4">
                <p className="text-sm font-medium text-foreground">
                  {t('dashboard.newDownload.outputOptions')}
                </p>
                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="space-y-2 sm:min-w-[11rem]">
                    <Label className="text-muted-foreground">
                      {t('dashboard.newDownload.outputFormat')}
                    </Label>
                    <Select value={format} onValueChange={setFormat}>
                      <SelectTrigger className="w-full min-w-0 sm:w-[180px]">
                        <SelectValue
                          placeholder={t('dashboard.newDownload.outputFormat')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          analyzeMeta?.allowed_formats ?? ['mp4', 'mp3', 'webm']
                        ).map((f) => (
                          <SelectItem key={f} value={f}>
                            {t(`dashboard.newDownload.format_${f}`, {
                              defaultValue: f,
                            })}
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
                        <SelectValue
                          placeholder={t('dashboard.newDownload.videoQuality')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {qualityChoices.map((q) => (
                          <SelectItem key={q} value={q}>
                            {t(`dashboard.newDownload.quality_${q}`, {
                              defaultValue: q,
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4">
                    <div className="flex min-w-0 gap-3">
                      <Cloud className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0">
                        <div className="font-medium leading-none">{t('settings.gdriveAutoUpload') || 'Auto-upload'}</div>
                        <p className="mt-1.5 text-sm text-muted-foreground">{t('settings.gdriveAutoUploadHint') || 'Upload all completed downloads automatically.'}</p>
                      </div>
                    </div>
                     <Switch
                       className="shrink-0"
                       checked={user?.preferences?.auto_upload_google_drive || false}
                       onCheckedChange={(v) => {
                         api.patch('/auth/preferences/', { auto_upload_google_drive: v });
                         setUser({ preferences: { ...(user?.preferences || {}), auto_upload_google_drive: v } });
                       }}
                     />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4">
                    <div className="flex min-w-0 gap-3">
                      <Cloud className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0">
                        <div className="font-medium leading-none">{t('dashboard.newDownload.uploadToGdrive') || 'Upload to Google Drive'}</div>
                        <p className="mt-1.5 text-sm text-muted-foreground">{t('dashboard.newDownload.uploadToGdriveHint') || 'Upload this specific download to Google Drive after completion.'}</p>
                      </div>
                    </div>
                    <Switch
                      className="shrink-0"
                      checked={uploadToGdrive}
                      onCheckedChange={(v) => setUploadToGdrive(v)}
                    />
                  </div>
                </div>
              </div>
            ) : trimmedUrl && analyzeMeta?.ok && optionsLevel === 'none' ? (
              <p className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                <ImageIcon
                  className="mt-0.5 size-4 shrink-0 opacity-70"
                  aria-hidden
                />
                {analyzeMeta.media_kind === 'image'
                  ? t('dashboard.newDownload.hintImage')
                  : t('dashboard.newDownload.hintGeneric')}
              </p>
            ) : !trimmedUrl ? (
              ''
            ) : null}
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          className="cursor-pointer overflow-hidden border-s-4 border-s-primary transition-all hover:ring-2 hover:ring-primary/20"
          onClick={() => navigate('/downloads')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardDescription>
                {t('dashboard.pulse.activeTitle')}
              </CardDescription>
              {(pulse?.downloading_count ?? 0) > 0 ? (
                <Loader2
                  className="size-4 shrink-0 animate-spin text-primary"
                  aria-hidden
                />
              ) : (
                <Activity
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              )}
            </div>
            <CardTitle className="text-3xl tabular-nums">
              {pulse?.downloading_count ?? '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t('dashboard.pulse.activeLine', {
              speed: formatBps(activeSpeedBps) ?? '—',
            })}
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer overflow-hidden border-s-4 border-s-violet-500 transition-all hover:ring-2 hover:ring-violet-500/20"
          onClick={() => navigate('/queue')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardDescription>
                {t('dashboard.pulse.queueTitle')}
              </CardDescription>
              <Inbox
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </div>
            <CardTitle className="text-3xl tabular-nums">
              {pulse?.pending_count ?? '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {pulse?.queue_clear_eta_seconds
              ? t('dashboard.pulse.queueEta', {
                  eta: formatApproxEta(pulse.queue_clear_eta_seconds),
                })
              : t('dashboard.pulse.queueEtaUnknown')}
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer overflow-hidden border-s-4 border-s-emerald-500 transition-all hover:ring-2 hover:ring-emerald-500/20"
          onClick={() => navigate('/downloads?filter=finished')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardDescription>
                {t('dashboard.pulse.todayTitle')}
              </CardDescription>
              <CheckCircle2
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </div>
            <CardTitle className="text-3xl tabular-nums">
              {pulse?.today?.files ?? '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t('dashboard.pulse.todayLine', {
              size: formatBytes(pulse?.today?.bytes ?? 0),
            })}
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer overflow-hidden border-s-4 border-s-sky-500 transition-all hover:ring-2 hover:ring-sky-500/20"
          onClick={() => navigate('/settings')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardDescription>
                {t('dashboard.pulse.telegramTitle')}
              </CardDescription>
              <Send
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </div>
            <CardTitle className="text-3xl tabular-nums">
              {pulse?.today?.telegram_pending ?? '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t('dashboard.pulse.telegramLine', {
              sent: pulse?.today?.telegram_sent_today ?? 0,
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/20"
          onClick={() => navigate('/downloads')}
        >
          <CardHeader className="pb-2">
            <CardDescription>
              {t('dashboard.health.successTitle')}
            </CardDescription>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <CardTitle
                className={cn('text-4xl tabular-nums', successColorClass)}
              >
                {successRatePct != null ? `${successRatePct}%` : '—'}
              </CardTitle>
              <div className="h-14 min-w-[7rem] flex-1">
                {sparklineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={sparklineData}
                      margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                    >
                      <XAxis dataKey="day" hide />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {t('dashboard.health.successHint')}
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-all hover:ring-2 hover:ring-amber-500/20"
          onClick={() => navigate('/storage')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardDescription>
                {t('dashboard.health.diskTitle')}
              </CardDescription>
              <HardDrive
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </div>
            <CardTitle className="text-lg tabular-nums">
              {formatBytes(health?.disk?.used_bytes ?? 0)} /{' '}
              {formatBytes(health?.disk?.total_bytes ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={diskPct} className={cn('h-2', diskBarClass)} />
            <p className="text-xs text-muted-foreground">
              {t('dashboard.health.diskHint')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardDescription>
                {t('dashboard.health.avgSizeTitle')}
              </CardDescription>
              <BarChart3
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </div>
            <CardTitle className="text-2xl tabular-nums">
              {weightedAvgFileBytes != null
                ? formatBytes(weightedAvgFileBytes)
                : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2"
                  >
                    {t('dashboard.health.avgSizeHint')}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <ul className="space-y-1 text-left">
                    {sortedPlatforms.map((p) => {
                      const c = p.count || 0;
                      if (!c) return null;
                      const b = p.total_bytes ?? p.bytes ?? 0;
                      return (
                        <li
                          key={p.platform}
                          className="flex justify-between gap-4 capitalize"
                        >
                          <span>{p.platform}</span>
                          <span className="tabular-nums">
                            {formatBytes(b / c)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardDescription>
                {t('dashboard.health.largestTitle')}
              </CardDescription>
              <Layers
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {largest?.id ? (
              <>
                <Link
                  to={`/jobs/${largest.id}`}
                  className="line-clamp-2 font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {largest.title || t('dashboard.newDownload.untitled')}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="tabular-nums">
                    {formatBytes(largest.file_size)}
                  </span>
                  <Badge variant="secondary" className="capitalize">
                    {largest.platform}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('dashboard.health.largestEmpty')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2 cursor-pointer transition-all hover:ring-2 hover:ring-primary/20"
          onClick={() => navigate('/history')}
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Clock className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <div>
                <CardTitle>{t('dashboard.heatmap.title')}</CardTitle>
                <CardDescription>
                  {t('dashboard.heatmap.description')}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                exportHeatmapToExcel();
              }}
              className="gap-2"
            >
              <FileSpreadsheet className="size-4" />
              <span className="hidden sm:inline">Export Excel</span>
            </Button>
          </CardHeader>
          <CardContent>
            <ContributionHeatmap heatmap={heatmap} t={t} />
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/20"
          onClick={() => navigate('/storage')}
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <PieChartIcon
                  className="size-5 text-muted-foreground"
                  aria-hidden
                />
              </div>
              <div>
                <CardTitle>{t('dashboard.donut.title')}</CardTitle>
                <CardDescription>
                  {t('dashboard.donut.dualDescription')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <RechartsTooltip
                    formatter={(value, name, item) => {
                      const kind = item?.payload?.kind;
                      if (kind === 'bytes')
                        return [formatBytes(Number(value)), name];
                      if (kind === 'count') return [`${value} files`, name];
                      return [value, name];
                    }}
                  />
                  <Pie
                    data={pieCountData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={44}
                    outerRadius={58}
                    paddingAngle={1}
                  >
                    {pieCountData.map((entry, index) => (
                      <Cell
                        key={`c-${entry.name + index}`}
                        fill={
                          PLATFORM_COLORS[entry.name] || PLATFORM_COLORS.generic
                        }
                      />
                    ))}
                  </Pie>
                  <Pie
                    data={pieBytesData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={86}
                    paddingAngle={1}
                  >
                    {pieBytesData.map((entry, index) => (
                      <Cell
                        key={`b-${entry.name + index}`}
                        fill={
                          PLATFORM_COLORS[entry.name] || PLATFORM_COLORS.generic
                        }
                      />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              {t('dashboard.donut.innerLegend')} ·{' '}
              {t('dashboard.donut.outerLegend')}
            </div>
            <div className="text-center text-xs text-muted-foreground">
              {t('dashboard.donut.total')}{' '}
              {formatBytes(
                sortedPlatforms.reduce(
                  (a, p) => a + (p.total_bytes ?? p.bytes ?? 0),
                  0,
                ),
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card
        className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/20"
        onClick={() => navigate('/downloads')}
      >
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <BarChart3 className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <CardTitle>{t('dashboard.speed.title')}</CardTitle>
              <CardDescription>
                {t('dashboard.speed.description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-64">
          {speedBarData.some((b) => b.count > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={speedBarData}
                margin={{ top: 8, right: 8, bottom: 40, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 10 }}
                />
                <YAxis allowDecimals={false} />
                <RechartsTooltip />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  fill="hsl(var(--primary))"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('dashboard.speed.empty')}
            </p>
          )}
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
              <CardDescription>
                {t('dashboard.active.description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(activeJobs).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('dashboard.active.empty')}
            </p>
          ) : (
            Object.values(activeJobs).map((job) => (
              <div key={job.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {job.title || job.source_url || job.url || job.id}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">
                        {job.platform || 'generic'}
                      </Badge>
                      <span>{job.speed}</span>
                      <span>{job.eta}</span>
                      {job.file_size ? (
                        <span>{formatBytes(job.file_size)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      title={t('dashboard.active.pauseTitle')}
                    >
                      {t('dashboard.active.pause')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelJob(job.id)}
                    >
                      <StopCircle className="me-1 size-4" />
                      {t('dashboard.active.stop')}
                    </Button>
                    {job.status === 'done' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => sendTelegram(job.id)}
                      >
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
        <Card
          className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/20"
          onClick={() => navigate('/history')}
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Clock className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <div>
                <CardTitle>{t('dashboard.recent.title')}</CardTitle>
                <CardDescription>
                  {t('dashboard.recent.description')}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                exportToExcel();
              }}
              className="gap-2"
            >
              <FileSpreadsheet className="size-4" />
              <span className="hidden sm:inline">Export Excel</span>
            </Button>
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
                  {recent.length > 0 ? (
                    recent.map((j) => (
                      <TableRow
                        key={j.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/jobs/${j.id}`)}
                      >
                        <TableCell className="max-w-[200px] truncate">
                          {j.title || j.source_url || j.url}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{j.platform}</Badge>
                        </TableCell>
                        <TableCell>{formatBytes(j.file_size)}</TableCell>
                        <TableCell>
                          <StatusBadge status={j.status} />
                        </TableCell>
                        <TableCell>
                          {j.sent_to_telegram
                            ? t('dashboard.recent.yes')
                            : t('dashboard.recent.no')}
                        </TableCell>
                      </TableRow>
                   ))
                 ) : (
                   <TableRow>
                     <TableCell colSpan={999} className="p-4 text-center text-muted-foreground">
                       <div className="flex flex-col items-center justify-center py-8">
                         <Inbox className="h-8 w-8 text-muted-foreground mb-3" aria-hidden />
                         <p className="text-sm">{t('table.noRecords')}</p>
                       </div>
                     </TableCell>
                   </TableRow>
                 )}
               </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/20"
          onClick={() => navigate('/storage')}
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Layers className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <div>
                <CardTitle>{t('dashboard.breakdown.title')}</CardTitle>
                <CardDescription>
                  {t('dashboard.breakdown.description')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {platforms.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('dashboard.breakdown.empty')}
              </p>
            ) : (
              platforms.map((p) => {
                const max = Math.max(
                  ...platforms.map((x) => x.total_bytes ?? x.bytes ?? 0),
                  1,
                );
                const b = p.total_bytes ?? p.bytes ?? 0;
                const pct = (b / max) * 100;
                return (
                  <div key={p.platform}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="capitalize">{p.platform}</span>
                      <span>{(b / 1024 ** 3).toFixed(2)} GB</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            PLATFORM_COLORS[p.platform] ||
                            PLATFORM_COLORS.generic,
                        }}
                      />
                    </div>
                  </div>
                );
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
  );
}
