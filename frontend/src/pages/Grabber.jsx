import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Globe, Loader2, Plus, ScanSearch } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGrabberStore } from '@/store/useGrabberStore'
import GrabberFilterPanel from '@/components/grabber/GrabberFilterPanel'
import GrabberFileTable from '@/components/grabber/GrabberFileTable'
import GrabberProgressBar from '@/components/grabber/GrabberProgressBar'
import GrabberProjectCard from '@/components/grabber/GrabberProjectCard'
import GrabberProjectForm from '@/components/grabber/GrabberProjectForm'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function GrabberPage() {
  const { t } = useTranslation()
  const {
    projects,
    currentProject,
    files,
    loading,
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    startProject,
    stopProject,
    pauseProject,
    resumeProject,
    fetchFiles,
    fetchProjectStats,
    fetchFilters,
    createFilter,
    deleteFilter,
    queueDownload,
    queueBulkDownload,
    deleteFile,
    setCurrentProject,
  } = useGrabberStore()

  const [view, setView] = useState('list')
  const [projectId, setProjectId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editProject, setEditProject] = useState(null)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState(null)
  const [filters, setFilters] = useState([])
  const [activeTab, setActiveTab] = useState('files')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [filesLoading, setFilesLoading] = useState(false)
  const [filterChanged, setFilterChanged] = useState(0)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    if (currentProject && view === 'detail') {
      loadProjectData(currentProject.id)
    }
  }, [currentProject?.id, view, filterChanged])

  const loadProjectData = async (id) => {
    setFilesLoading(true)
    try {
      const [statsData, filterData, filesData] = await Promise.all([
        fetchProjectStats(id).catch(() => null),
        fetchFilters(id).catch(() => []),
        fetchFiles(id, { page_size: 500 }).catch(() => ({ results: [] })),
      ])
      setStats(statsData)
      setFilters(Array.isArray(filterData) ? filterData : [])
    } finally {
      setFilesLoading(false)
    }
  }

  const openProject = useCallback(async (id) => {
    setProjectId(id)
    setView('detail')
    await fetchProject(id)
  }, [fetchProject])

  const backToList = useCallback(() => {
    setView('list')
    setProjectId(null)
    setCurrentProject(null)
    setStats(null)
  }, [])

  const handleCreate = async (data) => {
    setSaving(true)
    try {
      await createProject(data)
      setFormOpen(false)
      toast.success(t('grabber.projectCreated'))
    } catch (e) {
      toast.error(e.response?.data?.detail || t('grabber.createFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (data) => {
    if (!editProject) return
    setSaving(true)
    try {
      await updateProject(editProject.id, data)
      setFormOpen(false)
      setEditProject(null)
      toast.success(t('grabber.projectUpdated'))
    } catch (e) {
      toast.error(e.response?.data?.detail || t('grabber.updateFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleStart = async (id) => {
    try {
      await startProject(id)
      toast.success(t('grabber.crawlStarted'))
    } catch (e) {
      toast.error(e.response?.data?.detail || t('grabber.startFailed'))
    }
  }

  const handleStop = async (id) => {
    try {
      await stopProject(id)
      toast.success(t('grabber.crawlStopped'))
    } catch (e) {
      toast.error(e.response?.data?.detail || t('grabber.stopFailed'))
    }
  }

  const handlePause = async (id) => {
    try {
      await pauseProject(id)
      toast.success(t('grabber.crawlPaused'))
    } catch (e) {
      toast.error(e.response?.data?.detail || t('grabber.pauseFailed'))
    }
  }

  const handleResume = async (id) => {
    try {
      await resumeProject(id)
      toast.success(t('grabber.crawlResumed'))
    } catch (e) {
      toast.error(e.response?.data?.detail || t('grabber.resumeFailed'))
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return
    try {
      await deleteProject(deleteConfirm)
      setDeleteConfirm(null)
      if (view === 'detail' && projectId === deleteConfirm) {
        backToList()
      }
      toast.success(t('grabber.projectDeleted'))
    } catch (e) {
      toast.error(e.response?.data?.detail || t('grabber.deleteFailed'))
    }
  }

  const handleAddFilter = async (data) => {
    if (!currentProject) return
    try {
      const newFilter = await createFilter(currentProject.id, data)
      setFilters((prev) => [...prev, newFilter])
      setFilterChanged((c) => c + 1)
      toast.success(t('grabber.filterAdded'))
    } catch (e) {
      toast.error(e.response?.data?.detail || t('grabber.filterFailed'))
    }
  }

  const handleDeleteFilter = async (id) => {
    if (!currentProject) return
    try {
      await deleteFilter(currentProject.id, id)
      setFilters((prev) => prev.filter((f) => f.id !== id))
      toast.success(t('grabber.filterDeleted'))
    } catch (e) {
      toast.error(e.response?.data?.detail || t('grabber.filterFailed'))
    }
  }

  const handleFileDownload = async (fileId) => {
    if (!currentProject) return
    try {
      await queueDownload(currentProject.id, fileId)
      toast.success(t('grabber.downloadQueued'))
    } catch (e) {
      toast.error(e.response?.data?.detail || t('grabber.downloadFailed'))
    }
  }

  const handleBulkDownload = async (fileIds) => {
    if (!currentProject) return
    try {
      const result = await queueBulkDownload(currentProject.id, fileIds)
      toast.success(t('grabber.bulkQueued', { count: result.queued_count }))
    } catch (e) {
      toast.error(e.response?.data?.detail || t('grabber.downloadFailed'))
    }
  }

  const handleFileDelete = async (fileId) => {
    if (!currentProject) return
    try {
      await deleteFile(currentProject.id, fileId)
      toast.success(t('grabber.fileDeleted'))
    } catch (e) {
      toast.error(e.response?.data?.detail || t('grabber.deleteFailed'))
    }
  }

  const renderStats = () => {
    if (!stats) return null
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t('grabber.pagesCrawled'), value: stats.pages_crawled },
          { label: t('grabber.filesFound'), value: stats.files_discovered },
          { label: t('grabber.filesDownloaded'), value: stats.files_downloaded },
          { label: t('grabber.bytesDownloaded'), value: formatBytes(stats.bytes_downloaded) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-card p-3 text-center">
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    )
  }

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0
    let size = bytes
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024
      i++
    }
    return `${size.toFixed(1)} ${units[i]}`
  }

  if (view === 'detail' && currentProject) {
    const p = currentProject
    return (
      <div className="flex w-full min-w-0 flex-col gap-6">
        <div className="flex items-start gap-3">
          <Button size="icon" variant="ghost" onClick={backToList}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h5 className="truncate text-2xl font-bold tracking-tight">{p.name}</h5>
              <StatusBadge status={p.status} />
            </div>
            <p className="truncate text-sm text-muted-foreground">{p.start_url}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {p.status === 'idle' && (
            <Button onClick={() => handleStart(p.id)}>
              <Globe className="mr-1.5 size-4" /> {t('grabber.start')}
            </Button>
          )}
          {p.status === 'crawling' && (
            <>
              <Button variant="outline" onClick={() => handlePause(p.id)}>
                {t('grabber.pause')}
              </Button>
              <Button variant="destructive" onClick={() => handleStop(p.id)}>
                {t('grabber.stop')}
              </Button>
            </>
          )}
          {p.status === 'paused' && (
            <>
              <Button onClick={() => handleResume(p.id)}>
                {t('grabber.resume')}
              </Button>
              <Button variant="destructive" onClick={() => handleStop(p.id)}>
                {t('grabber.stop')}
              </Button>
            </>
          )}
          {(p.status === 'done' || p.status === 'error') && (
            <Button onClick={() => handleStart(p.id)}>
              <Globe className="mr-1.5 size-4" /> {t('grabber.restart')}
            </Button>
          )}
          <Button variant="outline" onClick={() => { setEditProject(p); setFormOpen(true) }}>
            {t('grabber.edit')}
          </Button>
          <Button variant="destructive" onClick={() => setDeleteConfirm(p.id)}>
            {t('grabber.delete')}
          </Button>
        </div>

        <GrabberProgressBar
          pagesCrawled={p.pages_crawled}
          maxPages={p.max_pages}
          filesDiscovered={p.files_discovered}
          filesDownloaded={p.files_downloaded}
          isActive={p.status === 'crawling' || p.status === 'paused'}
        />

        {renderStats()}

        <Separator />
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="files">{t('grabber.discoveredFiles')} ({stats?.files_discovered || 0})</TabsTrigger>
            <TabsTrigger value="filters">{t('grabber.filters')} ({filters.length})</TabsTrigger>
            <TabsTrigger value="settings">{t('grabber.settings')}</TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="pt-4">
            <GrabberFileTable
              files={files}
              loading={filesLoading}
              onDownload={handleFileDownload}
              onDownloadBulk={handleBulkDownload}
              onDelete={handleFileDelete}
              onRefresh={() => loadProjectData(p.id)}
            />
          </TabsContent>

          <TabsContent value="filters" className="pt-4">
            <GrabberFilterPanel
              filters={filters}
              onAdd={handleAddFilter}
              onDelete={handleDeleteFilter}
            />
          </TabsContent>

          <TabsContent value="settings" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('grabber.projectSettings')}</CardTitle>
                <CardDescription>{t('grabber.projectSettingsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: t('grabber.maxDepth'), value: p.max_depth },
                    { label: t('grabber.maxPages'), value: p.max_pages },
                    { label: t('grabber.maxFiles'), value: p.max_files },
                    { label: t('grabber.concurrency'), value: p.concurrency },
                    { label: t('grabber.crawlDelay'), value: `${p.crawl_delay}s` },
                    { label: t('grabber.userAgent'), value: p.user_agent || '-' },
                    { label: t('grabber.respectRobots'), value: p.respect_robots_txt ? t('yes') : t('no') },
                    { label: t('grabber.useJavascript'), value: p.use_javascript ? t('yes') : t('no') },
                    { label: t('grabber.rewriteLinks'), value: p.rewrite_links ? t('yes') : t('no') },
                    { label: t('grabber.schedule'), value: p.schedule_cron || t('grabber.notSet') },
                    { label: t('grabber.created'), value: new Date(p.created_at).toLocaleString() },
                    { label: t('grabber.lastUpdated'), value: new Date(p.updated_at).toLocaleString() },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <GrabberProjectForm
          open={formOpen}
          onOpenChange={(open) => { setFormOpen(open); if (!open) setEditProject(null) }}
          project={editProject}
          onSubmit={handleUpdate}
          loading={saving}
        />

        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('grabber.confirmDelete')}</AlertDialogTitle>
              <AlertDialogDescription>{t('grabber.confirmDeleteDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
                {t('grabber.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
          <ScanSearch className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h5 className="text-2xl font-bold tracking-tight text-foreground">{t('layout.automation.grabber')}</h5>
          <p className="text-pretty text-muted-foreground">{t('grabber.pageDescription')}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('grabber.projectCount', { count: projects.length })}
        </p>
        <Button onClick={() => { setEditProject(null); setFormOpen(true) }}>
          <Plus className="mr-1.5 size-4" /> {t('grabber.newProject')}
        </Button>
      </div>

      {loading && projects.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <ScanSearch className="size-12 text-muted-foreground/40" />
            <div className="text-center">
              <p className="text-lg font-medium">{t('grabber.noProjects')}</p>
              <p className="text-sm text-muted-foreground">{t('grabber.noProjectsDesc')}</p>
            </div>
            <Button onClick={() => { setEditProject(null); setFormOpen(true) }}>
              <Plus className="mr-1.5 size-4" /> {t('grabber.createFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <GrabberProjectCard
              key={project.id}
              project={project}
              onClick={openProject}
              onStart={handleStart}
              onStop={handleStop}
              onPause={handlePause}
              onResume={handleResume}
              onEdit={(p) => { setEditProject(p); setFormOpen(true) }}
              onDelete={(id) => setDeleteConfirm(id)}
            />
          ))}
        </div>
      )}

      <GrabberProjectForm
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditProject(null) }}
        project={editProject}
        onSubmit={editProject ? handleUpdate : handleCreate}
        loading={saving}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('grabber.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('grabber.confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              {t('grabber.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
