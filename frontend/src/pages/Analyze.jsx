import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Film, Image as ImageIcon, Loader2, Music2, ScanSearch } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDuration } from '@/lib/formatDuration'

export default function AnalyzePage() {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState(null)

  const trimmed = url.trim()

  const runAnalyze = async () => {
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setMeta(null)
    try {
      const { data } = await api.post('/downloads/analyze/', { url: trimmed })
      setMeta(data)
      if (!data.ok) setError(data.detail || t('dashboard.newDownload.analyzeFailedShort'))
    } catch (err) {
      setError(err.response?.data?.detail || t('dashboard.newDownload.analyzeFailedShort'))
      toast.error(t('analyzePage.toastFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
          <ScanSearch className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h5 className="text-2xl font-bold tracking-tight text-foreground">{t('analyzePage.pageTitle')}</h5>
          <p className="text-pretty text-muted-foreground">{t('analyzePage.pageDescription')}</p>
        </div>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-xl">{t('analyzePage.cardTitle')}</CardTitle>
          <CardDescription className="text-pretty">{t('analyzePage.cardDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="analyze-url">{t('dashboard.newDownload.urlLabel')}</Label>
              <Input
                id="analyze-url"
                className="min-h-11 font-mono text-sm"
                placeholder={t('dashboard.newDownload.placeholder')}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <Button type="button" className="min-h-11 shrink-0 gap-2" onClick={runAnalyze} disabled={!trimmed || loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}
              {t('analyzePage.analyzeButton')}
            </Button>
          </div>

          {error ? (
            <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
              {error}. {t('dashboard.newDownload.analyzeFailedHint')}
            </p>
          ) : null}

          {loading && trimmed ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('dashboard.newDownload.analyzing')}
            </div>
          ) : null}

          {!loading && meta?.ok ? (
            <div className="grid gap-4 rounded-xl border bg-card/50 p-4 sm:grid-cols-[140px_1fr]">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted sm:aspect-square sm:max-w-[140px]">
                {meta.thumbnail ? (
                  <img src={meta.thumbnail} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <Film className="size-10 opacity-40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {meta.platform}
                  </Badge>
                  {meta.engine ? (
                    <Badge variant="outline" className="capitalize">
                      {meta.engine}
                    </Badge>
                  ) : null}
                  {meta.media_kind === 'audio' ? (
                    <Badge variant="outline" className="gap-1">
                      <Music2 className="size-3.5" /> {t('dashboard.newDownload.kindAudio')}
                    </Badge>
                  ) : null}
                  {meta.media_kind === 'image' ? (
                    <Badge variant="outline" className="gap-1">
                      <ImageIcon className="size-3.5" /> {t('dashboard.newDownload.kindImage')}
                    </Badge>
                  ) : null}
                  {meta.media_kind === 'video' ? (
                    <Badge variant="outline" className="gap-1">
                      <Film className="size-3.5" /> {t('dashboard.newDownload.kindVideo')}
                    </Badge>
                  ) : null}
                  {meta.is_playlist ? (
                    <Badge variant="secondary">
                      {t('dashboard.newDownload.playlistBadge', { count: meta.playlist_item_count ?? '—' })}
                    </Badge>
                  ) : null}
                </div>
                <h2 className="text-lg font-semibold leading-snug">{meta.title || t('dashboard.newDownload.untitled')}</h2>
                {meta.uploader ? <p className="text-sm text-muted-foreground">{meta.uploader}</p> : null}
                {formatDuration(meta.duration_seconds) ? (
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.newDownload.duration')}: {formatDuration(meta.duration_seconds)}
                  </p>
                ) : null}
                {meta.capabilities ? (
                  <pre className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
                    {JSON.stringify(meta.capabilities, null, 2)}
                  </pre>
                ) : null}
              </div>
            </div>
          ) : null}

          {!loading && meta && !meta.ok ? (
            <p className="text-sm text-muted-foreground">{t('analyzePage.notOk')}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
