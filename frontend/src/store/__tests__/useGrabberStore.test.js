import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, cleanup, act } from '@testing-library/react'

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const { useGrabberStore } = await import('../useGrabberStore')

describe('useGrabberStore', () => {
  beforeEach(() => {
    act(() => {
      useGrabberStore.setState({
        projects: [],
        currentProject: null,
        files: [],
        loading: false,
        error: null,
      })
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('has initial state', () => {
    const { result } = renderHook(() => useGrabberStore())
    expect(result.current.projects).toEqual([])
    expect(result.current.currentProject).toBeNull()
    expect(result.current.files).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('setCurrentProject updates currentProject', () => {
    const { result } = renderHook(() => useGrabberStore())
    const project = { id: '1', name: 'Test', start_url: 'https://example.com' }
    act(() => {
      result.current.setCurrentProject(project)
    })
    expect(result.current.currentProject).toEqual(project)
  })

  it('deleteProject removes project from list', async () => {
    const project = { id: '1', name: 'Test', start_url: 'https://example.com' }
    act(() => {
      useGrabberStore.setState({ projects: [project] })
    })

    const { result } = renderHook(() => useGrabberStore())
    const { api } = await import('@/api/client')
    api.delete.mockResolvedValue({})

    await act(async () => {
      await result.current.deleteProject('1')
    })

    expect(api.delete).toHaveBeenCalledWith('/grabber/projects/1/')
    expect(result.current.projects).toEqual([])
  })

  it('startProject updates status to crawling', async () => {
    const project = { id: '1', name: 'Test', start_url: 'https://example.com', status: 'idle' }
    act(() => {
      useGrabberStore.setState({ projects: [project] })
    })

    const { result } = renderHook(() => useGrabberStore())
    const { api } = await import('@/api/client')
    api.post.mockResolvedValue({})

    await act(async () => {
      await result.current.startProject('1')
    })

    expect(api.post).toHaveBeenCalledWith('/grabber/projects/1/start/')
    expect(result.current.projects[0].status).toBe('crawling')
  })

  it('stopProject updates status to idle', async () => {
    const project = { id: '1', name: 'Test', start_url: 'https://example.com', status: 'crawling' }
    act(() => {
      useGrabberStore.setState({ projects: [project] })
    })

    const { result } = renderHook(() => useGrabberStore())
    const { api } = await import('@/api/client')
    api.post.mockResolvedValue({})

    await act(async () => {
      await result.current.stopProject('1')
    })

    expect(result.current.projects[0].status).toBe('idle')
  })

  it('createProject adds project to list', async () => {
    const newProject = { id: '2', name: 'New', start_url: 'https://example.com' }
    const { api } = await import('@/api/client')
    api.post.mockResolvedValue({ data: newProject })

    const { result } = renderHook(() => useGrabberStore())

    await act(async () => {
      await result.current.createProject({ name: 'New', start_url: 'https://example.com' })
    })

    expect(api.post).toHaveBeenCalledWith('/grabber/projects/', { name: 'New', start_url: 'https://example.com' })
    expect(result.current.projects).toHaveLength(1)
    expect(result.current.projects[0].id).toBe('2')
  })

  it('updateProject updates project in list and currentProject', async () => {
    const project = { id: '1', name: 'Old', start_url: 'https://example.com' }
    act(() => {
      useGrabberStore.setState({ projects: [project], currentProject: project })
    })

    const { api } = await import('@/api/client')
    const updated = { id: '1', name: 'Updated', start_url: 'https://example.com' }
    api.patch.mockResolvedValue({ data: updated })

    const { result } = renderHook(() => useGrabberStore())

    await act(async () => {
      await result.current.updateProject('1', { name: 'Updated' })
    })

    expect(result.current.projects[0].name).toBe('Updated')
    expect(result.current.currentProject.name).toBe('Updated')
  })

  it('fetchFiles stores files', async () => {
    const filesData = [{ id: 'f1', file_name: 'test.mp4' }]
    const { api } = await import('@/api/client')
    api.get.mockResolvedValue({ data: { results: filesData } })

    const { result } = renderHook(() => useGrabberStore())

    await act(async () => {
      await result.current.fetchFiles('1', { page_size: 50 })
    })

    expect(api.get).toHaveBeenCalledWith('/grabber/projects/1/files/', { params: { page_size: 50 } })
    expect(result.current.files).toEqual(filesData)
  })

  it('creates filter', async () => {
    const { api } = await import('@/api/client')
    const filter = { id: 'ft1', filter_type: 'include', target: 'file_type', pattern: '*.mp4' }
    api.post.mockResolvedValue({ data: filter })

    const { result } = renderHook(() => useGrabberStore())

    let data
    await act(async () => {
      data = await result.current.createFilter('1', { filter_type: 'include', target: 'file_type', pattern: '*.mp4' })
    })
    expect(data).toEqual(filter)
  })

  it('queues download', async () => {
    const { api } = await import('@/api/client')
    api.post.mockResolvedValue({})

    const { result } = renderHook(() => useGrabberStore())

    await act(async () => {
      await result.current.queueDownload('1', 'f1')
    })
    expect(api.post).toHaveBeenCalledWith('/grabber/projects/1/files/f1/download/')
  })

  it('queues bulk download', async () => {
    const { api } = await import('@/api/client')
    api.post.mockResolvedValue({ data: { queued_count: 3 } })

    const { result } = renderHook(() => useGrabberStore())

    let res
    await act(async () => {
      res = await result.current.queueBulkDownload('1', ['f1', 'f2', 'f3'])
    })
    expect(api.post).toHaveBeenCalledWith('/grabber/projects/1/files/download-bulk/', { file_ids: ['f1', 'f2', 'f3'] })
    expect(res.queued_count).toBe(3)
  })

  it('deletes file from local state', async () => {
    const { api } = await import('@/api/client')
    api.delete.mockResolvedValue({})

    act(() => {
      useGrabberStore.setState({ files: [{ id: 'f1' }, { id: 'f2' }] })
    })

    const { result } = renderHook(() => useGrabberStore())

    await act(async () => {
      await result.current.deleteFile('1', 'f1')
    })
    expect(api.delete).toHaveBeenCalledWith('/grabber/projects/1/files/f1/')
    expect(result.current.files).toHaveLength(1)
  })
})
