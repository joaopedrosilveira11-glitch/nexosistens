type LogLevel = 'info' | 'warn' | 'error' | 'audit'

const sensitiveKeys = new Set(['password', 'secret', 'token', 'authorization', 'apiKey', 'api_key', 'jwt', 'cookie', 'session'])

const redactSensitiveValues = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => {
        if (sensitiveKeys.has(key.toLowerCase())) {
          return [key, '[REDACTED]']
        }

        return [key, redactSensitiveValues(entryValue)]
      }),
    )
  }

  if (typeof value === 'string') {
    return value.length > 256 ? `${value.slice(0, 253)}...` : value
  }

  return value
}

const format = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  const payload = meta ? ` ${JSON.stringify(redactSensitiveValues(meta))}` : ''
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${payload}`
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => console.log(format('info', message, meta)),
  warn: (message: string, meta?: Record<string, unknown>) => console.warn(format('warn', message, meta)),
  error: (message: string, meta?: Record<string, unknown>) => console.error(format('error', message, meta)),
  audit: (message: string, meta?: Record<string, unknown>) => console.info(format('audit', message, meta)),
}
