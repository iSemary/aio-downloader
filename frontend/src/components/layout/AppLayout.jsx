import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { DashboardSiteHeader } from '@/components/layout/DashboardSiteHeader'
import { useAuthStore } from '@/store/useAuthStore'
import { applyTheme, useThemeStore } from '@/store/useThemeStore'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export function AppLayout() {
  const { i18n } = useTranslation()
  const access = useAuthStore((s) => s.access)
  const setUser = useAuthStore((s) => s.setUser)
  const theme = useThemeStore((s) => s.theme)
  const rtl = (i18n.resolvedLanguage || i18n.language || '').startsWith('ar')
  const sidebarSide = rtl ? 'right' : 'left'

  useEffect(() => {
    if (!access) return
    api
      .get('/auth/me/')
      .then((r) => setUser(r.data))
      .catch(() => {})
  }, [access, setUser])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const inset = (
    <SidebarInset>
      <DashboardSiteHeader sidebarSide={sidebarSide} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="flex-1 px-4 lg:px-6">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
  )

  const sidebar = <AppSidebar variant="inset" side={sidebarSide} />

  return (
    <SidebarProvider
      className="min-h-svh"
      style={{
        '--header-height': '3.5rem',
      }}
    >
      {rtl ? (
        <>
          {inset}
          {sidebar}
        </>
      ) : (
        <>
          {sidebar}
          {inset}
        </>
      )}
    </SidebarProvider>
  )
}
