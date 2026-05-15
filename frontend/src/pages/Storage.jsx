import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      <div className="flex flex-col gap-2">
        <h5 className="text-2xl font-bold tracking-tight">{t('storage.pageTitle')}</h5>
        <p className="text-muted-foreground">{t('storage.pageDescription')}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('storage.summaryTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div>
            {t('storage.total')}: <span className="font-semibold text-foreground">{formatBytes(stats?.total_bytes || 0)}</span>
          </div>
          <div>
            {t('storage.files')}: <span className="font-semibold text-foreground">{stats?.file_count ?? 0}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('storage.filesHeading')}</CardTitle>
          <Button variant="outline" size="sm" onClick={load}>
            {t('storage.refresh')}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((f) => (
                <TableRow key={f.path}>
                  <TableCell className="max-w-[420px] truncate font-mono text-xs">{f.path}</TableCell>
                  <TableCell>{formatBytes(f.size)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {f.job_id ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await api.post(`/integrations/telegram/push/${f.job_id}/`)
                            toast.success('Sent to Telegram')
                          } catch (e) {
                            toast.error(e.response?.data?.detail || 'Telegram failed')
                          }
                        }}
                      >
                        Telegram
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="destructive"
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
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
