import { describe, it, expect, vi } from 'vitest'

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [
    new URLSearchParams(),
    vi.fn(),
  ],
  Link: ({ children }) => children,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { results: [], count: 0, page_size: 15 } }),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('Downloads page exports', () => {
  it('exports DownloadsPage component', async () => {
    const module = await import('../../pages/Downloads')
    expect(module.default).toBeDefined()
    expect(typeof module.default).toBe('function')
  })

  it('exports STATUS_MAP constant', async () => {
    const { STATUS_MAP } = await import('../../pages/Downloads')
    expect(STATUS_MAP).toBeDefined()
    expect(STATUS_MAP.unfinished).toBeDefined()
    expect(STATUS_MAP.finished).toBeDefined()
    expect(STATUS_MAP.scheduled).toBeDefined()
  })

  it('STATUS_MAP has correct unfinished statuses', async () => {
    const { STATUS_MAP } = await import('../../pages/Downloads')
    expect(STATUS_MAP.unfinished).toContain('pending')
    expect(STATUS_MAP.unfinished).toContain('queued')
    expect(STATUS_MAP.unfinished).toContain('downloading')
    expect(STATUS_MAP.unfinished).toContain('processing')
    expect(STATUS_MAP.unfinished).toContain('paused')
  })

  it('STATUS_MAP has correct finished statuses', async () => {
    const { STATUS_MAP } = await import('../../pages/Downloads')
    expect(STATUS_MAP.finished).toEqual(['done'])
  })

  it('STATUS_MAP has correct scheduled statuses', async () => {
    const { STATUS_MAP } = await import('../../pages/Downloads')
    expect(STATUS_MAP.scheduled).toEqual(['pending'])
  })
})