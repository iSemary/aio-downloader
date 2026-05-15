import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, cleanup, act } from '@testing-library/react'
import { useDownloadStore } from '../useDownloadStore'

describe('useDownloadStore', () => {
  beforeEach(() => {
    act(() => {
      useDownloadStore.setState({
        jobs: [],
        activeJobs: [],
        queue: [],
        history: [],
        loading: false,
        error: null,
      })
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('has initial empty state', () => {
    const { result } = renderHook(() => useDownloadStore())
    expect(result.current.jobs).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('setJobs updates jobs array', () => {
    const { result } = renderHook(() => useDownloadStore())
    const testJobs = [{ id: '1', title: 'Job 1', status: 'pending' }]

    act(() => {
      result.current.setJobs(testJobs)
    })

    expect(result.current.jobs).toEqual(testJobs)
  })

  it('addJob adds to jobs array', () => {
    const { result } = renderHook(() => useDownloadStore())

    act(() => {
      result.current.setJobs([{ id: '1', title: 'Job 1' }])
      result.current.addJob({ id: '2', title: 'Job 2' })
    })

    expect(result.current.jobs.length).toBe(2)
  })

  it('updateJob updates existing job', () => {
    const { result } = renderHook(() => useDownloadStore())

    act(() => {
      useDownloadStore.setState({
        jobs: [
          { id: '1', title: 'Job 1', status: 'pending' },
          { id: '2', title: 'Job 2', status: 'pending' },
        ],
      })
    })

    act(() => {
      result.current.updateJob('1', { status: 'downloading', progress: 50 })
    })

    const updatedJob = result.current.jobs.find((j) => j.id === '1')
    expect(updatedJob.status).toBe('downloading')
    expect(updatedJob.progress).toBe(50)
  })

  it('removeJob removes job from array', () => {
    const { result } = renderHook(() => useDownloadStore())

    act(() => {
      useDownloadStore.setState({
        jobs: [
          { id: '1', title: 'Job 1' },
          { id: '2', title: 'Job 2' },
        ],
      })
    })

    act(() => {
      result.current.removeJob('1')
    })

    expect(result.current.jobs.length).toBe(1)
    expect(result.current.jobs[0].id).toBe('2')
  })

  it('setLoading updates loading state', () => {
    const { result } = renderHook(() => useDownloadStore())

    act(() => {
      result.current.setLoading(true)
    })

    expect(result.current.loading).toBe(true)

    act(() => {
      result.current.setLoading(false)
    })

    expect(result.current.loading).toBe(false)
  })

  it('setError updates error state', () => {
    const { result } = renderHook(() => useDownloadStore())

    act(() => {
      result.current.setError('Test error message')
    })

    expect(result.current.error).toBe('Test error message')

    act(() => {
      result.current.setError(null)
    })

    expect(result.current.error).toBeNull()
  })

  it('clearAll resets state', () => {
    const { result } = renderHook(() => useDownloadStore())

    act(() => {
      useDownloadStore.setState({
        jobs: [{ id: '1' }],
        activeJobs: [{ id: '2' }],
        loading: true,
        error: 'error',
      })
    })

    act(() => {
      result.current.clearAll()
    })

    expect(result.current.jobs).toEqual([])
    expect(result.current.activeJobs).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})