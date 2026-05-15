import { describe, it, expect, vi } from 'vitest'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }) => `<a href="${to}">${children}</a>`,
  useLocation: () => ({ pathname: '/dashboard' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { id: '1', email: 'test@example.com' },
    logout: vi.fn(),
  }),
}))

describe('AppSidebar', () => {
  it('exports sidebar navigation items correctly', async () => {
    const module = await import('../AppSidebar')
    
    expect(module.downloadItems).toBeDefined()
    expect(Array.isArray(module.downloadItems)).toBe(true)
    expect(module.downloadItems.length).toBe(4)
  })

  it('download items have correct structure', async () => {
    const { downloadItems } = await import('../AppSidebar')
    
    expect(downloadItems[0]).toHaveProperty('to')
    expect(downloadItems[0]).toHaveProperty('key')
    expect(downloadItems[0]).toHaveProperty('icon')
  })

  it('download items include all statuses', async () => {
    const { downloadItems } = await import('../AppSidebar')
    const keys = downloadItems.map(item => item.key)
    
    expect(keys).toContain('all')
    expect(keys).toContain('unfinished')
    expect(keys).toContain('finished')
    expect(keys).toContain('scheduled')
  })

  it('category items are defined', async () => {
    const { categoryItems } = await import('../AppSidebar')
    
    expect(categoryItems).toBeDefined()
    expect(categoryItems.length).toBe(4)
  })

  it('automation items are defined', async () => {
    const { automationItems } = await import('../AppSidebar')
    
    expect(automationItems).toBeDefined()
    expect(automationItems.length).toBe(2)
  })

  it('nav items include main application routes', async () => {
    const { navItems } = await import('../AppSidebar')
    
    const paths = navItems.map(item => item.to)
    expect(paths).toContain('/dashboard')
    expect(paths).toContain('/queue')
    expect(paths).toContain('/history')
    expect(paths).toContain('/settings')
  })
})