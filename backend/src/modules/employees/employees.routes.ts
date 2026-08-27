import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../../middleware/auth.js'
import { requireTenantScope } from '../../middleware/tenant.js'
import { validateBody } from '../../middleware/validation.js'
import { getSupabaseAdminClient } from '../../services/supabaseAdmin.js'

const router = Router()

const employeeSchema = z.object({
  name: z.string().min(2),
  role: z.string().min(2),
  department: z.string().min(2).default('Operações'),
  email: z.string().email(),
  phone: z.string().optional().default(''),
  status: z.enum(['Ativo', 'Em férias', 'Afastado', 'Em desligamento', 'Suspenso']).default('Ativo'),
})

const employeeUpdateSchema = employeeSchema.partial()

const normalizeEmployeeRecord = (row: Record<string, any>) => {
  const user = row?.users ?? {}
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || String(row?.name ?? '').trim() || 'Colaborador'

  return {
    id: String(row?.id ?? row?.user_id ?? 'employee-local'),
    companyId: row?.company_id ?? row?.companyId ?? 'unknown-company',
    name,
    role: String(row?.position ?? row?.role ?? user.role ?? 'Operador').trim() || 'Operador',
    department: String(row?.department ?? row?.position ?? 'Operações').trim() || 'Operações',
    email: String(user.email ?? row?.email ?? '').trim(),
    phone: String(user.phone ?? row?.phone ?? '').trim(),
    status: String(row?.status ?? 'Ativo').trim() || 'Ativo',
    modules: Array.isArray(row?.modules) ? row.modules : [],
    authUserId: row?.auth_user_id ?? row?.user_id ?? null,
    createdAt: row?.created_at ?? new Date().toISOString(),
  }
}

const getEmployeeModules = async (admin: ReturnType<typeof getSupabaseAdminClient>, companyId: string, userId: string) => {
  if (!admin) return []

  const { data, error } = await admin
    .from('employee_module_access')
    .select('module_name, allowed')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .eq('allowed', true)

  if (error) {
    return []
  }

  return (data || []).map((item) => String(item.module_name)).filter(Boolean)
}

const upsertEmployeeModules = async (admin: ReturnType<typeof getSupabaseAdminClient>, companyId: string, userId: string, modules: string[]) => {
  if (!admin) return

  const uniqueModules = Array.from(new Set(modules.map((moduleName) => String(moduleName).trim()).filter(Boolean)))
  if (!uniqueModules.length) return

  const rows = uniqueModules.map((moduleName) => ({
    company_id: companyId,
    user_id: userId,
    module_name: moduleName,
    allowed: true,
  }))

  await admin.from('employee_module_access').upsert(rows, { onConflict: 'company_id,user_id,module_name', ignoreDuplicates: false })
}

router.use(authenticate)
router.use(requireTenantScope)

router.get('/', authorize(['owner', 'admin', 'manager', 'employee'], { plans: ['Enterprise'], module: 'employees' }), async (req, res) => {
  const admin = getSupabaseAdminClient()
  if (!admin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' })
  }

  const { data, error } = await admin
    .from('employees')
    .select('id, company_id, user_id, status, position, employee_code, created_at, users!user_id(id, first_name, last_name, email, phone, status)')
    .eq('company_id', req.user!.companyId)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message || 'Não foi possível listar colaboradores do banco real.' })
  }

  const employees = await Promise.all((data || []).map(async (row: Record<string, any>) => {
    const modules = await getEmployeeModules(admin, req.user!.companyId, row.user_id)
    return normalizeEmployeeRecord({ ...row, modules })
  }))

  return res.status(200).json({ employees })
})

