import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from 'cmdk'
import { GripVertical, Loader2, Pause, Play, RefreshCw, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { Group, Panel, Separator as PanelResizeSeparator } from 'react-resizable-panels'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { JobWebSocketListener } from '@/components/JobWebSocketListener'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { formatBytes } from '@/lib/formatBytes'
import { cn } from '@/lib/utils'
import { useDownloadStore } from '@/store/useDownloadStore'

function SortableQueueRow({ id, label, subtitle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-card px-2 py-2 text-sm',
        isDragging && 'opacity-60 shadow-md',
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted"
        {...attributes}
        {...listeners}
        aria-label="Reorder"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{label}</div>
        {subtitle ? <div className="truncate text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
    </div>
  )
}

const ACTIVE = new Set(['pending', 'downloading', 'processing', 'paused'])

export default function QueuePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [reorderOpen, setReorderOpen] = useState(false)
  const [orderIds, setOrderIds] = useState([])
  const [bulkText, setBulkText] = useState('')
  const parentRef = useRef(null)
  const activeJobs = useDownloadStore((s) => s.activeJobs)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/downloads/', { params: { sort: 'queue', page_size: 100 } })
      const list = res.data.results ?? res.data
      setJobs(Array.isArray(list) ? list : [])
    } catch {
      toast.error(t('queue.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  const merged = useMemo(() => {
    const byId = new Map(jobs.map((j) => [j.id, { ...j }]))
    for (const [id, patch] of Object.entries(activeJobs)) {
      const cur = byId.get(id)
      if (cur) byId.set(id, { ...cur, ...patch })
      else byId.set(id, { id, ...patch })
    }
    return jobs.length ? jobs.map((j) => byId.get(j.id) || j) : Array.from(byId.values())
  }, [jobs, activeJobs])

  const selected = merged.find((j) => j.id === selectedId) || null

  const virtualizer = useVirtualizer({
    count: merged.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const wsJobIds = useMemo(
    () => merged.filter((j) => ACTIVE.has(j.status)).map((j) => j.id),
    [merged],
  )

  const openReorder = () => {
    setOrderIds(merged.map((j) => String(j.id)))
    setReorderOpen(true)
  }

  const onDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrderIds((items) => {
      const oldIndex = items.indexOf(String(active.id))
      const newIndex = items.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return items
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  const saveReorder = async () => {
    try {
      await api.post('/downloads/reorder/', { order: orderIds })
      toast.success(t('queue.reorderSaved'))
      setReorderOpen(false)
      await load()
    } catch (e) {
      toast.error(e.response?.data?.detail || t('queue.reorderFailed'))
    }
  }

  const submitBulk = async () => {
    const urls = bulkText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!urls.length) return
    try {
      const { data } = await api.post('/downloads/bulk/', { urls, format: 'mp4', quality: 'best' })
      const n = (data.jobs || []).length
      const err = (data.errors || []).length
      if (n) toast.success(t('queue.bulkQueued', { count: n }))
      if (err) toast.message(t('queue.bulkPartial', { count: err }))
      setBulkText('')
      await load()
    } catch (e) {
      toast.error(e.response?.data?.detail || t('queue.bulkFailed'))
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col gap-4 p-4 md:p-6">
      {wsJobIds.map((id) => (
        <JobWebSocketListener key={id} jobId={id} />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h5 className="text-2xl font-semibold tracking-tight">{t('queue.pageTitle')}</h5>
          <p className="text-sm text-muted-foreground">{t('queue.pageDescription')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setCmdOpen(true)}>
            {t('queue.commandPalette')}
          </Button>
          <Button variant="outline" size="sm" onClick={openReorder}>
            {t('queue.reorder')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : t('queue.refresh')}
          </Button>
        </div>
      </div>

      <Group orientation="horizontal" className="min-h-0 flex-1 rounded-lg border">
        <Panel defaultSize={62} minSize={40} className="min-w-0 flex flex-col">
          <div className="border-b p-3">
            <Label className="text-xs text-muted-foreground">{t('queue.bulkUrls')}</Label>
            <div className="mt-1 flex gap-2">
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={t('queue.bulkPlaceholder')}
                rows={2}
                className="min-h-[72px] flex-1 text-sm"
              />
              <Button type="button" className="self-end" onClick={submitBulk}>
                {t('queue.bulkAdd')}
              </Button>
            </div>
          </div>
          <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : merged.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t('queue.empty')}</p>
            ) : (
              <div
                className="relative w-full"
                style={{ height: `${virtualizer.getTotalSize()}px` }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const job = merged[virtualRow.index]
                  const active = selectedId === job.id
                  return (
                    <div
                      key={job.id}
                      className="absolute left-0 top-0 w-full border-b border-transparent"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(job.id)}
                        className={cn(
                          'flex h-full w-full items-center gap-2 px-3 text-start text-sm transition-colors hover:bg-muted/60',
                          active && 'bg-muted',
                        )}
                      >
                        <span className="w-[100px] shrink-0 truncate font-mono text-xs text-muted-foreground">
                          {(job.title || job.url || '').slice(0, 18)}
                        </span>
                        <Badge variant="outline" className="shrink-0 capitalize">
                          {job.engine || 'ytdlp'}
                        </Badge>
                        <Badge variant="secondary" className="shrink-0 capitalize">
                          {job.media_kind || 'other'}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate">{job.title || job.url}</span>
                        <span className="w-16 shrink-0 text-end text-xs">{job.progress ?? 0}%</span>
                        <span className="hidden w-24 shrink-0 text-end text-xs text-muted-foreground sm:block">
                          {formatBytes(job.bytes_downloaded || job.file_size || 0)}
                        </span>
                        <Badge className="w-24 shrink-0 justify-center capitalize" variant="secondary">
                          {job.status}
                        </Badge>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Panel>
        <PanelResizeSeparator className="group relative w-2 bg-border transition-colors hover:bg-primary/30">
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
        </PanelResizeSeparator>
        <Panel defaultSize={38} minSize={22} className="min-w-0 overflow-auto border-l bg-muted/20 p-4">
          {selected ? (
            <motion.div initial={{ opacity: 0.92 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <Card>
              <CardHeader>
                <CardTitle className="line-clamp-2 text-base">{selected.title || t('queue.untitled')}</CardTitle>
                <CardDescription className="break-all font-mono text-xs">{selected.url}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{selected.engine}</Badge>
                  <Badge variant="secondary">{selected.media_kind}</Badge>
                  <Badge>{selected.status}</Badge>
                </div>
                <Separator />
                <div className="grid gap-1 text-muted-foreground">
                  <div>
                    {t('queue.size')}: {formatBytes(selected.file_size || selected.bytes_downloaded || 0)}
                    {selected.expected_size ? (
                      <span> / {formatBytes(selected.expected_size)}</span>
                    ) : null}
                  </div>
                  <div>
                    {t('queue.speed')}: {selected.speed || '—'} · ETA: {selected.eta || '—'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/jobs/${selected.id}`}>{t('queue.openJobPage')}</Link>
                  </Button>
                  {selected.engine === 'http' && selected.status === 'downloading' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await api.post(`/downloads/${selected.id}/pause/`)
                          toast.success(t('queue.paused'))
                          load()
                        } catch (e) {
                          toast.error(e.response?.data?.detail || 'Pause failed')
                        }
                      }}
                    >
                      <Pause className="size-4" /> {t('queue.pause')}
                    </Button>
                  ) : null}
                  {selected.engine === 'http' && selected.status === 'paused' ? (
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await api.post(`/downloads/${selected.id}/resume/`)
                          toast.success(t('queue.resumed'))
                          load()
                        } catch (e) {
                          toast.error(e.response?.data?.detail || 'Resume failed')
                        }
                      }}
                    >
                      <Play className="size-4" /> {t('queue.resume')}
                    </Button>
                  ) : null}
                  {['error', 'cancelled'].includes(selected.status) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await api.post(`/downloads/${selected.id}/retry/`)
                          toast.success(t('queue.retryQueued'))
                          load()
                        } catch (e) {
                          toast.error(e.response?.data?.detail || 'Retry failed')
                        }
                      }}
                    >
                      <RefreshCw className="size-4" /> {t('queue.retry')}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      try {
                        await api.delete(`/downloads/${selected.id}/`)
                        toast.success(t('queue.cancelled'))
                        setSelectedId(null)
                        load()
                      } catch {
                        toast.error(t('queue.cancelFailed'))
                      }
                    }}
                  >
                    <Trash2 className="size-4" /> {t('queue.cancelJob')}
                  </Button>
                </div>
              </CardContent>
              </Card>
            </motion.div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('queue.selectHint')}</p>
          )}
        </Panel>
      </Group>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder={t('queue.cmdSearch')} />
        <CommandList>
          <CommandGroup heading={t('queue.cmdActions')}>
            <CommandItem
              onSelect={() => {
                setCmdOpen(false)
                load()
              }}
            >
              {t('queue.refresh')}
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCmdOpen(false)
                openReorder()
              }}
            >
              {t('queue.reorder')}
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCmdOpen(false)
                parentRef.current?.focus()
              }}
            >
              {t('queue.focusList')}
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading={t('queue.navigate')}>
            <CommandItem
              onSelect={() => {
                setCmdOpen(false)
                navigate('/bulk-add')
              }}
            >
              {t('queue.goBulkAdd')}
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCmdOpen(false)
                navigate('/analyze')
              }}
            >
              {t('queue.goAnalyze')}
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCmdOpen(false)
                navigate('/playlists')
              }}
            >
              {t('queue.goPlaylists')}
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCmdOpen(false)
                navigate('/dashboard')
              }}
            >
              Dashboard
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCmdOpen(false)
                navigate('/history')
              }}
            >
              History
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <Sheet open={reorderOpen} onOpenChange={setReorderOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('queue.reorderTitle')}</SheetTitle>
            <SheetDescription>{t('queue.reorderHint')}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 min-h-0 flex-1 overflow-auto pr-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2">
                  {orderIds.map((id) => {
                    const job = merged.find((j) => String(j.id) === id)
                    return (
                      <SortableQueueRow
                        key={id}
                        id={id}
                        label={job?.title || job?.url || id}
                        subtitle={job?.status}
                      />
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          <div className="mt-4 flex gap-2 border-t pt-4">
            <Button className="flex-1" onClick={saveReorder}>
              {t('queue.saveOrder')}
            </Button>
            <Button variant="outline" onClick={() => setReorderOpen(false)}>
              {t('queue.close')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
