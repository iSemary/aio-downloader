import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'

export function PrivateRoute({ children }) {
  const access = useAuthStore((s) => s.access)
  const loc = useLocation()
  if (!access) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }
  return children
}
