import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'aio-theme' },
  ),
)

export function applyTheme(theme) {
  const root = document.documentElement
  root.classList.remove('dark')
  if (theme === 'dark') root.classList.add('dark')
  if (theme === 'system') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark')
  }
}
