import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function GrabberFilterPanel({ filters = [], onAdd, onDelete, loading }) {
  const { t } = useTranslation()
  const [filterType, setFilterType] = useState('include')
  const [target, setTarget] = useState('file_type')
  const [pattern, setPattern] = useState('')
  const [isRegex, setIsRegex] = useState(false)

  const handleAdd = () => {
    if (!pattern.trim()) return
    onAdd({ filter_type: filterType, target, pattern: pattern.trim(), is_regex: isRegex })
    setPattern('')
    setIsRegex(false)
  }

  const typeColors = {
    include: 'border-l-green-500 bg-green-50 dark:bg-green-950/20',
    exclude: 'border-l-red-500 bg-red-50 dark:bg-red-950/20',
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('grabber.filterType')}</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="include">{t('grabber.include')}</SelectItem>
              <SelectItem value="exclude">{t('grabber.exclude')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('grabber.filterTarget')}</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="file_type">{t('grabber.fileExtension')}</SelectItem>
              <SelectItem value="url">{t('grabber.urlPattern')}</SelectItem>
              <SelectItem value="domain">{t('grabber.domain')}</SelectItem>
              <SelectItem value="keyword">{t('grabber.keyword')}</SelectItem>
              <SelectItem value="file_size">{t('grabber.fileSize')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs">{t('grabber.pattern')}</Label>
          <div className="flex gap-2">
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={target === 'file_type' ? '*.mp4, *.pdf, ...' : 'pattern'}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <div className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
              <Switch checked={isRegex} onCheckedChange={setIsRegex} />
              Regex
            </div>
          </div>
        </div>
        <Button size="sm" onClick={handleAdd} disabled={!pattern.trim() || loading}>
          <Plus className="mr-1 size-3.5" /> {t('add')}
        </Button>
      </div>

      {filters.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t('grabber.noFilters')}</p>
      ) : (
        <div className="space-y-2">
          {filters.map((f) => (
            <div
              key={f.id}
              className={`flex items-center gap-3 rounded-lg border-l-4 p-3 text-sm ${typeColors[f.filter_type] || ''}`}
            >
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium uppercase ${f.filter_type === 'include' ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200' : 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'}`}>
                {f.filter_type}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{f.target}</span>
              <code className="flex-1 truncate font-mono text-xs">{f.pattern}</code>
              {f.is_regex && <span className="shrink-0 text-[10px] text-muted-foreground">REGEX</span>}
              <Button size="icon" variant="ghost" className="size-6 shrink-0" onClick={() => onDelete?.(f.id)}>
                <Trash2 className="size-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
