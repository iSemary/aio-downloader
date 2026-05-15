import { describe, it, expect } from 'vitest'
import en from '@/locales/en.json'
import de from '@/locales/de.json'
import ar from '@/locales/ar.json'

function flattenKeys(obj, prefix = '') {
  const keys = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...flattenKeys(obj[key], fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

describe('Locale consistency', () => {
  const enKeys = new Set(flattenKeys(en))
  const deKeys = new Set(flattenKeys(de))
  const arKeys = new Set(flattenKeys(ar))

  it('de.json has all keys from en.json', () => {
    const missing = [...enKeys].filter((k) => !deKeys.has(k))
    expect(missing, `Missing German keys: ${missing.join(', ')}`).toHaveLength(0)
  })

  it('ar.json has all keys from en.json', () => {
    const missing = [...enKeys].filter((k) => !arKeys.has(k))
    expect(missing, `Missing Arabic keys: ${missing.join(', ')}`).toHaveLength(0)
  })

  it('table section has all required keys in all locales', () => {
    const required = ['noRecords', 'search', 'searchPlaceholder', 'loading']
    for (const key of required) {
      expect(en.layout.table).toHaveProperty(key)
      expect(de.layout.table).toHaveProperty(key)
      expect(ar.layout.table).toHaveProperty(key)
    }
  })
})
