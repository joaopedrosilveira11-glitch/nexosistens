import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { logger } from '../utils/logger.js'

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID()
  const startedAt = Date.now()

  ;(req as Request & { id?: string }).id = requestId
  res.setHeader('x-request-id', requestId)

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt
    const meta = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      tenant: req.user?.companyId ?? 'anonymous',
      userId: req.user?.sub ?? 'anonymous',
    }

    if (res.statusCode >= 500) {
      logger.error('HTTP request completed with server error', meta)
      return
    }

    if (res.statusCode >= 400) {
      logger.warn('HTTP request completed with client error', meta)
      return
    }

    logger.info('HTTP request completed', meta)
  })

  logger.info('HTTP request received', {
    requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    tenant: req.user?.companyId ?? 'anonymous',
    userId: req.user?.sub ?? 'anonymous',
  })

  next()
}
