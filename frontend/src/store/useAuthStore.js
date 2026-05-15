import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      access: null,
      refresh: null,
      user: null,
      setAuth: (payload) =>
        set({
          access: payload.access,
          refresh: payload.refresh,
          user: payload.user ?? null,
        }),
      setTokens: (access, refresh) => set({ access, refresh }),
      setUser: (patch) =>
        set((s) => ({
          user: s.user ? { ...s.user, ...patch } : { ...patch },
        })),
      logout: () => set({ access: null, refresh: null, user: null }),
    }),
    { name: 'aio-auth-storage' },
  ),
)
