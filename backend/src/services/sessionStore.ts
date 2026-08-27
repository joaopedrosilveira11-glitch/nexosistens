import { randomUUID } from 'node:crypto'

const activeSessions = new Map<string, { userId: string; companyId: string; role: string; expiresAt: number }>()

export function createSession(user: { sub: string; companyId: string; role: string }, ttlMinutes = 60) {
  const id = randomUUID()
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000

  activeSessions.set(id, {
    userId: user.sub,
    companyId: user.companyId,
    role: user.role,
    expiresAt,
  })

  return id
}

export function validateSession(sessionId: string) {
  const session = activeSessions.get(sessionId)

  if (!session) {
    return null
  }

  if (session.expiresAt < Date.now()) {
    activeSessions.delete(sessionId)
    return null
  }

  return session
}

export function revokeSession(sessionId: string) {
  activeSessions.delete(sessionId)
}

export function getSessionCount() {
  return activeSessions.size
}
