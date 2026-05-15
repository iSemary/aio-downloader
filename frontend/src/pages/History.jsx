import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  History as HistoryIcon,
  RotateCw,
  Send,
  SquareArrowOutUpRight,
  Trash2,
} from 'lucide-react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatBytes } from '@/lib/formatBytes'

export default function HistoryPage() {
  const { t } = useTranslation()
  const [data, setData] = useState([])
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(false)

  const load = async (p = page) => {
    setLoading(true)
    try {
      const res = await api.get('/downloads/', { params: { page: p, page_size: 15 } })
      setData(res.data.results || [])
      const count = res.data.count || 0
      const size = res.data.page_size || 15
      setPageCount(Math.max(1, Math.ceil(count / size)))
      setPage(p)
    } catch {
      toast.error(t('history.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      cell: (info) => <Badge variant="secondary">{info.getValue()}</Badge>,
    },
    {
      id: 'tg',
      header: t('dashboard.recent.colTg'),
      cell: ({ row }) => (row.original.sent_to_telegram ? t('dashboard.recent.yes') : t('dashboard.recent.no')),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="min-h-9 gap-1.5" asChild>
            <Link to={`/jobs/${row.original.id}`}>
              <SquareArrowOutUpRight className="size-3.5 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{t('history.details')}</span>
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-9 gap-1.5"
            onClick={async () => {
              try {
                await api.post(`/downloads/${row.original.id}/retry/`)
                toast.success('Retry queued')
                load(page)
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
                load(page)
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
                load(page)
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

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount,
    state: { pagination: { pageIndex: page - 1, pageSize: 15 } },
  })

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
          <HistoryIcon className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h5 className="text-2xl font-bold tracking-tight text-foreground">{t('history.pageTitle')}</h5>
          <p className="text-pretty text-muted-foreground">{t('history.pageDescription')}</p>
        </div>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted ring-1 ring-border/60">
              <HistoryIcon className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-xl">{t('history.cardTitle')}</CardTitle>
              <CardDescription className="text-pretty">{t('history.cardDescription')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="-mx-1 overflow-x-auto rounded-lg border sm:mx-0">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => (
                      <TableHead key={h.id} className="whitespace-nowrap">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              className="min-h-11 w-full gap-2 sm:w-auto"
              disabled={page <= 1 || loading}
              onClick={() => load(page - 1)}
            >
              <ChevronLeft className="size-4 shrink-0" aria-hidden />
              {t('history.previous')}
            </Button>
            <div className="order-first text-center text-sm text-muted-foreground sm:order-0">
              {t('history.pageStatus', { page, pageCount })}
            </div>
            <Button
              variant="outline"
              className="min-h-11 w-full gap-2 sm:w-auto"
              disabled={page >= pageCount || loading}
              onClick={() => load(page + 1)}
            >
              {t('history.next')}
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
