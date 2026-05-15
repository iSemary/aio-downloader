import { create } from 'zustand'

export const useDownloadStore = create((set) => ({
  activeJobs: {},
  upsertJob: (job) =>
    set((s) => ({
      activeJobs: { ...s.activeJobs, [job.id]: { ...s.activeJobs[job.id], ...job } },
    })),
  updateJobProgress: (id, data) =>
    set((s) => ({
      activeJobs: {
        ...s.activeJobs,
        [id]: { ...(s.activeJobs[id] || { id }), ...data },
      },
    })),
  removeJob: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.activeJobs
      return { activeJobs: rest }
    }),
  clearFinished: () =>
    set((s) => {
      const next = { ...s.activeJobs }
      for (const k of Object.keys(next)) {
        if (next[k]?.status === 'done' || next[k]?.status === 'error' || next[k]?.status === 'cancelled') {
          delete next[k]
        }
      }
      return { activeJobs: next }
    }),
}))
