import { create } from 'zustand'

/** Shared snapshot for app header (pulse + fetch health). Updated from AppLayout polling and dashboard refresh. */
export const useDashboardHeaderStore = create((set) => ({
  hasFetched: false,
  lastFetchOk: false,
  lastSuccessAt: null,
  pulseDownloadingCount: 0,
  nextPending: null,
  reset: () =>
    set({
      hasFetched: false,
      lastFetchOk: false,
      lastSuccessAt: null,
      pulseDownloadingCount: 0,
      nextPending: null,
    }),
  setFromDashboardResponse: (data) =>
    set({
      hasFetched: true,
      lastFetchOk: true,
      lastSuccessAt: Date.now(),
      pulseDownloadingCount: data?.pulse?.downloading_count ?? 0,
      nextPending: data?.pulse?.next_pending ?? null,
    }),
  setDashboardFetchFailed: () =>
    set({
      hasFetched: true,
      lastFetchOk: false,
    }),
}))
