import { useTranslation } from 'react-i18next'
import { CircleCheck, CircleX, Globe, Pause, Play, Square } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

const statusIcons = {
  idle: Globe,
  crawling: Globe,
  paused: Pause,
  done: CircleCheck,
  error: CircleX,
}

export default function GrabberProjectCard({ project, onStart, onStop, onPause, onResume, onEdit, onDelete, onClick }) {
  const { t } = useTranslation()
  const Icon = statusIcons[project.status] || Globe
  const isActive = project.status === 'crawling'
  const isPaused = project.status === 'paused'
  const progress = project.max_pages > 0 ? Math.min(100, Math.round((project.pages_crawled / project.max_pages) * 100)) : 0

  return (
    <div>
      <Card
        className="cursor-pointer transition-shadow hover:shadow-md"
        onClick={() => onClick?.(project.id)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="truncate text-lg">{project.name}</CardTitle>
              <CardDescription className="truncate text-xs">{project.start_url}</CardDescription>
            </div>
            <StatusBadge status={project.status} className="shrink-0 gap-1.5">
              <Icon className="size-3" />
            </StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(isActive || isPaused) && (
            <div className="space-y-1">
              <Progress value={progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground">
                {project.pages_crawled} / {project.max_pages} {t('grabber.pages').toLowerCase()}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{project.files_discovered} {t('grabber.filesFound').toLowerCase()}</span>
            <span>{project.files_downloaded} {t('grabber.filesDownloaded').toLowerCase()}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {project.status === 'idle' && (
              <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); onStart?.(project.id) }}>
                <Play className="mr-1 size-3.5" /> {t('grabber.start')}
              </Button>
            )}
            {isActive && (
              <>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onPause?.(project.id) }}>
                  <Pause className="mr-1 size-3.5" /> {t('grabber.pause')}
                </Button>
                <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); onStop?.(project.id) }}>
                  <Square className="mr-1 size-3.5" /> {t('grabber.stop')}
                </Button>
              </>
            )}
            {isPaused && (
              <>
                <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); onResume?.(project.id) }}>
                  <Play className="mr-1 size-3.5" /> {t('grabber.resume')}
                </Button>
                <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); onStop?.(project.id) }}>
                  <Square className="mr-1 size-3.5" /> {t('grabber.stop')}
                </Button>
              </>
            )}
            {(project.status === 'done' || project.status === 'error') && (
              <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); onStart?.(project.id) }}>
                <Play className="mr-1 size-3.5" /> {t('grabber.restart')}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit?.(project) }}>
              {t('grabber.edit')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
