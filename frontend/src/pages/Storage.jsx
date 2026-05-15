import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Database, HardDrive, RefreshCw, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatBytes } from '@/lib/formatBytes'

export default function StoragePage() {
  const { t } = useTranslation()
  const [files, setFiles] = useState([])
  const [stats, setStats] = useState(null)

  const load = async () => {
    try {
      const [l, s] = await Promise.all([api.get('/storage/'), api.get('/storage/stats/')])
      setFiles(l.data)
      setStats(s.data)
    } catch {
      toast.error(t('storage.loadFailed'))
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
          <HardDrive className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h5 className="text-2xl font-bold tracking-tight text-foreground">{t('storage.pageTitle')}</h5>
          <p className="text-pretty text-muted-foreground">{t('storage.pageDescription')}</p>
        </div>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
              <Database className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-xl">{t('storage.summaryTitle')}</CardTitle>
              <CardDescription className="text-pretty">{t('storage.summaryDescription')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <HardDrive className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{t('storage.total')}</p>
                <p className="truncate text-lg font-semibold tabular-nums text-foreground">
                  {formatBytes(stats?.total_bytes || 0)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Database className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{t('storage.files')}</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{stats?.file_count ?? 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b bg-muted/30 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted ring-1 ring-border/60">
              <HardDrive className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-xl">{t('storage.filesHeading')}</CardTitle>
              <CardDescription className="text-pretty">{t('storage.filesDescription')}</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" className="min-h-10 w-full shrink-0 gap-2 sm:w-auto" onClick={load}>
            <RefreshCw className="size-4 shrink-0" aria-hidden />
            {t('storage.refresh')}
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="-mx-1 overflow-x-auto rounded-lg border sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-48">{t('storage.colPath')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('storage.colSize')}</TableHead>
                  <TableHead className="min-w-40 text-end">{t('storage.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((f) => (
                  <TableRow key={f.path}>
                    <TableCell className="max-w-[min(28rem,70vw)] truncate font-mono text-xs">{f.path}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatBytes(f.size)}</TableCell>
                    <TableCell className="text-end">
                      <div className="flex flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-center sm:justify-end">
                        {f.job_id ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="min-h-9 gap-1.5"
                            onClick={async () => {
                              try {
                                await api.post(`/integrations/telegram/push/${f.job_id}/`)
                                toast.success('Sent to Telegram')
                              } catch (e) {
                                toast.error(e.response?.data?.detail || 'Telegram failed')
                              }
                            }}
                          >
                            <Send className="size-3.5 shrink-0" aria-hidden />
                            <span className="hidden sm:inline">{t('dashboard.active.telegram')}</span>
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="destructive"
                          className="min-h-9 gap-1.5"
                          onClick={async () => {
                            try {
                              await api.delete(`/storage/${encodeURIComponent(f.path)}/`)
                              toast.success('Deleted')
                              load()
                            } catch {
                              toast.error('Delete failed')
                            }
                          }}
                        >
                          <Trash2 className="size-3.5 shrink-0" aria-hidden />
                          <span className="hidden sm:inline">{t('history.delete')}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
