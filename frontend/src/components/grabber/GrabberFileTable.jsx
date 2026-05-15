import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Download, Loader2, Search, Trash2 } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import GrabberFileTypeBadge from '@/components/grabber/GrabberFileTypeBadge'

export default function GrabberFileTable({ files = [], loading, onDownload, onDownloadBulk, onDelete, onRefresh }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  const filtered = useMemo(() => {
    let result = [...files]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((f) => f.file_name?.toLowerCase().includes(q) || f.file_url?.toLowerCase().includes(q))
    }
    if (typeFilter !== 'all') result = result.filter((f) => f.file_type === typeFilter)
    if (statusFilter !== 'all') result = result.filter((f) => f.status === statusFilter)

    result.sort((a, b) => {
      let va = a[sortField] || ''
      let vb = b[sortField] || ''
      if (sortField === 'file_size') {
        va = a.file_size || 0
        vb = b.file_size || 0
        return sortDir === 'asc' ? va - vb : vb - va
      }
      va = String(va).toLowerCase()
      vb = String(vb).toLowerCase()
      const cmp = va.localeCompare(vb)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [files, search, typeFilter, statusFilter, sortField, sortDir])

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((f) => f.id)))
    }
  }

  const formatSize = (bytes) => {
    if (!bytes) return '-'
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0
    let size = bytes
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024
      i++
    }
    return `${size.toFixed(1)} ${units[i]}`
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <ArrowUp className="ml-1 size-3" /> : <ArrowDown className="ml-1 size-3" />
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('grabber.searchFiles')}
            className="max-w-xs pl-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder={t('grabber.allTypes')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('grabber.allTypes')}</SelectItem>
            <SelectItem value="image">{t('grabber.images')}</SelectItem>
            <SelectItem value="video">{t('grabber.videos')}</SelectItem>
            <SelectItem value="audio">{t('grabber.audio')}</SelectItem>
            <SelectItem value="document">{t('grabber.documents')}</SelectItem>
            <SelectItem value="archive">{t('grabber.archives')}</SelectItem>
            <SelectItem value="other">{t('grabber.other')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('grabber.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('grabber.allStatuses')}</SelectItem>
            <SelectItem value="discovered">{t('grabber.discovered')}</SelectItem>
            <SelectItem value="queued">{t('grabber.queued')}</SelectItem>
            <SelectItem value="downloaded">{t('grabber.downloaded')}</SelectItem>
            <SelectItem value="skipped">{t('grabber.skipped')}</SelectItem>
            <SelectItem value="error">{t('grabber.error')}</SelectItem>
          </SelectContent>
        </Select>
        {selectedIds.size > 0 && (
          <Button size="sm" variant="default" onClick={() => onDownloadBulk?.(Array.from(selectedIds))}>
            <Download className="mr-1 size-3.5" /> {t('grabber.downloadSelected', { count: selectedIds.size })}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
          {loading && <Loader2 className="mr-1 size-3.5 animate-spin" />}
          {t('refresh')}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <Search className="size-8" />
          <p>{t('grabber.noFilesFound')}</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('file_name')}>
                  <span className="inline-flex items-center">{t('grabber.fileName')} <SortIcon field="file_name" /></span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('file_type')}>
                  <span className="inline-flex items-center">{t('grabber.fileType')} <SortIcon field="file_type" /></span>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('file_size')}>
                  <span className="inline-flex items-center">{t('grabber.fileSize')} <SortIcon field="file_size" /></span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('status')}>
                  <span className="inline-flex items-center">{t('grabber.status')} <SortIcon field="status" /></span>
                </TableHead>
                <TableHead className="text-right">{t('grabber.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((file) => {
                return (
                  <TableRow key={file.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(file.id)}
                        onCheckedChange={() => toggleSelect(file.id)}
                      />
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <GrabberFileTypeBadge fileType={file.file_type} fileName={file.file_name} />
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{file.extension || '-'}</code>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {formatSize(file.file_size)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={file.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {file.status === 'discovered' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="size-7" onClick={() => onDownload?.(file.id)}>
                                  <Download className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('grabber.queueDownload')}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="size-7" onClick={() => onDelete?.(file.id)}>
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('grabber.deleteFile')}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('grabber.showingFiles', { count: filtered.length, total: files.length })}
      </p>
    </div>
  )
}
