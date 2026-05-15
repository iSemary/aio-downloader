import { describe, it, expect, vi } from 'vitest'

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

vi.mock('@/api/client', () => ({
  api: {
    post: vi.fn().mockResolvedValue({ data: { access: 'token', refresh: 'refresh' } }),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('Login page exports', () => {
  it('exports LoginPage component', async () => {
    const module = await import('../../pages/Login')
    expect(module.default).toBeDefined()
    expect(typeof module.default).toBe('function')
  })
})

describe('Register page exports', () => {
  it('exports RegisterPage component', async () => {
    const module = await import('../../pages/Register')
    expect(module.default).toBeDefined()
    expect(typeof module.default).toBe('function')
  })
})