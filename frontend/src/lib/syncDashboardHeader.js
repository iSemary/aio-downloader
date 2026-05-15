import { api } from '@/api/client'
import { useDashboardHeaderStore } from '@/store/useDashboardHeaderStore'

/** Fetches dashboard snapshot and updates global header store. Returns `{ ok, data }` for reuse on the dashboard page. */
export async function syncDashboardHeader() {
  try {
    const { data } = await api.get('/downloads/dashboard/')
    useDashboardHeaderStore.getState().setFromDashboardResponse(data)
    return { ok: true, data }
  } catch {
    useDashboardHeaderStore.getState().setDashboardFetchFailed()
    return { ok: false, data: null }
  }
}
