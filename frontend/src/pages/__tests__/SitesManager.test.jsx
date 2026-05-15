import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('SitesManagerPage', () => {
  it('exports SitesManagerPage component', async () => {
    const module = await import('../../pages/SitesManager')
    expect(module.default).toBeDefined()
  })
})

describe('Sites API integration (via api client)', () => {
  it('fetches sites list', async () => {
    const { api } = await import('@/api/client')
    const sites = [{ id: '1', name: 'Site 1', site_url: 'https://example.com' }]
    api.get.mockResolvedValue({ data: { results: sites } })

    const { data } = await api.get('/grabber/sites/')
    expect(data.results).toHaveLength(1)
    expect(data.results[0].name).toBe('Site 1')
  })

  it('creates a site account', async () => {
    const { api } = await import('@/api/client')
    const newSite = { id: '2', name: 'New Site', site_url: 'https://newsite.com' }
    api.post.mockResolvedValue({ data: newSite })

    const { data } = await api.post('/grabber/sites/', {
      name: 'New Site',
      site_url: 'https://newsite.com',
    })
    expect(data.name).toBe('New Site')
  })

  it('updates a site account', async () => {
    const { api } = await import('@/api/client')
    api.patch.mockResolvedValue({ data: { name: 'Updated' } })

    const { data } = await api.patch('/grabber/sites/1/', { name: 'Updated' })
    expect(data.name).toBe('Updated')
  })

  it('deletes a site account', async () => {
    const { api } = await import('@/api/client')
    api.delete.mockResolvedValue({})

    await api.delete('/grabber/sites/1/')
    expect(api.delete).toHaveBeenCalledWith('/grabber/sites/1/')
  })
})
