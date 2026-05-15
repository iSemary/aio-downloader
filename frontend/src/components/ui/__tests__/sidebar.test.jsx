import { describe, it, expect, vi } from 'vitest'

describe('Sidebar exports and constants', () => {
  it('exports SidebarProvider', async () => {
    const module = await import('../sidebar')
    expect(module.SidebarProvider).toBeDefined()
  })

  it('exports Sidebar', async () => {
    const module = await import('../sidebar')
    expect(module.Sidebar).toBeDefined()
  })

  it('exports SidebarContent', async () => {
    const module = await import('../sidebar')
    expect(module.SidebarContent).toBeDefined()
  })

  it('exports useSidebar hook', async () => {
    const module = await import('../sidebar')
    expect(module.useSidebar).toBeDefined()
  })

  it('SIDEBAR_WIDTH is 13rem', async () => {
    const { SIDEBAR_WIDTH } = await import('../sidebar')
    expect(SIDEBAR_WIDTH).toBe('13rem')
  })

  it('SIDEBAR_MIN_WIDTH is 13rem', async () => {
    const { SIDEBAR_MIN_WIDTH } = await import('../sidebar')
    expect(SIDEBAR_MIN_WIDTH).toBe('13rem')
  })

  it('SIDEBAR_MAX_WIDTH is 24rem', async () => {
    const { SIDEBAR_MAX_WIDTH } = await import('../sidebar')
    expect(SIDEBAR_MAX_WIDTH).toBe('24rem')
  })

  it('SIDEBAR_WIDTH_ICON is 3rem', async () => {
    const { SIDEBAR_WIDTH_ICON } = await import('../sidebar')
    expect(SIDEBAR_WIDTH_ICON).toBe('3rem')
  })
})