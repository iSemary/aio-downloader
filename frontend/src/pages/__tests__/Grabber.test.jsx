import { describe, it, expect } from 'vitest'

describe('GrabberPage', () => {
  it('exports GrabberPage component', async () => {
    const module = await import('../../pages/Grabber')
    expect(module.default).toBeDefined()
  })
})

describe('Grabber components', () => {
  it('exports GrabberProjectCard', async () => {
    const module = await import('../../components/grabber/GrabberProjectCard')
    expect(module.default).toBeDefined()
  })

  it('exports GrabberFilterPanel', async () => {
    const module = await import('../../components/grabber/GrabberFilterPanel')
    expect(module.default).toBeDefined()
  })

  it('exports GrabberFileTable', async () => {
    const module = await import('../../components/grabber/GrabberFileTable')
    expect(module.default).toBeDefined()
  })

  it('exports GrabberFileTypeBadge', async () => {
    const module = await import('../../components/grabber/GrabberFileTypeBadge')
    expect(module.default).toBeDefined()
  })

  it('exports GrabberProgressBar', async () => {
    const module = await import('../../components/grabber/GrabberProgressBar')
    expect(module.default).toBeDefined()
  })

  it('exports GrabberProjectForm', async () => {
    const module = await import('../../components/grabber/GrabberProjectForm')
    expect(module.default).toBeDefined()
  })
})
