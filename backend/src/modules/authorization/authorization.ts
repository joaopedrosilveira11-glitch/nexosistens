export const authorizationRules = {
  owner: ['owner', 'admin', 'manager', 'employee', 'customer'],
  admin: ['admin', 'manager', 'employee'],
  manager: ['manager', 'employee'],
  employee: ['employee'],
  customer: ['customer'],
} as const

export const planModuleAccess = {
  customers: ['Starter', 'Growth', 'Pro', 'Enterprise'],
  production: ['Growth', 'Pro', 'Enterprise'],
  inventory: ['Starter', 'Growth', 'Pro', 'Enterprise'],
  finance: ['Growth', 'Pro', 'Enterprise'],
  invoices: ['Starter', 'Growth', 'Pro', 'Enterprise'],
  reports: ['Growth', 'Pro', 'Enterprise'],
  budgets: ['Starter', 'Growth', 'Pro', 'Enterprise'],
  orders: ['Starter', 'Growth', 'Pro', 'Enterprise'],
  problems: ['Pro', 'Enterprise'],
  automation: ['Pro', 'Enterprise'],
  users: ['Pro', 'Enterprise'],
  employees: ['Enterprise'],
  governance: ['Enterprise'],
  audit: ['Pro', 'Enterprise'],
} as const

export const moduleRoleAccess = {
  dashboard: ['owner', 'admin', 'manager', 'employee', 'customer'],
  customers: ['owner', 'admin', 'manager', 'employee'],
  production: ['owner', 'admin', 'manager'],
  inventory: ['owner', 'admin', 'manager', 'employee'],
  finance: ['owner', 'admin', 'manager'],
  invoices: ['owner', 'admin', 'manager', 'employee'],
  reports: ['owner', 'admin', 'manager'],
  budgets: ['owner', 'admin', 'manager'],
  orders: ['owner', 'admin', 'manager', 'employee'],
  problems: ['owner', 'admin', 'manager'],
  automation: ['owner', 'admin', 'manager'],
  users: ['owner'],
  employees: ['owner', 'admin', 'manager'],
  governance: ['owner'],
  audit: ['owner', 'admin'],
} as const

export type AuthorizationModule = keyof typeof planModuleAccess

export function normalizePlan(plan?: string | null) {
  if (!plan) return null
  const normalized = String(plan).trim()
  if (!normalized) return null

  const mapping: Record<string, string> = {
    starter: 'Starter',
    growth: 'Growth',
    pro: 'Pro',
    enterprise: 'Enterprise',
  }

  return mapping[normalized.toLowerCase()] ?? normalized
}

export function normalizeRole(role?: string | null) {
  const normalized = String(role ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (!normalized) return 'customer'
  if (normalized === 'owner' || normalized === 'proprietario') return 'owner'
  return normalized
}

export function canAccess(scope: keyof typeof authorizationRules, role: string) {
  return (authorizationRules[scope] as readonly string[]).includes(normalizeRole(role))
}

export function canAccessRoleForModule(moduleName: AuthorizationModule, role: string) {
  const normalizedRole = normalizeRole(role)
  const allowedRoles = (moduleRoleAccess[moduleName] as readonly string[] | undefined) ?? ['owner', 'admin', 'manager', 'employee', 'customer']
  return allowedRoles.includes(normalizedRole)
}

export function canAccessModule(user: { plan?: string | null; subscription?: { plan?: string | null }; role?: string } | undefined, moduleName: AuthorizationModule) {
  const role = normalizeRole(user?.role)
  const plan = normalizePlan(user?.plan ?? user?.subscription?.plan ?? null)
  const allowedPlans = [...(planModuleAccess[moduleName] ?? [])] as string[]

  if (role === 'owner') {
    return true
  }

  if (!canAccessRoleForModule(moduleName, role)) {
    return false
  }

  if (!plan) {
    return false
  }

  return allowedPlans.includes(plan)
}
