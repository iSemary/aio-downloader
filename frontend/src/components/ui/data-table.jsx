import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, Inbox, Loader2, Search, X } from 'lucide-react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { cn } from '@/lib/utils'

function SortIcon({ direction }) {
  if (direction === 'asc') return <ChevronUp className="ml-1 inline size-3.5" />
  if (direction === 'desc') return <ChevronDown className="ml-1 inline size-3.5" />
  return <ChevronsUpDown className="ml-1 inline size-3.5 opacity-40" />
}

function defaultFetch() {
  return Promise.resolve({ data: { results: [], count: 0 } })
}

export const DataTable = forwardRef(function DataTable({
  columns = [],
  fetchData,
  searchPlaceholder,
  pageSize = 15,
  externalParams = {},
  enableDateFilter = false,
  dateFields = [],
  defaultDateField = 'created_at',
}, ref) {
  const { t } = useTranslation()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sorting, setSorting] = useState({})
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined })
  const [dateField, setDateField] = useState(defaultDateField)

  const fetchFn = fetchData || defaultFetch

  const load = useCallback(async (p, search, sort, ext, dr, df) => {
    setLoading(true)
    try {
      const params = { page: p, page_size: pageSize, ...ext }
      if (search) params.search = search
      if (sort.column && sort.direction) {
        params.ordering = (sort.direction === 'desc' ? '-' : '') + sort.column
      }
      if (dr?.from) params.date_from = dr.from.toISOString().slice(0, 10)
      if (dr?.to) params.date_to = dr.to.toISOString().slice(0, 10)
      if (dr?.from || dr?.to) params.date_field = df || defaultDateField
      const res = await fetchFn(params)
      setData(res.data.results || [])
      const count = res.data.count || 0
      setPageCount(Math.max(1, Math.ceil(count / pageSize)))
      setPage(p)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [fetchFn, pageSize, defaultDateField])

  const hasExternal = Object.keys(externalParams).length > 0
  const externalKey = hasExternal ? JSON.stringify(externalParams) : 'none'

  const dateKey = `${dateField}-${dateRange.from?.getTime() || 'none'}-${dateRange.to?.getTime() || 'none'}`

  useImperativeHandle(ref, () => ({
    refresh: () => load(page, searchQuery, sorting, externalParams, dateRange, dateField),
    resetPageAndRefresh: () => { setPage(1); },
  }), [load, page, searchQuery, sorting, externalParams, dateRange, dateField])

  useEffect(() => {
    load(page, searchQuery, sorting, externalParams, dateRange, dateField)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery, sorting, externalKey, dateKey])

  useEffect(() => {
    setPage(1)
  }, [externalKey])

  const handleSort = (columnKey) => {
    setSorting((prev) => {
      if (prev.column !== columnKey) return { column: columnKey, direction: 'desc' }
      if (prev.direction === 'desc') return { column: columnKey, direction: 'asc' }
      return {}
    })
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setSearchQuery(searchInput)
    setPage(1)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      setSearchQuery(searchInput)
      setPage(1)
    }
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
    setPage(1)
  }

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
    state: { pagination: { pageIndex: page - 1, pageSize } },
  })

  const isActiveSort = (colKey) => sorting.column === colKey

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {enableDateFilter && dateFields.length > 0 && (
          <DateRangePicker
            dateField={dateField}
            onDateFieldChange={(val) => { setDateField(val); setPage(1) }}
            dateFields={dateFields}
            dateRange={dateRange}
            onDateRangeChange={(range) => { setDateRange(range ?? { from: undefined, to: undefined }); setPage(1) }}
          />
        )}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Input
              placeholder={searchPlaceholder || t('table.searchPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-9 w-48 pr-8 sm:w-64"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button type="submit" size="sm" className="h-9 gap-1.5">
            <Search className="size-4" />
            <span className="hidden sm:inline">{t('table.search')}</span>
          </Button>
        </form>
      </div>

      <div className="-mx-1 overflow-x-auto rounded-lg border sm:mx-0">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const colKey = h.column.id
                  const meta = h.column.columnDef.meta || {}
                  const canSort = !meta.disableSorting
                  return (
                    <TableHead
                      key={h.id}
                      className={cn(
                        'whitespace-nowrap',
                        canSort && 'cursor-pointer select-none hover:bg-muted/50',
                      )}
                      onClick={() => canSort && handleSort(colKey)}
                    >
                      <span className="inline-flex items-center">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {canSort && (
                          <SortIcon direction={isActiveSort(colKey) ? sorting.direction : null} />
                        )}
                      </span>
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={999} className="p-4 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2 py-8">
                    <Loader2 className="size-5 animate-spin" />
                    <span className="text-sm">{t('table.loading')}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length > 0 ? (
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
                    <Inbox className="mb-3 size-8 text-muted-foreground" aria-hidden />
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
          onClick={() => setPage((p) => Math.max(1, p - 1))}
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
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
        >
          {t('history.next')}
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </Button>
      </div>
    </div>
  )
})
