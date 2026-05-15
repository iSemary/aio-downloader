import { Moon, Sun, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useThemeStore, applyTheme } from '@/store/useThemeStore'
import { DashboardHeaderStrip } from '@/components/layout/DashboardHeaderStrip'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { useTranslation } from 'react-i18next'

export function DashboardSiteHeader({ sidebarSide = 'left' }) {
  const { t } = useTranslation()
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 py-3 lg:gap-2 lg:px-6">
        <SidebarTrigger
          className={cn(sidebarSide === 'right' ? '-me-1' : '-ms-1')}
          title={t('layout.toggleSidebar')}
        />
        <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{t('layout.appName')}</p>
          <p className="truncate text-xs text-muted-foreground">{t('layout.tagline')}</p>
        </div>
        <DashboardHeaderStrip />
        <div className="ms-auto flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <Button
            variant="outline"
            size="icon-sm"
            title={t('layout.theme')}
            onClick={() => {
              const order = ['system', 'light', 'dark']
              const i = order.indexOf(theme)
              const next = order[(i + 1) % order.length]
              setTheme(next)
              applyTheme(next)
            }}
          >
            {theme === 'dark' ? (
              <Moon className="size-4" />
            ) : theme === 'light' ? (
              <Sun className="size-4" />
            ) : (
              <Monitor className="size-4" />
            )}
            <span className="sr-only">{t('layout.theme')}</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
