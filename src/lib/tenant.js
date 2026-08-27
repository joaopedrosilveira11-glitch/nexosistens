export function getCurrentTenantId() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem('nexo.tenant_id') || null
}

export function setCurrentTenantId(tenantId) {
  if (typeof window === 'undefined') {
    return
  }

  if (!tenantId) {
    window.localStorage.removeItem('nexo.tenant_id')
    return
  }

  window.localStorage.setItem('nexo.tenant_id', tenantId)
}

export function requireTenantAccess(tenantId, currentTenantId) {
  if (!tenantId || !currentTenantId) {
    throw new Error('Missing tenant context for secure access.')
  }

  if (tenantId !== currentTenantId) {
    throw new Error('Tenant mismatch. User cannot access this company data.')
  }

  return true
}

export function withTenantScope(query, tenantId, columnName = 'tenant_id') {
  if (!tenantId) {
    throw new Error('Tenant ID is required to build a scoped query.')
  }

  return query.eq(columnName, tenantId)
}
