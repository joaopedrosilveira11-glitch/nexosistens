import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validation.js'
import { createSession, revokeSession } from '../../services/sessionStore.js'
import { syncTenantProfileWithServiceRole, getSupabaseAdminClient } from '../../services/supabaseAdmin.js'
import { logger } from '../../utils/logger.js'
import { recordAudit } from '../../utils/audit.js'
import { env } from '../../config/env.js'

const router = Router()

const getSupabaseAuthClient = () => {
 if (!env.supabaseUrl || !env.supabasePublishableKey) {
   return null
 }

 return createClient(env.supabaseUrl, env.supabasePublishableKey, {
   auth: {
     persistSession: false,
     autoRefreshToken: false,
     detectSessionInUrl: false,
   },
 })
}

const defaultOwnerModules = ['dashboard', 'customers', 'production', 'inventory', 'finance', 'invoices', 'reports', 'budgets', 'orders', 'problems', 'automation', 'users', 'employees', 'governance']
const defaultEmployeeModules = ['dashboard']

const normalizeAuthRole = (value?: string | null) => {
 const role = String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
 if (!role) return 'owner'
 if (role === 'proprietario' || role === 'dono') return 'owner'
 if (role === 'admin') return 'admin'
 if (role === 'manager' || role === 'gerente') return 'manager'
 if (role === 'employee' || role === 'funcionario' || role === 'colaborador') return 'employee'
 if (role === 'customer' || role === 'cliente') return 'customer'
 return 'owner'
}

const buildBackendToken = (user: { id: string; email: string; role: string; companyId: string; plan?: string; modules?: string[] }) => {
 const sessionId = createSession({ sub: user.id, companyId: user.companyId, role: user.role }, env.sessionTtlMinutes)
 const tokenOptions = { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] }

 return jwt.sign(
   {
     sub: user.id,
     email: user.email,
     role: user.role,
     companyId: user.companyId,
     plan: user.plan,
     modules: user.modules,
     sessionId,
   },
   String(env.jwtSecret),
   tokenOptions,
 )
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2),
  role: z.enum(['owner', 'admin', 'manager', 'employee', 'customer']).default('owner'),
})

const syncTenantSchema = z.object({
  companyName: z.string().min(2),
  fullName: z.string().min(2),
  email: z.string().email(),
  authUserId: z.string().min(1),
  plan: z.enum(['Starter', 'Growth', 'Pro', 'Enterprise']).optional().default('Pro'),
  role: z.string().optional(),
  modules: z.array(z.string()).optional(),
})

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const authClient = getSupabaseAuthClient()
  if (!authClient) {
    return res.status(500).json({ error: 'Supabase auth is not configured on the backend.' })
  }

  const { email, password } = req.body

  try {
    const { data, error } = await authClient.auth.signInWithPassword({ email, password })

    if (error || !data.user) {
      logger.warn('Supabase backend login failed', { email, error: error?.message })
      return res.status(401).json({ error: 'Credenciais inválidas.' })
    }

    const user = data.user
    const metadata = user.user_metadata || {}
    const role = normalizeAuthRole(metadata.role || metadata.account_role || metadata.user_role)

    // Resolve companyId robustly by consulting the users table with the service-role client.
    // Fallback to metadata or auth user id if the DB lookup is unavailable or missing.
    let companyId = String(metadata.company_id || metadata.companyId || '')
    try {
      const admin = getSupabaseAdminClient()
      if (admin) {
        const { data: userRow, error: userRowErr } = await admin
          .from('users')
          .select('company_id')
          .eq('auth_user_id', user.id)
          .maybeSingle()
        if (!userRowErr && userRow?.company_id) {
          companyId = String(userRow.company_id)
        }
      }
    } catch (err) {
      // ignore DB lookup failure; fall back to metadata or auth user id below
    }

    if (!companyId) companyId = String(user.id || 'default-company')

    const plan = String(metadata.plan || 'Enterprise')
    const modules = Array.isArray(metadata.modules) && metadata.modules.length > 0
      ? metadata.modules
      : (role === 'owner' ? defaultOwnerModules : defaultEmployeeModules)

    const token = buildBackendToken({
      id: user.id,
      email: user.email || email,
      role,
      companyId,
      plan,
      modules,
    })

    recordAudit('auth.login', {
      userId: user.id,
      email: user.email,
      companyId,
      role,
    })

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: metadata.full_name || metadata.name || user.email?.split('@')[0] || 'Usuário',
        company: metadata.company || 'Empresa NEXO',
        companyId,
        role,
        plan,
        modules,
        emailVerified: Boolean(user.email_confirmed_at),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível entrar no sistema.'
    logger.error('backend login crashed', { error: message })
    return res.status(500).json({ error: message })
  }
})

