import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../../middleware/auth.js'
import { requireTenantScope } from '../../middleware/tenant.js'
import { validateBody } from '../../middleware/validation.js'

const router = Router()

const customerSchema = z.object({
  name: z.string().min(2),
  document: z.string().optional().default(''),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().default(''),
  contact: z.string().optional().default(''),
  segment: z.string().optional().default('Comercial'),
  status: z.enum(['active', 'inactive']).default('active'),
  address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default('SP'),
  zipCode: z.string().optional().default(''),
  notes: z.string().optional().default(''),
})

const customerUpdateSchema = customerSchema.partial()

const customerStore = new Map<string, Array<Record<string, unknown>>>()

const seedCustomers = (_companyId: string) => []

const getCustomersForCompany = (companyId: string) => {
  const existing = customerStore.get(companyId)
  if (existing?.length) return existing

  const seeded = seedCustomers(companyId)
  customerStore.set(companyId, seeded)
  return seeded
}

router.use(authenticate)
router.use(requireTenantScope)

router.get('/', authorize(['owner', 'admin', 'manager', 'employee']), (req, res) => {
  const customers = getCustomersForCompany(req.user!.companyId)
  return res.status(200).json({ customers })
})

router.post('/', authorize(['owner', 'admin', 'manager']), validateBody(customerSchema), (req, res) => {
  const companyId = req.user!.companyId
  const customers = getCustomersForCompany(companyId)
  const payload = req.body as {
    name: string
    document?: string
    email?: string
    phone?: string
  contact?: string
  segment?: string
  status: 'active' | 'inactive'
  address?: string
  city?: string
  state?: string
  zipCode?: string
  notes?: string
}

const nextCustomer = {
  id: `cust-${Date.now()}`,
  companyId,
  name: payload.name.trim(),
  document: payload.document || '',
  email: payload.email || '',
  phone: payload.phone || '',
  contact: payload.contact || payload.email || payload.phone || '',
  segment: payload.segment || 'Comercial',
  status: payload.status,
  address: payload.address || '',
  city: payload.city || '',
  state: payload.state || 'SP',
  zipCode: payload.zipCode || '',
  notes: payload.notes || '',
  createdAt: new Date().toISOString(),
}

customers.push(nextCustomer)
customerStore.set(companyId, customers)

return res.status(201).json({ customer: nextCustomer })
})

router.put('/:id', authorize(['owner', 'admin', 'manager']), validateBody(customerUpdateSchema), (req, res) => {
const companyId = req.user!.companyId
const customers = getCustomersForCompany(companyId)
const customerId = String(req.params.id)
const index = customers.findIndex((customer) => String(customer.id) === customerId)

if (index === -1) {
  return res.status(404).json({ error: 'Customer not found.' })
}

const existing = customers[index] as Record<string, unknown>
const payload = req.body as {
  name?: string
  document?: string
  email?: string
  phone?: string
  contact?: string
  segment?: string
  status?: 'active' | 'inactive'
  address?: string
  city?: string
  state?: string
  zipCode?: string
  notes?: string
}

const nextCustomer = {
  ...existing,
  ...payload,
  companyId,
  name: payload.name ? payload.name.trim() : String(existing.name ?? ''),
  document: payload.document ?? String(existing.document ?? ''),
  email: payload.email ?? String(existing.email ?? ''),
  phone: payload.phone ?? String(existing.phone ?? ''),
  contact: payload.contact ?? String(existing.contact ?? payload.email ?? existing.email ?? payload.phone ?? existing.phone ?? ''),
  segment: payload.segment ?? String(existing.segment ?? 'Comercial'),
  status: payload.status ?? String(existing.status ?? 'active'),
  address: payload.address ?? String(existing.address ?? ''),
  city: payload.city ?? String(existing.city ?? ''),
  state: payload.state ?? String(existing.state ?? 'SP'),
  zipCode: payload.zipCode ?? String(existing.zipCode ?? ''),
  notes: payload.notes ?? String(existing.notes ?? ''),
  updatedAt: new Date().toISOString(),
}

customers[index] = nextCustomer
customerStore.set(companyId, customers)

return res.status(200).json({ customer: nextCustomer })
})

router.delete('/:id', authorize(['owner', 'admin', 'manager']), (req, res) => {
const companyId = req.user!.companyId
const customers = getCustomersForCompany(companyId)
const customerId = String(req.params.id)
const filtered = customers.filter((customer) => String(customer.id) !== customerId)

if (filtered.length === customers.length) {
  return res.status(404).json({ error: 'Customer not found.' })
}

customerStore.set(companyId, filtered)
return res.status(200).json({ deleted: true, id: customerId })
})

export default router