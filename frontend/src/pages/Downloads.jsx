import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
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

const STATUS_MAP = {
  unfinished: ['pending', 'queued', 'downloading', 'processing', 'paused'],
  finished: ['done'],
  scheduled: ['pending'],
}

export default function DownloadsPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const filter = searchParams.get('filter')
  const category = searchParams.get('category')
  const [data, setData] = useState([])
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(false)

  const load = async (p = page) => {
    setLoading(true)
    try {
      const params = { page: p, page_size: 15 }
      
      if (filter === 'finished') {
        params.status = 'done'
      } else if (filter === 'unfinished') {
        params.status = 'pending,queued,downloading,processing,paused'
      } else if (filter === 'scheduled') {
        params.status = 'pending'
      }
      
      const res = await api.get('/downloads/', { params })
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
  }, [filter, category])

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
                 {table.getRowModel().rows.length > 0 ? (
                   table.getRowModel().rows.map((row) => (
                     <TableRow key={row.id}>
                       {row.getVisibleCells().map((cell) => (
                         <TableCell key={cell.id} className="align-top">
                           {flexRender(cell.column.columnDef.cell, cell.getContext())}
                         </TableCell>
                       ))}
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