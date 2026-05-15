import { useTranslation } from 'react-i18next'
import { FileArchive, FileAudio, FileImage, FileText, FileVideo, Globe } from 'lucide-react'

const fileTypeIcons = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  document: FileText,
  archive: FileArchive,
  other: Globe,
}

const fileTypeColors = {
  image: 'text-pink-500',
  video: 'text-purple-500',
  audio: 'text-blue-500',
  document: 'text-amber-500',
  archive: 'text-emerald-500',
  other: 'text-muted-foreground',
}

export default function GrabberFileTypeBadge({ fileType, fileName }) {
  const { t } = useTranslation()
  const Icon = fileTypeIcons[fileType] || Globe
  const color = fileTypeColors[fileType] || 'text-muted-foreground'

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <Icon className={`size-4 shrink-0 ${color}`} aria-hidden />
      <span className="truncate">{fileName}</span>
    </span>
  )
}
