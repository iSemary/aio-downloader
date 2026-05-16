import { create } from 'zustand'
import { api } from '@/api/client'

export const useGrabberStore = create((set) => ({
  projects: [],
  currentProject: null,
  files: [],
  filters: [],
  setCurrentProject: (project) => set({ currentProject: project }),
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/grabber/projects/')
      set({ projects: data.results || data, loading: false })
    } catch {
      set({ error: 'Failed to load projects', loading: false })
    }
  },

  fetchProject: async (id) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get(`/grabber/projects/${id}/`)
      set({ currentProject: data, loading: false })
      return data
    } catch {
      set({ error: 'Failed to load project', loading: false })
      return null
    }
  },

  createProject: async (payload) => {
    const { data } = await api.post('/grabber/projects/', payload)
    set((s) => ({ projects: [data, ...s.projects] }))
    return data
  },

  updateProject: async (id, payload) => {
    const { data } = await api.patch(`/grabber/projects/${id}/`, payload)
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? data : p)),
      currentProject: s.currentProject?.id === id ? data : s.currentProject,
    }))
    return data
  },

  deleteProject: async (id) => {
    await api.delete(`/grabber/projects/${id}/`)
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      currentProject: s.currentProject?.id === id ? null : s.currentProject,
    }))
  },

  startProject: async (id) => {
    await api.post(`/grabber/projects/${id}/start/`)
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, status: 'crawling' } : p)),
      currentProject: s.currentProject?.id === id ? { ...s.currentProject, status: 'crawling' } : s.currentProject,
    }))
  },

  stopProject: async (id) => {
    await api.post(`/grabber/projects/${id}/stop/`)
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, status: 'idle' } : p)),
      currentProject: s.currentProject?.id === id ? { ...s.currentProject, status: 'idle' } : s.currentProject,
    }))
  },

  pauseProject: async (id) => {
    await api.post(`/grabber/projects/${id}/pause/`)
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, status: 'paused' } : p)),
      currentProject: s.currentProject?.id === id ? { ...s.currentProject, status: 'paused' } : s.currentProject,
    }))
  },

  resumeProject: async (id) => {
    await api.post(`/grabber/projects/${id}/resume/`)
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, status: 'crawling' } : p)),
      currentProject: s.currentProject?.id === id ? { ...s.currentProject, status: 'crawling' } : s.currentProject,
    }))
  },

  fetchFiles: async (projectId, params = {}) => {
    const { data } = await api.get(`/grabber/projects/${projectId}/files/`, { params })
    set({ files: data.results || data })
    return data
  },

  fetchProjectStats: async (projectId) => {
    const { data } = await api.get(`/grabber/projects/${projectId}/stats/`)
    return data
  },

  fetchFilters: async (projectId) => {
    const { data } = await api.get(`/grabber/projects/${projectId}/filters/`)
    return data.results || data
  },

  createFilter: async (projectId, payload) => {
    const { data } = await api.post(`/grabber/projects/${projectId}/filters/`, payload)
    return data
  },

  deleteFilter: async (projectId, filterId) => {
    await api.delete(`/grabber/projects/${projectId}/filters/${filterId}/`)
  },

  queueDownload: async (projectId, fileId) => {
    await api.post(`/grabber/projects/${projectId}/files/${fileId}/download/`)
  },

  queueBulkDownload: async (projectId, fileIds) => {
    const { data } = await api.post(`/grabber/projects/${projectId}/files/download-bulk/`, { file_ids: fileIds })
    return data
  },

  deleteFile: async (projectId, fileId) => {
    await api.delete(`/grabber/projects/${projectId}/files/${fileId}/`)
    set((s) => ({ files: s.files.filter((f) => f.id !== fileId) }))
  },

  fetchLogs: async (projectId) => {
    const { data } = await api.get(`/grabber/projects/${projectId}/logs/`)
    return data
  },
}))
