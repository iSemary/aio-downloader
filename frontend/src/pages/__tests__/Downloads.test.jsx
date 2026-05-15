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
})
