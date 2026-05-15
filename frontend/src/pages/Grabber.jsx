import { useTranslation } from 'react-i18next'
import { ScanSearch } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function GrabberPage() {
  const { t } = useTranslation()

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
          <ScanSearch className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h5 className="text-2xl font-bold tracking-tight text-foreground">{t('layout.automation.grabber')}</h5>
          <p className="text-pretty text-muted-foreground">{t('layout.grabber.pageDescription')}</p>
        </div>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted ring-1 ring-border/60">
              <ScanSearch className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-xl">{t('layout.grabber.cardTitle')}</CardTitle>
              <CardDescription className="text-pretty">{t('layout.grabber.cardDescription')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">{t('layout.grabber.comingSoon')}</p>
        </CardContent>
      </Card>
    </div>
  )
}