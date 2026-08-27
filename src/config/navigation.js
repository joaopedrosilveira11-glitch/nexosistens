export const navigation = [
  { id: 'dashboard', label: 'Visão geral' },
  { id: 'customers', label: 'Clientes' },
  { id: 'production', label: 'Produção' },
  { id: 'inventory', label: 'Estoque' },
  { id: 'finance', label: 'Financeiro' },
  { id: 'invoices', label: 'Notas fiscais' },
  { id: 'reports', label: 'Relatórios' },
  { id: 'budgets', label: 'Orçamentos' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'problems', label: 'Central de problemas' },
  { id: 'automation', label: 'Automação' },
  { id: 'users', label: 'Usuários e acessos' },
  { id: 'governance', label: 'Governança' },
]

export function normalizeRoleName(role) {
  const normalized = String(role ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (!normalized) return 'customer'
  if (normalized === 'owner' || normalized === 'proprietario' || normalized === 'dono') return 'owner'
  return normalized
}

export function getDefaultModulesForRole(role = 'customer') {
  const normalizedRole = normalizeRoleName(role)

  if (normalizedRole === 'owner') {
    return navigation.map((item) => item.id)
  }

  return ['dashboard']
}

export function getEffectiveRoleValue(user) {
  if (!user) return 'customer'

  const candidates = [
    user?.role,
    user?.user_metadata?.role,
    user?.user_metadata?.organization_role,
    user?.app_metadata?.role,
    user?.app_metadata?.claims?.role,
    user?.metadata?.role,
    user?.metadata?.organization_role,
    user?.organization_role,
  ]

  const nonEmptyCandidates = candidates.filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
  const ownerCandidate = nonEmptyCandidates.find((value) => normalizeRoleName(value) === 'owner')
  if (ownerCandidate) return 'owner'

  if (nonEmptyCandidates.length === 0) return 'customer'
  return normalizeRoleName(nonEmptyCandidates[0])
}

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
}

export const planAccess = {
  Starter: ['dashboard', 'customers', 'inventory', 'invoices', 'budgets', 'orders'],
  Growth: ['dashboard', 'customers', 'production', 'inventory', 'finance', 'invoices', 'reports', 'budgets', 'orders'],
  Pro: ['dashboard', 'customers', 'production', 'inventory', 'finance', 'invoices', 'reports', 'budgets', 'orders', 'problems', 'automation', 'users'],
  Enterprise: ['dashboard', 'customers', 'production', 'inventory', 'finance', 'invoices', 'reports', 'budgets', 'orders', 'problems', 'automation', 'users', 'governance'],
}

export function getVisibleNavigationForUser({ role = 'customer', plan = 'Starter', modules = [] } = {}) {
  const normalizedRole = normalizeRoleName(role)

  if (normalizedRole === 'owner') {
    return navigation
  }

  const allowedModules = Array.isArray(modules)
    ? modules
        .map((module) => String(module).trim())
        .filter(Boolean)
        .map((module) => module.toLowerCase())
    : []

  return navigation.filter((item) => {
    const moduleKey = String(item.id)
    const isExplicitlyAllowed = allowedModules.length > 0 ? allowedModules.includes(moduleKey.toLowerCase()) : true

    const allowedByRole = (moduleRoleAccess[item.id] ?? ['owner', 'admin', 'manager', 'employee', 'customer']).includes(normalizedRole)
    if (!allowedByRole) {
      return false
    }

    if (allowedModules.length > 0 && !allowedModules.includes(moduleKey.toLowerCase())) {
      return false
    }

    if (item.id === 'employees') {
      return plan === 'Enterprise'
    }

    if (isExplicitlyAllowed && allowedModules.length > 0) {
      return true
    }

    return (planAccess[plan] ?? []).includes(item.id)
  })
}
