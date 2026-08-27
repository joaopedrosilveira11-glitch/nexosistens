import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { securityConfig } from './config/security.js'
import { apiLimiter, authLimiter } from './middleware/rateLimit.js'
import { requestLogger } from './middleware/requestLogger.js'
import authRoutes from './modules/auth/auth.routes.js'
import companiesRoutes from './modules/companies/companies.routes.js'
import customersRoutes from './modules/customers/customers.routes.js'
import ordersRoutes from './modules/orders/orders.routes.js'
import inventoryRoutes from './modules/inventory/inventory.routes.js'
import productionRoutes from './modules/production/production.routes.js'
import financeRoutes from './modules/finance/finance.routes.js'
import aiRoutes from './modules/ai/ai.routes.js'
import notificationsRoutes from './modules/notifications/notifications.routes.js'
import auditRoutes from './modules/audit/audit.routes.js'
import usersRoutes from './modules/users/users.routes.js'
import employeesRoutes from './modules/employees/employees.routes.js'
import invoicesRoutes from './modules/invoices/invoices.routes.js'
import { logger } from './utils/logger.js'

const app = express()

app.disable('x-powered-by')
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || securityConfig.allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    callback(new Error('Origin not allowed by CORS policy.'))
  },
  credentials: true,
}))
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}))
app.use(express.json({ limit: '1mb' }))
app.use(requestLogger)
app.use('/api/auth', authLimiter)
app.use('/api', apiLimiter)

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'nexo-backend',
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
    security: {
      sessions: 'enabled',
      multiTenantIsolation: 'enforced',
      backups: env.backupEnabled ? env.backupStrategy : 'not configured',
    },
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/companies', companiesRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/employees', employeesRoutes)
app.use('/api/customers', customersRoutes)
app.use('/api/orders', ordersRoutes)
app.use('/api/invoices', invoicesRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/production', productionRoutes)
app.use('/api/finance', financeRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/audit', auditRoutes)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled server error', { error: err instanceof Error ? err.message : 'unknown' })

  if (err instanceof Error) {
    return res.status(500).json({ error: err.message })
  }

  return res.status(500).json({ error: 'Unexpected server error.' })
})

app.listen(env.port, () => {
  logger.info(`NEXO backend listening on http://localhost:${env.port}`)
})
