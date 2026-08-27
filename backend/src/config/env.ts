import dotenv from 'dotenv'
import { resolve } from 'node:path'

dotenv.config({ path: resolve(process.cwd(), '..', '.env.local') })
dotenv.config()

const isProduction = (process.env.NODE_ENV ?? 'development') === 'production'
const jwtSecret = process.env.JWT_SECRET ?? (isProduction ? undefined : 'nexo-dev-secret')

if (isProduction && !jwtSecret) {
  throw new Error('JWT_SECRET must be configured in production.')
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: jwtSecret ?? 'nexo-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  allowDemoTokens: process.env.ALLOW_DEMO_TOKENS === 'true',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',').map((origin) => origin.trim()),
  sessionTtlMinutes: Number(process.env.SESSION_TTL_MINUTES ?? 60),
  backupEnabled: process.env.BACKUP_ENABLED === 'true',
  backupStrategy: process.env.BACKUP_STRATEGY ?? 'encrypted snapshots + offsite retention 30 days',
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? '',
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '',
  supabaseJwksUrl: process.env.SUPABASE_JWKS_URL ?? '',
  openAiApiKey: process.env.OPENAI_API_KEY ?? '',
  openAiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  aiProvider: process.env.AI_PROVIDER ?? 'openai',
}
