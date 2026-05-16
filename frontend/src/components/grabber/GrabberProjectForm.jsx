import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

const projectSchema = z.object({
  name: z.string().min(1, 'Required'),
  start_url: z.string().url('Must be a valid URL'),
  max_depth: z.coerce.number().int().min(0).max(10).default(3),
  max_pages: z.coerce.number().int().min(1).max(10000).default(500),
  max_files: z.coerce.number().int().min(1).max(50000).default(2000),
  concurrency: z.coerce.number().int().min(1).max(20).default(3),
  crawl_delay: z.coerce.number().min(0).max(60).default(1),
  respect_robots_txt: z.boolean().default(true),
  use_javascript: z.boolean().default(false),
  rewrite_links: z.boolean().default(false),
  schedule_cron: z.string().optional(),
})

const defaultValues = {
  name: '',
  start_url: '',
  max_depth: 3,
  max_pages: 500,
  max_files: 2000,
  concurrency: 3,
  crawl_delay: 1,
  respect_robots_txt: true,
  use_javascript: false,
  rewrite_links: false,
  schedule_cron: '',
}

export default function GrabberProjectForm({ open, onOpenChange, project, onSubmit, loading }) {
  const { t } = useTranslation()
  const isEdit = !!project

  const form = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: project ? {
      name: project.name,
      start_url: project.start_url,
      max_depth: project.max_depth,
      max_pages: project.max_pages,
      max_files: project.max_files,
      concurrency: project.concurrency,
      crawl_delay: project.crawl_delay,
      respect_robots_txt: project.respect_robots_txt,
      use_javascript: project.use_javascript,
      rewrite_links: project.rewrite_links,
      schedule_cron: project.schedule_cron || '',
    } : defaultValues,
  })

  const urlValue = form.watch('start_url')

  useEffect(() => {
    if (isEdit) return
    try {
      const url = new URL(urlValue)
      const hostname = url.hostname
      const currentName = form.getValues('name')
      if (hostname && !currentName) {
        form.setValue('name', hostname, { shouldValidate: false })
      }
    } catch {
      // invalid URL, do nothing
    }
  }, [urlValue, isEdit, form])

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit(data)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('grabber.editProject') : t('grabber.newProject')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('grabber.editProjectDesc') : t('grabber.newProjectDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t('grabber.startUrl')}</Label>
              <Input {...form.register('start_url')} placeholder="https://example.com" autoFocus={!isEdit} />
              {form.formState.errors.start_url && <p className="text-xs text-destructive">{form.formState.errors.start_url.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>{t('grabber.projectName')}</Label>
              <Input {...form.register('name')} placeholder={t('grabber.projectNamePlaceholder')} />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('grabber.maxDepth')}</Label>
              <Input type="number" {...form.register('max_depth')} min={0} max={10} />
            </div>
            <div className="space-y-2">
              <Label>{t('grabber.concurrency')}</Label>
              <Input type="number" {...form.register('concurrency')} min={1} max={20} />
            </div>
            <div className="space-y-2">
              <Label>{t('grabber.maxPages')}</Label>
              <Input type="number" {...form.register('max_pages')} min={1} max={10000} />
            </div>
            <div className="space-y-2">
              <Label>{t('grabber.maxFiles')}</Label>
              <Input type="number" {...form.register('max_files')} min={1} max={50000} />
            </div>
            <div className="space-y-2">
              <Label>{t('grabber.crawlDelay')}</Label>
              <Input type="number" step={0.1} {...form.register('crawl_delay')} min={0} max={60} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('grabber.schedule')}</Label>
            <Input {...form.register('schedule_cron')} placeholder="0 2 * * * (daily at 2 AM)" />
            <p className="text-xs text-muted-foreground">{t('grabber.scheduleHint')}</p>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('grabber.respectRobots')}</Label>
                <p className="text-xs text-muted-foreground">{t('grabber.respectRobotsHint')}</p>
              </div>
              <Switch checked={form.watch('respect_robots_txt')} onCheckedChange={(v) => form.setValue('respect_robots_txt', v)} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('grabber.useJavascript')}</Label>
                <p className="text-xs text-muted-foreground">{t('grabber.useJavascriptHint')}</p>
              </div>
              <Switch checked={form.watch('use_javascript')} onCheckedChange={(v) => form.setValue('use_javascript', v)} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('grabber.rewriteLinks')}</Label>
                <p className="text-xs text-muted-foreground">{t('grabber.rewriteLinksHint')}</p>
              </div>
              <Switch checked={form.watch('rewrite_links')} onCheckedChange={(v) => form.setValue('rewrite_links', v)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (isEdit ? t('saving') : t('creating')) : (isEdit ? t('save') : t('create'))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
