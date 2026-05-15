import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useDownloadStore } from '@/store/useDownloadStore'

const WS_BASE = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'

export function useJobWebSocket(jobId) {
  const access = useAuthStore((s) => s.access)
  const upsert = useDownloadStore((s) => s.upsertJob)
  const update = useDownloadStore((s) => s.updateJobProgress)
  const remove = useDownloadStore((s) => s.removeJob)
  const attempts = useRef(0)

  useEffect(() => {
    if (!jobId || !access) return undefined

    let ws
    let cancelled = false
    let timer

    const connect = () => {
      if (cancelled) return
      const url = `${WS_BASE}/ws/downloads/${jobId}/?token=${encodeURIComponent(access)}`
      ws = new WebSocket(url)
      ws.onopen = () => {
        attempts.current = 0
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg.type === 'progress') {
            update(jobId, {
              status: 'downloading',
              progress: msg.percent,
              speed: msg.speed,
              eta: msg.eta,
            })
          } else if (msg.type === 'done') {
            update(jobId, {
              status: 'done',
              progress: 100,
              file_path: msg.file_path,
              file_size: msg.file_size,
              title: msg.title,
            })
            setTimeout(() => remove(jobId), 4000)
          } else if (msg.type === 'error') {
            update(jobId, { status: 'error', error_message: msg.message })
            setTimeout(() => remove(jobId), 8000)
          } else if (msg.type === 'playlist_enqueued') {
            update(jobId, { status: 'done', title: `Playlist (${msg.count} items)` })
            setTimeout(() => remove(jobId), 4000)
          }
        } catch {
          /* ignore */
        }
      }
      ws.onclose = () => {
        if (cancelled) return
        if (attempts.current < 5) {
          const delay = Math.min(30000, 1000 * 2 ** attempts.current)
          attempts.current += 1
          timer = setTimeout(connect, delay)
        }
      }
      ws.onerror = () => {
        try {
          ws.close()
        } catch {
          /* ignore */
        }
      }
    }

    upsert({ id: jobId, status: 'pending' })
    connect()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      try {
        ws?.close()
      } catch {
        /* ignore */
      }
    }
  }, [jobId, access, upsert, update, remove])
}
