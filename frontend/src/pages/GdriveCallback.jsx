import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '@/api/client'

export default function GdriveCallback() {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')

      if (!code) {
        setStatus('error')
        return
      }

      try {
        await api.post('/integrations/gdrive/callback/', { code, state })
        setStatus('success')
      } catch {
        setStatus('error')
      }
    }
    handleCallback()
  }, [])

  if (status === 'success') {
    return <Navigate to="/settings" replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        {status === 'loading' && <p>Connecting to Google Drive...</p>}
        {status === 'error' && (
          <div>
            <p className="text-red-500">Failed to connect. Please try again.</p>
            <a href="/settings" className="text-blue-500 underline">
              Back to Settings
            </a>
          </div>
        )}
      </div>
    </div>
  )
}