router.post('/sync-tenant', validateBody(syncTenantSchema), async (req, res) => {
  try {
    const result = await syncTenantProfileWithServiceRole(req.body)
    recordAudit('tenant.profile_synced', {
      authUserId: req.body.authUserId,
      companyName: req.body.companyName,
      email: req.body.email,
      plan: req.body.plan,
    })
    return res.status(200).json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível sincronizar o tenant com o Supabase.'
    logger.error('Supabase tenant sync failed', { error: message, authUserId: req.body.authUserId })
    return res.status(500).json({ error: message })
  }
})

router.post('/register', validateBody(registerSchema), (_req, res) => {
  return res.status(501).json({
    error: 'Registration is provided by Supabase. Configure the frontend Supabase client to create accounts.',
  })
})

// Development-only admin registration endpoint that creates a Supabase user using the
// service role key and immediately confirms the email. This helps in local/dev where
// signUp might be blocked by email policies. Disabled in production for safety.
router.post('/register-admin', validateBody(registerSchema), async (req, res) => {
  if (env.nodeEnv === 'production') {
    return res.status(403).json({ error: 'Admin registration via backend is disabled in production.' })
  }

  const { name, email, password, companyName } = req.body
  const ownerRole = 'owner'

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return res.status(500).json({ error: 'Supabase service role is not configured on the server.' })
  }

  try {
    // Create the auth user via admin API and confirm email
    if (admin.auth && admin.auth.admin && typeof admin.auth.admin.createUser === 'function') {
      const createRes = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, role: ownerRole, company: companyName || 'Minha empresa', modules: defaultOwnerModules },
      })

      if (createRes.error) {
        logger.error('Admin createUser failed', { error: createRes.error })
        return res.status(500).json({ error: createRes.error.message || 'Failed to create user via admin API.' })
      }

      const createdUser = createRes.data?.user
      if (!createdUser) {
        return res.status(500).json({ error: 'User not returned by Supabase admin API.' })
      }

      // Ensure tenant profile exists and user linked
      const syncRes = await syncTenantProfileWithServiceRole({
        authUserId: createdUser.id,
        companyName: companyName || 'Minha empresa',
        fullName: name || createdUser.user_metadata?.full_name || '',
        email,
      })

      recordAudit('admin.account_created', {
        authUserId: createdUser.id,
        email,
        companyName: companyName || 'Minha empresa',
        role: ownerRole,
      })

      return res.status(200).json({ user: createdUser, sync: syncRes })
    }

    return res.status(500).json({ error: 'Admin createUser API not available in this Supabase client version.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create admin user.'
    logger.error('register-admin failed', { error: message })
    return res.status(500).json({ error: message })
  }
})
router.post('/logout', authenticate, (req, res) => {
  if (req.sessionId) {
    revokeSession(req.sessionId)
    recordAudit('user.logged_out', { userId: req.user?.sub, sessionId: req.sessionId, companyId: req.user?.companyId })
  }

  return res.status(200).json({ message: 'Logged out successfully.' })
})

router.get('/me', authenticate, (req, res) => {
  return res.status(200).json({ user: req.user })
})

export default router
