/** Parse yt-dlp / human-readable speed strings to bytes per second. */

import { formatBytes } from './formatBytes'

export function parseSpeedStrToBps(s) {
  if (s == null || typeof s !== 'string') return null
  const m = s.match(/([\d.]+)\s*([KMGTPE]?)(i)?\s*B\s*\/\s*s/i)
  if (!m) return null
  const val = parseFloat(m[1])
  if (!Number.isFinite(val)) return null
  const unit = (m[2] || '').toUpperCase()
  const isIec = Boolean(m[3])
  const mult = isIec ? 1024 : 1000
  const powMap = { '': 0, K: 1, M: 2, G: 3, T: 4, P: 5, E: 6 }
  const p = powMap[unit]
  if (p === undefined) return null
  return val * mult ** p
}

/** Sum parsed speeds for jobs currently in `downloading` state. */
export function sumActiveDownloadSpeedBps(activeJobs) {
  let sum = 0
  for (const j of Object.values(activeJobs)) {
    if (j?.status !== 'downloading') continue
    const b = parseSpeedStrToBps(j.speed)
    if (b != null) sum += b
  }
  return sum
}

export function formatBps(bps) {
  if (bps == null || !Number.isFinite(bps) || bps <= 0) return null
  return `${formatBytes(bps)}/s`
}
