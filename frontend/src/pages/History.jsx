import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      { accessorKey: 'title', header: 'Title', cell: (info) => info.getValue() || info.row.original.url },
      { accessorKey: 'platform', header: 'Platform' },
      {
        accessorKey: 'file_size',
        header: 'Size',
        cell: (info) => formatBytes(info.getValue() || 0),
      },
      { accessorKey: 'created_at', header: 'Date', cell: (info) => String(info.getValue() || '').slice(0, 19) },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => <Badge variant="secondary">{info.getValue()}</Badge>,
      },
      {
        id: 'tg',
        header: 'TG',
        cell: ({ row }) => (row.original.sent_to_telegram ? 'Yes' : 'No'),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="outline"
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
              Retry
            </Button>
            <Button
              size="sm"
              variant="outline"
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
              Delete
            </Button>
            <Button
              size="sm"
              variant="secondary"
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
              Telegram
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
      <div className="flex flex-col gap-2">
        <h5 className="text-2xl font-bold tracking-tight">{t('history.pageTitle')}</h5>
        <p className="text-muted-foreground">{t('history.pageDescription')}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('history.cardTitle')}</CardTitle>
        </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>
            Previous
          </Button>
          <div className="text-sm text-muted-foreground">
            Page {page} / {pageCount}
          </div>
          <Button variant="outline" disabled={page >= pageCount || loading} onClick={() => load(page + 1)}>
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
    </div>
  )
}
