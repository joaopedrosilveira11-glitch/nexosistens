import rateLimit from 'express-rate-limit'
import { securityConfig } from '../config/security.js'

export const authLimiter = rateLimit({
  windowMs: securityConfig.rateLimiters.auth.windowMs,
  max: securityConfig.rateLimiters.auth.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: securityConfig.rateLimiters.auth.message,
})

export const apiLimiter = rateLimit({
  windowMs: securityConfig.rateLimiters.api.windowMs,
  max: securityConfig.rateLimiters.api.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: securityConfig.rateLimiters.api.message,
})