router.get('/:id/dashboard', authorize(['owner', 'admin', 'manager', 'employee'], { plans: ['Enterprise'], module: 'employees' }), async (req, res) => {
  const admin = getSupabaseAdminClient()
  if (!admin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' })
  }

  const { data, error } = await admin
    .from('employees')
    .select('id, company_id, user_id, status, position, employee_code, users!user_id(id, first_name, last_name, email, phone, status)')
    .eq('company_id', req.user!.companyId)
    .eq('id', req.params.id)
    .maybeSingle()

  if (error || !data) {
    return res.status(404).json({ error: 'Employee not found.' })
  }

  const modules = await getEmployeeModules(admin, req.user!.companyId, data.user_id)
  const employee = normalizeEmployeeRecord({ ...data, modules })

  const dashboard = {
    companyId: req.user!.companyId,
    employeeId: employee.id,
    greeting: `Bom dia, ${employee.name.split(' ')[0] || 'colaborador'}.`,
    priorities: [
      { label: 'Urgente', title: 'Revisar cronograma de operação', time: '09:00' },
      { label: 'Importante', title: 'Aprovar pendências do setor', time: '11:30' },
      { label: 'Normal', title: 'Atualizar indicadores do dia', time: '15:00' },
    ],
    tasks: [
      { title: 'Revisar pedidos prioritários', meta: 'Hoje · 09:00', status: 'Urgente' },
      { title: 'Fechar acompanhamento de equipe', meta: 'Hoje · 11:00', status: 'Importante' },
      { title: 'Atualizar painel de operação', meta: 'Hoje · 15:30', status: 'Normal' },
    ],
    delayed: [
      { title: 'Ajustar SLA da produção', meta: 'Atrasada desde ontem', status: 'Crítica' },
      { title: 'Revisar pendências de compras', meta: 'Atrasada há 2 dias', status: 'Alta' },
    ],
    next: [
      { title: 'Planejamento da equipe', meta: 'Amanhã · 09:00', status: 'Próximo' },
      { title: 'Reunião com vendas', meta: 'Amanhã · 14:00', status: 'Próximo' },
    ],
    notifications: [
      { title: 'Estoque crítico em 2 itens', meta: 'há 20 min' },
      { title: 'Cliente com pedido em atraso', meta: 'há 1h' },
      { title: 'Nova aprovação pendente', meta: 'há 2h' },
    ],
    problems: [
      { title: 'Capacidade de produção abaixo da meta', meta: 'Impacto: médio' },
      { title: '2 entregas sem confirmação final', meta: 'Impacto: alto' },
    ],
    announcements: [
      { title: 'Reunião geral às 17h', meta: 'Sala de operação' },
      { title: 'Novos padrões de atendimento', meta: 'Comunicado interno' },
    ],
    progress: 72,
  }

  return res.status(200).json({ employee, dashboard })
})

