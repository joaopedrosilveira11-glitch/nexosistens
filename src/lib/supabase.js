import { createClient } from '@supabase/supabase-js'
import { getApiBaseUrl } from './api.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  : null

export async function syncTenantProfile({ companyName, fullName, email, authUserId, plan = 'Pro', modules = ['dashboard', 'customers', 'production', 'inventory', 'finance', 'invoices', 'reports', 'budgets', 'orders', 'problems', 'automation', 'users', 'employees', 'governance'] }) {
  if (!supabase) {
    throw new Error('Supabase client is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.')
  }

  const backendUrl = getApiBaseUrl()
  const payload = {
    companyName: String(companyName || 'Minha empresa').trim() || 'Minha empresa',
    fullName: String(fullName || 'Usuário').trim() || 'Usuário',
    email: String(email || '').trim().toLowerCase(),
    authUserId,
    plan,
    role: 'owner',
    modules: Array.isArray(modules) && modules.length > 0 ? modules : ['dashboard', 'customers', 'production', 'inventory', 'finance', 'invoices', 'reports', 'budgets', 'orders', 'problems', 'automation', 'users', 'employees', 'governance'],
  }

  try {
    const response = await fetch(`${backendUrl}/api/auth/sync-tenant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const contentType = response.headers.get('content-type') || ''
    const responseBody = contentType.includes('application/json') ? await response.json() : await response.text()

    if (!response.ok) {
      const message = typeof responseBody === 'string' ? responseBody : responseBody?.error || 'Não foi possível sincronizar o tenant com o Supabase.'
      throw new Error(message)
    }

    return responseBody
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível sincronizar o tenant com o Supabase.'
    if (message.includes('Failed to fetch') || message.includes('ECONNREFUSED')) {
      throw new Error(`O backend do NEXO não está respondendo em ${backendUrl}. Inicie o backend para gravar no Supabase real.`)
    }

    throw new Error(message)
  }
}

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.')
  }

  return supabase
}
