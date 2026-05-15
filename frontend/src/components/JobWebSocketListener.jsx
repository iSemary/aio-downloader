import { useJobWebSocket } from '@/hooks/useJobWebSocket'

export function JobWebSocketListener({ jobId }) {
  useJobWebSocket(jobId)
  return null
}