router.post('/', authorize(['owner', 'admin', 'manager'], { plans: ['Enterprise'], module: 'employees' }), validateBody(employeeSchema.extend({
  modules: z.array(z.string()).optional().default([]),
  password: z.string().min(6).optional(),
})), async (req, res) => {
  const admin = getSupabaseAdminClient()
  if (!admin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' })
  }

  const companyId = req.user!.companyId
  const payload = req.body as {
    name: string
    role: string
    department?: string
    email?: string
    phone?: string
    status?: 'Ativo' | 'Em férias' | 'Afastado' | 'Em desligamento' | 'Suspenso'
    modules?: string[]
    password?: string
  }

  const cleanName = payload.name.trim()
  const email = (payload.email || '').trim().toLowerCase()
  const password = payload.password || 'Nexo@123'
  const modules = Array.from(new Set((payload.modules ?? ['dashboard']).map((moduleName) => String(moduleName).trim()).filter(Boolean)))

  // Require email for collaborator creation to ensure stable identity and avoid ambiguous fallback users
  if (!email) {
    return res.status(400).json({ error: 'Email é obrigatório ao criar colaborador. Por favor informe um e-mail válido.' })
  }

  let authUserId: string | null = null
  let userRecord: Record<string, any> | null = null

  if (email) {
    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers()
    if (listError) {
      return res.status(500).json({ error: listError.message || 'Não foi possível verificar usuários no Supabase Auth.' })
    }

    const alreadyExists = (existingUsers?.users ?? []).some((candidate) => candidate.email?.toLowerCase() === email)
    if (alreadyExists) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado no Supabase Auth.' })
    }

    const { data: createdAuthUser, error: createAuthError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        company: req.user?.companyId || 'Empresa NEXO',
        role: 'employee',
      },
    })

    if (createAuthError || !createdAuthUser?.user) {
      return res.status(500).json({ error: createAuthError?.message || 'Não foi possível criar o usuário no Supabase Auth.' })
    }

    authUserId = createdAuthUser.user.id

    const [firstName, ...lastNameParts] = cleanName.split(/\s+/)
    const lastName = lastNameParts.join(' ')

    const { data: createdUser, error: createUserError } = await admin
      .from('users')
      .upsert({
        auth_user_id: authUserId,
        company_id: companyId,
        first_name: firstName || 'Colaborador',
        last_name: lastName || '',
        email,
        phone: payload.phone || '',
        status: 'active',
      }, { onConflict: 'auth_user_id', ignoreDuplicates: false })
      .select('id, auth_user_id, company_id, first_name, last_name, email, phone, status')
      .maybeSingle()

    if (createUserError || !createdUser) {
      return res.status(500).json({ error: createUserError?.message || 'Não foi possível vincular o funcionário à empresa.' })
    }

    userRecord = createdUser
  }

  if (!userRecord && !email) {
    const [firstName, ...lastNameParts] = cleanName.split(/\s+/)
    const lastName = lastNameParts.join(' ')

    // Try to find an existing user in this company by exact name match (prevents duplicates when owner resubmits form)
    const { data: foundByName } = await admin
      .from('users')
      .select('id, auth_user_id, company_id, first_name, last_name, email, phone, status')
      .eq('company_id', companyId)
      .eq('first_name', firstName || '')
      .eq('last_name', lastName || '')
      .maybeSingle()

    if (foundByName) {
      userRecord = foundByName
    } else {
      const fallbackEmail = `colaborador-${Date.now()}@nexo.local`
      const generatedPassword = `Nexo-${Math.random().toString(36).slice(2, 10)}A1!`

      // Create a Supabase Auth user for the collaborator so auth_user_id FK is valid
      const { data: createdAuthUser, error: createAuthError } = await admin.auth.admin.createUser({
        email: fallbackEmail,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
          company: companyId,
          role: 'employee',
        },
      })

      if (createAuthError || !createdAuthUser?.user) {
        return res.status(500).json({ error: createAuthError?.message || 'Não foi possível criar o usuário no Supabase Auth (fallback).' })
      }

      const fallbackAuthUserId = createdAuthUser.user.id

      const { data: createdUser, error: createUserError } = await admin
        .from('users')
        .insert({
          company_id: companyId,
          auth_user_id: fallbackAuthUserId,
          first_name: firstName || 'Colaborador',
          last_name: lastName || '',
          email: fallbackEmail,
          phone: payload.phone || '',
          status: 'active',
        })
        .select('id, auth_user_id, company_id, first_name, last_name, email, phone, status')
        .maybeSingle()

      if (createUserError || !createdUser) {
        return res.status(500).json({ error: createUserError?.message || 'Não foi possível criar o perfil do trabalhador.' })
      }

      userRecord = createdUser
    }
  }

  if (!userRecord) {
    return res.status(500).json({ error: 'Não foi possível criar o perfil do colaborador.' })
  }

  const { data: roleData, error: roleError } = await admin
    .from('roles')
    .select('id')
    .eq('company_id', companyId)
    .eq('slug', 'employee')
    .maybeSingle()

  if (!roleError && roleData?.id) {
    await admin.from('memberships').upsert({
      company_id: companyId,
      user_id: userRecord.id,
      role_id: roleData.id,
      status: 'active',
    }, { onConflict: 'company_id,user_id', ignoreDuplicates: false })
  }

  // Ensure employee_code is stable: if an employee row already exists, keep its employee_code.
  let generatedCode = `NEXO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

  // Check for existing employee for this user in this company
  const { data: existingEmployee, error: existingEmployeeErr } = await admin
    .from('employees')
    .select('id, company_id, user_id, status, position, employee_code, created_at')
    .eq('company_id', companyId)
    .eq('user_id', userRecord.id)
    .maybeSingle()

  if (existingEmployeeErr) {
    return res.status(500).json({ error: existingEmployeeErr.message || 'Não foi possível verificar existência de colaborador.' })
  }

  let employeeRow: Record<string, any> | null = null

  if (existingEmployee) {
    // Keep existing employee_code
    generatedCode = String(existingEmployee.employee_code || generatedCode)

    // Update only mutable fields (do not overwrite employee_code)
    const { data: updatedEmployee, error: updateError } = await admin
      .from('employees')
      .update({ position: payload.role || existingEmployee.position, status: payload.status || existingEmployee.status })
      .eq('id', existingEmployee.id)
      .select('id, company_id, user_id, status, position, employee_code, created_at')
      .maybeSingle()

    if (updateError) {
      return res.status(500).json({ error: updateError.message || 'Não foi possível atualizar o colaborador existente.' })
    }

    employeeRow = updatedEmployee
  } else {
    // Create new employee with generatedCode
    const { data: createdEmployee, error: employeeError } = await admin
      .from('employees')
      .insert({
        company_id: companyId,
        user_id: userRecord.id,
        position: payload.role || 'Operador',
        employee_code: generatedCode,
        status: payload.status || 'Ativo',
      })
      .select('id, company_id, user_id, status, position, employee_code, created_at')
      .maybeSingle()

    if (employeeError || !createdEmployee) {
      return res.status(500).json({ error: employeeError?.message || 'Não foi possível persistir o cadastro do colaborador no banco real.' })
    }

    employeeRow = createdEmployee
  }

  await upsertEmployeeModules(admin, companyId, userRecord.id, modules)

  const finalEmployee = normalizeEmployeeRecord({
    ...employeeRow,
    users: userRecord,
    modules,
  })

  return res.status(201).json({ employee: finalEmployee, accessCode: generatedCode, authUserId, user: userRecord })
})

router.post('/:id/modules', authorize(['owner', 'admin', 'manager'], { plans: ['Enterprise'], module: 'employees' }), validateBody(z.object({
  modules: z.array(z.string()).default([]),
})), async (req, res) => {
  const admin = getSupabaseAdminClient()
  if (!admin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' })
  }

  const companyId = req.user!.companyId
  const employeeId = req.params.id
  const { data: employeeRow, error: employeeLookupError } = await admin
    .from('employees')
    .select('id, user_id, company_id')
    .eq('company_id', companyId)
    .eq('id', employeeId)
    .maybeSingle()

  if (employeeLookupError || !employeeRow) {
    return res.status(404).json({ error: 'Employee not found.' })
  }

  const requestedModules = Array.isArray(req.body.modules) ? (req.body.modules as unknown[]).map((moduleName) => String(moduleName).trim()) : []
  const modules = Array.from(new Set(requestedModules.filter(Boolean)))
  await upsertEmployeeModules(admin, companyId, employeeRow.user_id, modules)

  const { data: accessData, error: accessError } = await admin
    .from('employee_module_access')
    .select('module_name')
    .eq('company_id', companyId)
    .eq('user_id', employeeRow.user_id)
    .eq('allowed', true)

  if (accessError) {
    return res.status(500).json({ error: accessError.message || 'Não foi possível carregar permissões do colaborador.' })
  }

  return res.status(200).json({ employeeId, modules: (accessData || []).map((item) => item.module_name) })
})

router.put('/:id', authorize(['owner', 'admin', 'manager'], { plans: ['Enterprise'], module: 'employees' }), validateBody(employeeUpdateSchema), async (req, res) => {
  const admin = getSupabaseAdminClient()
  if (!admin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' })
  }

  const companyId = req.user!.companyId
  const employeeId = req.params.id
  const { data: employeeRow, error: employeeLookupError } = await admin
    .from('employees')
    .select('id, company_id, user_id, status, position, employee_code')
    .eq('company_id', companyId)
    .eq('id', employeeId)
    .maybeSingle()

  if (employeeLookupError || !employeeRow) {
    return res.status(404).json({ error: 'Employee not found.' })
  }

  const payload = req.body as {
    name?: string
    role?: string
    department?: string
    email?: string
    phone?: string
    status?: 'Ativo' | 'Em férias' | 'Afastado' | 'Em desligamento' | 'Suspenso'
  }

  const updates: Record<string, any> = {}
  if (payload.role) updates.position = payload.role
  if (payload.status) updates.status = payload.status
  if (payload.email || payload.phone || payload.name) {
    const { data: userData, error: userLookupError } = await admin
      .from('users')
      .select('id, first_name, last_name, email, phone')
      .eq('company_id', companyId)
      .eq('id', employeeRow.user_id)
      .maybeSingle()

    if (!userLookupError && userData) {
      const nextName = payload.name ? payload.name.trim() : [userData.first_name, userData.last_name].filter(Boolean).join(' ')
      const [firstName, ...lastNameParts] = nextName.split(/\s+/)
      const nextEmail = payload.email ? payload.email.trim().toLowerCase() : userData.email
      const nextPhone = payload.phone ?? userData.phone ?? ''

      await admin.from('users').update({
        first_name: firstName || 'Colaborador',
        last_name: lastNameParts.join(' '),
        email: nextEmail,
        phone: nextPhone,
      }).eq('id', userData.id)
    }
  }

  if (Object.keys(updates).length > 0) {
    const { data: updatedEmployee, error: updateError } = await admin
      .from('employees')
      .update(updates)
      .eq('id', employeeId)
      .select('id, company_id, user_id, status, position, employee_code, created_at')
      .maybeSingle()

    if (updateError) {
      return res.status(500).json({ error: updateError.message || 'Não foi possível atualizar o colaborador.' })
    }

    const { data: userData } = await admin
      .from('users')
      .select('id, first_name, last_name, email, phone, status')
      .eq('id', employeeRow.user_id)
      .maybeSingle()

    return res.status(200).json({ employee: normalizeEmployeeRecord({ ...updatedEmployee, users: userData || {} }) })
  }

  return res.status(200).json({ employee: normalizeEmployeeRecord({ ...employeeRow }) })
})

router.delete('/:id', authorize(['owner', 'admin', 'manager'], { plans: ['Enterprise'], module: 'employees' }), async (req, res) => {
  const admin = getSupabaseAdminClient()
  if (!admin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' })
  }

  const companyId = req.user!.companyId
  const { data: employeeRow, error: employeeLookupError } = await admin
    .from('employees')
    .select('id, company_id, user_id')
    .eq('company_id', companyId)
    .eq('id', req.params.id)
    .maybeSingle()

  if (employeeLookupError || !employeeRow) {
    return res.status(404).json({ error: 'Employee not found.' })
  }

  const { error: updateError } = await admin
    .from('employees')
    .update({ status: 'Suspenso' })
    .eq('id', req.params.id)

  if (updateError) {
    return res.status(500).json({ error: updateError.message || 'Não foi possível suspender o colaborador no banco real.' })
  }

  await admin.from('employee_module_access').update({ allowed: false }).eq('company_id', companyId).eq('user_id', employeeRow.user_id)

  return res.status(200).json({ deleted: true, id: req.params.id, status: 'Suspenso' })
})

export default router
