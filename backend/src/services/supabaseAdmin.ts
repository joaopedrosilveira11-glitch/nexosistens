import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const defaultOwnerModules = ['dashboard', 'customers', 'production', 'inventory', 'finance', 'invoices', 'reports', 'budgets', 'orders', 'problems', 'automation', 'users', 'employees', 'governance']

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return null
  }

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

function normalizePlanSlug(plan?: string) {
  const value = String(plan || 'Pro').trim()

  switch (value.toLowerCase()) {
    case 'starter':
      return 'start'
    case 'growth':
    case 'pro':
      return 'pro'
    case 'enterprise':
      return 'enterprise'
    default:
      return 'pro'
  }
}

function isMissingTableError(error: unknown) {
  const message = typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: string }).message) : ''
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: string }).code) : ''
  return code === '42P01' || message.includes('Could not find the table') || message.includes('does not exist')
}

export async function syncTenantProfileWithServiceRole({
  authUserId,
  companyName,
  fullName,
  email,
  plan,
  role,
  modules,
}: {
  authUserId: string
  companyName: string
  fullName: string
  email: string
  plan?: string
  role?: string
  modules?: string[]
}) {
  const admin = getSupabaseAdminClient()
  const forcedOwnerRole = String(role || 'owner').trim() || 'owner'
  const effectiveModules = Array.isArray(modules) && modules.length > 0 ? modules : defaultOwnerModules

  if (!admin) {
    throw new Error('Supabase service role is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the backend environment.')
  }

  const safeCompanyName = String(companyName || 'Minha empresa').trim() || 'Minha empresa'
  const safeEmail = String(email || '').trim().toLowerCase()
  const safeFullName = String(fullName || 'Usuário').trim() || 'Usuário'
  const [firstName, ...lastNameParts] = safeFullName.split(/\s+/)
  const lastName = lastNameParts.join(' ')

  const { data: existingUser, error: existingUserError } = await admin
    .from('users')
    .select('id, company_id, email, first_name, last_name')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (existingUserError) {
    throw new Error(existingUserError.message || 'Não foi possível consultar a empresa do usuário no Supabase.')
  }

  if (existingUser?.company_id) {
    const { error: authMetadataError } = await admin.auth.admin.updateUserById(authUserId, {
      user_metadata: {
        full_name: safeFullName,
        company: safeCompanyName,
        role: forcedOwnerRole,
        modules: effectiveModules,
      },
    })

    if (authMetadataError) {
      logger.warn('Failed to force owner role on existing account metadata.', { authUserId, error: authMetadataError.message })
    }

    const { data: companyData, error: companyError } = await admin
      .from('companies')
      .select('id, name, slug')
      .eq('id', existingUser.company_id)
      .single()

    if (companyError) {
      throw new Error(companyError.message || 'Não foi possível recuperar a empresa do usuário no Supabase.')
    }

    return {
      company: companyData,
      user: existingUser,
      role: null,
    }
  }

  const companySlug = `${safeCompanyName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'empresa'}-${Date.now().toString(36)}`

  const { error: authMetadataError } = await admin.auth.admin.updateUserById(authUserId, {
    user_metadata: {
      full_name: safeFullName,
      company: safeCompanyName,
      role: forcedOwnerRole,
      modules: effectiveModules,
    },
  })

  if (authMetadataError) {
    logger.warn('Failed to force owner role on account metadata.', { authUserId, error: authMetadataError.message })
  }

  const { data: companyData, error: companyError } = await admin
    .from('companies')
    .insert({
      name: safeCompanyName,
      slug: companySlug,
      status: 'active',
    })
    .select('id, name, slug')
    .single()

  if (companyError) {
    throw new Error(companyError.message || 'Não foi possível criar a empresa no Supabase.')
  }

  const { data: userData, error: userError } = await admin
    .from('users')
    .upsert({
      auth_user_id: authUserId,
      company_id: companyData.id,
      first_name: firstName || 'Usuário',
      last_name: lastName || '',
      email: safeEmail,
      status: 'active',
    }, { onConflict: 'auth_user_id', ignoreDuplicates: false })
    .select('id, company_id, auth_user_id, first_name, last_name, email')
    .single()

  if (userError) {
    throw new Error(userError.message || 'Não foi possível criar o perfil do usuário no Supabase.')
  }

  const { data: roleData, error: roleError } = await admin
    .from('roles')
    .upsert({
      company_id: companyData.id,
      name: 'Proprietário',
      slug: 'owner',
      description: 'Responsável pela empresa',
      is_system: true,
    }, { onConflict: 'company_id,slug', ignoreDuplicates: false })
    .select('id, company_id, slug, name')
    .single()

  if (roleError) {
    throw new Error(roleError.message || 'Não foi possível criar o papel inicial da empresa.')
  }

  const { error: membershipError } = await admin
    .from('memberships')
    .upsert({
      company_id: companyData.id,
      user_id: userData.id,
      role_id: roleData.id,
      status: 'active',
    }, { onConflict: 'company_id,user_id', ignoreDuplicates: false })

  if (membershipError) {
    throw new Error(membershipError.message || 'Não foi possível vincular o usuário à empresa.')
  }

  const subscriptionPlan = normalizePlanSlug(plan)
  const { data: subscriptionData, error: subscriptionError } = await admin
    .from('subscriptions')
    .upsert({
      auth_user_id: authUserId,
      plan_slug: subscriptionPlan,
      status: 'active',
      amount: subscriptionPlan === 'enterprise' ? 0 : subscriptionPlan === 'pro' ? 249 : 79,
      currency: 'BRL',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'auth_user_id', ignoreDuplicates: false })
    .select('id, auth_user_id, plan_slug, status')
    .single()

  if (subscriptionError) {
    if (isMissingTableError(subscriptionError)) {
      logger.warn('Supabase subscriptions table is missing. Skipping subscription sync for tenant.', {
        authUserId,
        companyId: companyData.id,
        plan: subscriptionPlan,
      })

      return {
        company: companyData,
        role: roleData,
        user: userData,
        subscription: null,
        warning: 'The public.subscriptions table is not available in this Supabase schema. Run the migration or create the table to persist plan data.',
      }
    }

    throw new Error(subscriptionError.message || 'Não foi possível registrar a assinatura do usuário.')
  }

  return {
    company: companyData,
    role: roleData,
    user: userData,
    subscription: subscriptionData,
  }
}
