import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { canAccessModule, canAccessRoleForModule, normalizePlan, normalizeRole, type AuthorizationModule } from '../modules/authorization/authorization.js'
import { validateSession, revokeSession } from '../services/sessionStore.js'

type AuthUser = {
  sub: string
  email: string
  role: 'owner' | 'admin' | 'manager' | 'employee' | 'customer'
  companyId: string
  plan?: string
  subscription?: { plan?: string }
  modules?: string[]
  sessionId?: string
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid bearer token.' })
  }

  try {
    const token = authorization.replace('Bearer ', '').trim()

    if (env.nodeEnv !== 'production' && env.allowDemoTokens) {
      const normalizedToken = token.toLowerCase()
      if (normalizedToken.startsWith('demo-') || normalizedToken.startsWith('supabase-') || normalizedToken.startsWith('nexo-')) {
        const demoUser: AuthUser = {
          sub: 'demo-user',
          email: 'demo@nexo.local',
          role: normalizedToken.includes('enterprise') ? 'owner' : normalizedToken.includes('pro') || normalizedToken.includes('growth') ? 'admin' : 'manager',
          companyId: 'demo-company',
          plan: normalizedToken.includes('enterprise') ? 'Enterprise' : normalizedToken.includes('pro') ? 'Pro' : normalizedToken.includes('growth') ? 'Growth' : 'Starter',
          sessionId: 'demo-session',
        }

        ;(req as Request & { user?: AuthUser }).user = demoUser
        req.sessionId = 'demo-session'
        return next()
      }
    }

    const decoded = jwt.verify(token, env.jwtSecret) as {
      sub: string
      email: string
      role: 'owner' | 'admin' | 'manager' | 'employee' | 'customer'
      companyId: string
      plan?: string
      modules?: string[]
      sessionId: string
    }

    const session = validateSession(decoded.sessionId)

    if (!session || session.userId !== decoded.sub || session.companyId !== decoded.companyId) {
      if (decoded.sessionId) {
        revokeSession(decoded.sessionId)
      }
      return res.status(401).json({ error: 'Session is invalid or expired.' })
    }

    const user: AuthUser = { ...decoded, sessionId: decoded.sessionId }
    ;(req as Request & { user?: AuthUser }).user = user
    req.sessionId = decoded.sessionId
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' })
  }
}

export function authorize(roles: Array<string>, options: { module?: AuthorizationModule; plans?: Array<string> } = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as AuthUser | undefined
    const currentRole = normalizeRole(user?.role)
    const currentPlan = normalizePlan(user?.plan ?? user?.subscription?.plan ?? null)

    if (!currentRole || !roles.map((item) => normalizeRole(item)).includes(currentRole)) {
      return res.status(403).json({ error: 'You do not have permission to access this resource.' })
    }

    if (options.plans && options.plans.length > 0 && (!currentPlan || !options.plans.includes(currentPlan))) {
      return res.status(403).json({ error: `This plan does not have access to this resource. Required plans: ${options.plans.join(', ')}` })
    }

    if (options.module) {
      const allowedModules = Array.isArray(user?.modules) ? user.modules.map((module) => String(module).toLowerCase()) : []
      const requestedModule = String(options.module).toLowerCase()

      if (currentRole !== 'owner' && !canAccessRoleForModule(options.module, currentRole)) {
        return res.status(403).json({ error: `This role does not have access to ${options.module}.` })
      }

      if (currentRole !== 'owner' && !allowedModules.includes(requestedModule) && !allowedModules.includes('*')) {
        return res.status(403).json({ error: `Your account does not have access to ${options.module}.` })
      }

      if (currentRole !== 'owner' && !canAccessModule(user, options.module)) {
        return res.status(403).json({ error: `Your plan does not allow access to ${options.module}.` })
      }
    }

    next()
  }
}

export function requirePlan(plans: Array<string>, moduleName?: AuthorizationModule) {
  return authorize(['owner', 'admin', 'manager', 'employee', 'customer'], {
    plans,
    module: moduleName,
  })
}
