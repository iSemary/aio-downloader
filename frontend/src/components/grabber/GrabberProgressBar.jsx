import { useTranslation } from 'react-i18next'
import { Progress } from '@/components/ui/progress'

export default function GrabberProgressBar({ pagesCrawled, maxPages, filesDiscovered, filesDownloaded, isActive }) {
  const { t } = useTranslation()
  const progress = maxPages > 0 ? Math.min(100, Math.round((pagesCrawled / maxPages) * 100)) : 0

  if (!isActive && progress === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('grabber.crawlProgress')}</span>
        <span>{progress}%</span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>{t('grabber.pages')}: {pagesCrawled} / {maxPages}</span>
        <span>{t('grabber.filesFound')}: {filesDiscovered}</span>
        <span>{t('grabber.filesDownloaded')}: {filesDownloaded}</span>
      </div>
    </div>
  )
}
