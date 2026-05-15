import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ListPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/store/useAuthStore'

const FORMATS = ['mp4', 'mp3', 'webm']
const QUALITIES = ['best', '1080p', '720p', '480p', 'audio_only']

export default function BulkAddPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [text, setText] = useState('')
  const [format, setFormat] = useState(user?.default_format || 'mp4')
  const [quality, setQuality] = useState(user?.default_quality || 'best')
  const [httpConnections, setHttpConnections] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const urls = useMemo(
    () =>
      text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [text],
  )

  const submit = async (e) => {
    e.preventDefault()
    if (!urls.length) return
    const list = urls.slice(0, 50)
    if (urls.length > 50) toast.message(t('bulkAdd.truncated'))
    setSubmitting(true)
    try {
      const { data } = await api.post('/downloads/bulk/', {
        urls: list,
        format,
        quality,
        http_connections: httpConnections,
      })
      const n = (data.jobs || []).length
      const errors = data.errors || []
      if (n) toast.success(t('bulkAdd.queued', { count: n }))
      if (errors.length) toast.message(t('bulkAdd.partial', { count: errors.length }))
      if (n) setText('')
    } catch (err) {
      toast.error(err.response?.data?.detail || t('bulkAdd.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
          <ListPlus className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h5 className="text-2xl font-bold tracking-tight text-foreground">{t('bulkAdd.pageTitle')}</h5>
          <p className="text-pretty text-muted-foreground">{t('bulkAdd.pageDescription')}</p>
        </div>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-xl">{t('bulkAdd.cardTitle')}</CardTitle>
          <CardDescription className="text-pretty">{t('bulkAdd.cardDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <form className="space-y-6" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="bulk-urls">{t('bulkAdd.urlsLabel')}</Label>
              <Textarea
                id="bulk-urls"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('bulkAdd.placeholder')}
                rows={12}
                className="min-h-[200px] font-mono text-sm"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                {t('bulkAdd.lineCount', { count: urls.length, max: 50 })}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('bulkAdd.format')}</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('bulkAdd.quality')}</Label>
                <Select value={quality} onValueChange={setQuality}>
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALITIES.map((q) => (
                      <SelectItem key={q} value={q}>
                        {q}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-http">{t('bulkAdd.httpConnections')}</Label>
                <Input
                  id="bulk-http"
                  type="number"
                  min={1}
                  max={8}
                  value={httpConnections}
                  onChange={(e) => setHttpConnections(Math.min(8, Math.max(1, Number(e.target.value) || 1)))}
                  className="min-h-11"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" className="min-h-11 gap-2" disabled={!urls.length || submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('bulkAdd.submit')}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/queue">{t('bulkAdd.openQueue')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
