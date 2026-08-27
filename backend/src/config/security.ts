export const securityConfig = {
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,https://nexo.app').split(',').map((origin) => origin.trim()),
  sessionTtlMinutes: Number(process.env.SESSION_TTL_MINUTES ?? 60),
  backupPolicy: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    strategy: 'S3 encrypted snapshots + point-in-time backups + retention 30 days',
    criticalTables: ['companies', 'users', 'orders', 'inventory_items', 'financial_transactions'],
  },
  rateLimiters: {
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: 'Too many authentication attempts. Please wait before retrying.',
    },
    api: {
      windowMs: 60 * 1000,
      max: 120,
      message: 'Too many requests. Please slow down.',
    },
  },
}
