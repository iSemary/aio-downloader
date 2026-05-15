import axios from 'axios'
import { useAuthStore } from '@/store/useAuthStore'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().access
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true
      const refresh = useAuthStore.getState().refresh
      if (refresh) {
        try {
          const { data } = await axios.post(`${baseURL}/auth/refresh/`, { refresh })
          const access = data.access
          const newRefresh = data.refresh || refresh
          useAuthStore.getState().setTokens(access, newRefresh)
          original.headers.Authorization = `Bearer ${access}`
          return api(original)
        } catch {
          /* fallthrough */
        }
      }
      useAuthStore.getState().logout()
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)
