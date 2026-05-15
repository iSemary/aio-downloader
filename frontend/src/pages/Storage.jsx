import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Database, HardDrive, RefreshCw, Send, Trash2 } from 'lucide-react'
import { Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, Cell } from 'recharts'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { formatBytes } from '@/lib/formatBytes'

export default function StoragePage() {
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)
  const tableRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const s = await api.get('/storage/stats/')
      setStats(s.data)
    } catch {
      toast.error(t('storage.loadFailed'))
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  const chartData = useMemo(() => {
    if (!stats?.by_category) return []
    return stats.by_category.map(item => ({
      name: item.job__media_kind || 'unknown',
      value: item.bytes
    }))
  }, [stats])

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b']

  const fetchData = (params) => api.get('/storage/', { params })

  const columns = useMemo(() => [
    {
      accessorKey: 'path',
      header: t('storage.colPath'),
      cell: (info) => (
        <span className="max-w-[min(28rem,70vw)] truncate font-mono text-xs">{info.getValue()}</span>
      ),
    },
    {
      accessorKey: 'size',
      header: t('storage.colSize'),
      cell: (info) => <span className="whitespace-nowrap tabular-nums">{formatBytes(info.getValue())}</span>,
    },
    {
      id: 'actions',
      header: t('storage.colActions'),
      meta: { disableSorting: true },
      cell: ({ row }) => (
        <div className="flex flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-center sm:justify-end">
          {row.original.job_id ? (
            <Button
              size="sm"
              variant="secondary"
              className="min-h-9 gap-1.5"
              onClick={async () => {
                try {
                  await api.post(`/integrations/telegram/push/${row.original.job_id}/`)
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
                await api.delete(`/storage/${encodeURIComponent(row.original.path)}/`)
                toast.success('Deleted')
                tableRef.current?.refresh()
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
      ),
    },
  ], [t])

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
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col justify-center gap-3">
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

            {chartData.length > 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4">
                <p className="text-sm font-medium text-muted-foreground">{t('storage.categories') || 'Categories Breakdown'}</p>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value) => formatBytes(value)}
                        labelFormatter={() => ''}
                        contentStyle={{ borderRadius: '8px', fontSize: '13px', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', borderColor: 'hsl(var(--border))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-3 px-2 text-xs">
                  {chartData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5 capitalize text-muted-foreground">
                      <div
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      {entry.name}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
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
          <DataTable
            ref={tableRef}
            columns={columns}
            fetchData={fetchData}
            searchPlaceholder={t('table.searchPlaceholder')}
            pageSize={15}
            enableDateFilter
            dateFields={[
              { value: 'created_at', label: 'Created' },
              { value: 'updated_at', label: 'Updated' },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
