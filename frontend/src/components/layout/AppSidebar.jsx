import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
  Clock,
  Download,
  EllipsisVertical,
  FileArchive,
  FileText,
  Globe,
  HardDrive,
  History,
  Image,
  LayoutDashboard,
  Library,
  ListOrdered,
  ListPlus,
  LogOut,
  Music,
  ScanSearch,
  Settings,
  Timer,
  Video,
  Webcam,
} from 'lucide-react'
import { LogoMark } from '@/components/layout/LogoMark'
import { useAuthStore } from '@/store/useAuthStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'

export const downloadItems = [
  { to: '/downloads', key: 'all', icon: Download },
  { to: '/downloads?filter=unfinished', key: 'unfinished', icon: Clock },
  { to: '/downloads?filter=finished', key: 'finished', icon: CheckCircle2 },
  { to: '/downloads?filter=scheduled', key: 'scheduled', icon: Timer },
]

export const categoryItems = [
  { to: '/downloads?category=videos', key: 'videos', icon: Video },
  { to: '/downloads?category=music', key: 'music', icon: Music },
  { to: '/downloads?category=images', key: 'images', icon: Image },
  { to: '/downloads?category=compressed', key: 'compressed', icon: FileArchive },
  { to: '/downloads?category=documents', key: 'documents', icon: FileText },
  { to: '/downloads?category=programs', key: 'programs', icon: Webcam },
]

export const automationItems = [
  { to: '/grabber', key: 'grabber', icon: ScanSearch },
  { to: '/sites', key: 'sites', icon: Globe },
]

export const navItems = [
  { to: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { to: '/queue', key: 'queue', icon: ListOrdered },
  { to: '/bulk-add', key: 'bulkAdd', icon: ListPlus },
  { to: '/analyze', key: 'analyze', icon: ScanSearch },
  { to: '/playlists', key: 'playlists', icon: Library },
  { to: '/history', key: 'history', icon: History },
  { to: '/storage', key: 'storage', icon: HardDrive },
  { to: '/settings', key: 'settings', icon: Settings },
]

export function AppSidebar({ side = 'left', ...props }) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { isMobile } = useSidebar()
  const rtl = (i18n.resolvedLanguage || i18n.language || '').startsWith('ar')
  const dropdownSide = isMobile ? 'bottom' : side === 'right' ? 'left' : 'right'

  return (
    <Sidebar collapsible="icon" side={side} dir={rtl ? 'rtl' : 'ltr'} {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Download className="size-4" aria-hidden />
                </div>
                <div className="grid min-w-0 flex-1 text-start text-sm leading-tight">
                  <span className="truncate font-medium">{t('layout.appName')}</span>
                  <span className="truncate text-xs text-muted-foreground">{t('layout.tagline')}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('layout.groupDownloads')}</SidebarGroupLabel>
           <SidebarMenu>
             {downloadItems.map(({ to, key, icon: Icon }) => (
               <SidebarMenuItem key={to}>
                 <SidebarMenuButton asChild tooltip={t(`layout.downloads.${key}`)} isActive={location.pathname + location.search === to}>
                   <Link to={to}>
                     <Icon />
                     <span>{t(`layout.downloads.${key}`)}</span>
                   </Link>
                 </SidebarMenuButton>
               </SidebarMenuItem>
             ))}
           </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>{t('layout.groupCategories')}</SidebarGroupLabel>
           <SidebarMenu>
             {categoryItems.map(({ to, key, icon: Icon }) => (
               <SidebarMenuItem key={to}>
                 <SidebarMenuButton asChild tooltip={t(`layout.categories.${key}`)} isActive={location.pathname + location.search === to}>
                   <Link to={to}>
                     <Icon />
                     <span>{t(`layout.categories.${key}`)}</span>
                   </Link>
                 </SidebarMenuButton>
               </SidebarMenuItem>
             ))}
           </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>{t('layout.groupAutomation')}</SidebarGroupLabel>
          <SidebarMenu>
            {automationItems.map(({ to, key, icon: Icon }) => (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton asChild tooltip={t(`layout.automation.${key}`)} isActive={location.pathname === to}>
                  <Link to={to}>
                    <Icon />
                    <span>{t(`layout.automation.${key}`)}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>{t('layout.groupMain')}</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map(({ to, key, icon: Icon }) => (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton asChild tooltip={t(`layout.nav.${key}`)} isActive={location.pathname === to}>
                  <Link to={to}>
                    <Icon />
                    <span>{t(`layout.nav.${key}`)}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
                >
                  <LogoMark className="size-8 rounded-lg" email={user?.email} />
                  <div className="grid min-w-0 flex-1 text-start text-sm leading-tight">
                    <span className="truncate font-medium">{user?.email?.split('@')[0] || 'User'}</span>
                    <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                  <EllipsisVertical className="ms-auto size-4 shrink-0" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={dropdownSide}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                    <LogoMark className="size-8 rounded-lg" email={user?.email} />
                    <div className="grid min-w-0 flex-1 text-start text-sm leading-tight">
                      <span className="truncate font-medium">{t('layout.userMenu')}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link to="/settings">
                    <Settings className="size-4" />
                    {t('layout.nav.settings')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                >
                  <LogOut className="size-4" />
                  {t('layout.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
