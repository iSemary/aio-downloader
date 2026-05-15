import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, cleanup, act } from '@testing-library/react'
import { useAuthStore } from '../useAuthStore'

describe('useAuthStore', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      })
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('has initial state with null user', () => {
    const { result } = renderHook(() => useAuthStore())
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('login sets user and tokens', () => {
    const { result } = renderHook(() => useAuthStore())
    const testUser = { id: '1', email: 'test@example.com' }

    act(() => {
      result.current.login(testUser, 'access-token', 'refresh-token')
    })

    expect(result.current.user).toEqual(testUser)
    expect(result.current.accessToken).toBe('access-token')
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('logout clears user and tokens', () => {
    const { result } = renderHook(() => useAuthStore())

    act(() => {
      useAuthStore.setState({
        user: { id: '1', email: 'test@example.com' },
        accessToken: 'token',
        isAuthenticated: true,
      })
    })

    act(() => {
      result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(result.current.accessToken).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('updateUser updates user data', () => {
    const { result } = renderHook(() => useAuthStore())

    act(() => {
      useAuthStore.setState({
        user: { id: '1', email: 'test@example.com', firstName: 'John' },
      })
    })

    act(() => {
      result.current.updateUser({ firstName: 'Jane', lastName: 'Doe' })
    })

    expect(result.current.user.firstName).toBe('Jane')
    expect(result.current.user.lastName).toBe('Doe')
  })

  it('setTokens updates only tokens', () => {
    const { result } = renderHook(() => useAuthStore())

    act(() => {
      useAuthStore.setState({
        user: { id: '1', email: 'test@example.com' },
        accessToken: 'old-token',
      })
    })

    act(() => {
      result.current.setTokens('new-access', 'new-refresh')
    })

    expect(result.current.accessToken).toBe('new-access')
    expect(result.current.refreshToken).toBe('new-refresh')
  })
})