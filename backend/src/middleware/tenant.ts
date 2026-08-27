import type { NextFunction, Request, Response } from 'express'

export function requireTenantScope(req: Request, res: Response, next: NextFunction) {
  const requestedCompanyId = req.params.companyId ?? req.body?.companyId ?? req.query?.companyId
  const currentCompanyId = req.user?.companyId

  if (!currentCompanyId) {
    return res.status(403).json({ error: 'Tenant context missing for this request.' })
  }

  if (requestedCompanyId && String(requestedCompanyId) !== currentCompanyId) {
    return res.status(403).json({ error: 'Access denied: tenant mismatch detected.' })
  }

  next()
}
