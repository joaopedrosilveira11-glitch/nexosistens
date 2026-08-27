import jwt from 'jsonwebtoken'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../../middleware/auth.js'
import { requireTenantScope } from '../../middleware/tenant.js'
import { validateBody } from '../../middleware/validation.js'
import { createSession } from '../../services/sessionStore.js'
import { env } from '../../config/env.js'

const router = Router()

const accessCodeStore = new Map<string, Record<string, unknown>>()

const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['owner', 'admin', 'manager', 'employee', 'customer']).optional(),
})

const userAccessCodeSchema = z.object({
  access_code: z.string().min(3).max(32),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  role: z.string().min(2).optional(),
  status: z.string().min(2).optional(),
  company_id: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
  employee_id: z.string().min(1).optional(),
  employeeId: z.string().min(1).optional(),
})

const mobileLoginSchema = z.object({
  access_code: z.string().min(3).max(32),
  company_id: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
  employee_id: z.string().min(1).optional(),
  employeeId: z.string().min(1).optional(),
})

router.post('/mobile/login', validateBody(mobileLoginSchema), (req, res) => {
  const accessCode = String(req.body.access_code).trim().toUpperCase()
  const requestedCompanyId = String(req.body.company_id || req.body.companyId || '').trim() || undefined
  const requestedEmployeeId = String(req.body.employee_id || req.body.employeeId || '').trim() || undefined
  const user = accessCodeStore.get(accessCode)

  if (!user) {
    return res.status(401).json({ error: 'Código de acesso inválido.' })
  }

  if (requestedCompanyId && String(user.companyId || 'default-company') !== requestedCompanyId) {
    return res.status(403).json({ error: 'Este código não pertence à empresa informada.' })
  }

  if (requestedEmployeeId && String(user.employeeId || '').length > 0 && String(user.employeeId) !== requestedEmployeeId) {
    return res.status(403).json({ error: 'Este código não pertence ao funcionário informado.' })
  }

  const companyId = String(user.companyId || requestedCompanyId || 'default-company')
  const employeeId = String(user.employeeId || requestedEmployeeId || user.id)
  const normalizedRole = String(user.role || 'employee').trim().toLowerCase() === 'owner' ? 'owner' : 'employee'
  const sessionId = createSession({ sub: String(user.id), companyId, role: normalizedRole }, env.sessionTtlMinutes)
  const tokenOptions = { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
  const sessionToken = jwt.sign(
    {
      sub: String(user.id),
      email: `${accessCode.toLowerCase()}@nexo.local`,
      role: normalizedRole,
      companyId,
      plan: 'Enterprise',
      modules: ['dashboard'],
      sessionId,
    },
    String(env.jwtSecret),
    tokenOptions,
  )

  return res.status(200).json({
    ok: true,
    token: sessionToken,
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      access_code: user.access_code,
      role: normalizedRole,
      status: user.status,
      companyId,
      employeeId,
      plan: 'Enterprise',
      modules: ['dashboard'],
    },
  })
})

router.use(authenticate)
router.use(requireTenantScope)

import { getSupabaseAdminClient } from '../../services/supabaseAdmin.js'

router.get('/', authorize(['owner', 'admin', 'manager'], { plans: ['Pro', 'Enterprise'], module: 'users' }), async (req, res) => {
  const admin = getSupabaseAdminClient()
  if (!admin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' })
  }

  try {
    const companyId = req.user!.companyId
    const { data, error } = await admin
      .from('users')
      .select('id, first_name, last_name, email, phone, status, created_at, memberships!user_id(status, roles(name, slug))')
      .eq('company_id', companyId)
      .order('first_name', { ascending: true })

    if (error) {
      return res.status(500).json({ error: error.message || 'Não foi possível listar usuários.' })
    }

    return res.status(200).json({ users: data || [] })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao listar usuários.' })
  }
})

router.get('/me', (req, res) => {
  return res.status(200).json({ user: req.user })
})

router.post('/access-code', authorize(['owner'], { plans: ['Pro', 'Enterprise'], module: 'users' }), validateBody(userAccessCodeSchema), (req, res) => {
  const accessCode = String(req.body.access_code).trim().toUpperCase()
  const normalizedUser = {
    id: `mobile-user-${Date.now()}`,
    first_name: req.body.first_name?.trim() || 'Colaborador',
    last_name: req.body.last_name?.trim() || '',
    access_code: accessCode,
    role: req.body.role || 'Operador',
    status: req.body.status || 'active',
    created_at: new Date().toISOString(),
    companyId: req.user?.companyId,
  }

  const existing = accessCodeStore.get(accessCode)
  if (existing) {
    return res.status(409).json({ error: 'Access code already exists for this company.' })
  }

  accessCodeStore.set(accessCode, normalizedUser)
  return res.status(201).json({ user: normalizedUser, access_code: accessCode })
})

router.patch('/:id', authorize(['owner'], { plans: ['Pro', 'Enterprise'], module: 'users' }), validateBody(userUpdateSchema), (req, res) => {
  return res.status(200).json({
    message: 'User updated successfully.',
    data: {
      id: req.params.id,
      ...req.body,
    },
  })
})

export default router
