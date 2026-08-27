import { randomUUID } from 'node:crypto'
import { logger } from './logger.js'

const auditEntries = new Map<string, { id: string; timestamp: string; event: string; meta: Record<string, unknown> }>()

export function recordAudit(event: string, meta: Record<string, unknown> = {}) {
  const entry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    event,
    meta: Object.fromEntries(Object.entries(meta).map(([key, value]) => [key, value])),
  }

  auditEntries.set(entry.id, entry)
  logger.audit(event, { ...entry.meta, auditId: entry.id })
  return entry
}

export function getAuditEntries(limit = 50) {
  return [...auditEntries.values()].slice(-limit)
}

export function clearAuditEntries() {
  auditEntries.clear()
}
