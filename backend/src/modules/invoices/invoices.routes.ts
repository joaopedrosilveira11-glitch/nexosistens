import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../../middleware/auth.js'
import { requireTenantScope } from '../../middleware/tenant.js'
import { validateBody } from '../../middleware/validation.js'

const router = Router()

const invoiceSchema = z.object({
  client: z.string().min(2),
  clientDocument: z.string().optional().default(''),
  clientAddress: z.string().optional().default(''),
  companyName: z.string().optional().default('NEXO Sistemas'),
  brandName: z.string().optional().default('NEXO Sistemas'),
  logoUrl: z.string().optional().default(''),
  companyDocument: z.string().optional().default('12.345.678/0001-90'),
  companyAddress: z.string().optional().default('Rua da Inovação, 123 - São Paulo/SP'),
  invoiceNumber: z.string().optional().default(''),
  series: z.string().optional().default('1'),
  natureOfOperation: z.string().optional().default('Serviços prestados'),
  description: z.string().optional().default('Serviço prestado'),
  quantity: z.number().positive().optional().default(1),
  unitPrice: z.number().nonnegative().optional().default(0),
  amount: z.number().positive(),
  notes: z.string().optional().default(''),
  dueDate: z.string().min(1),
  type: z.string().min(1),
  status: z.string().min(1).default('Emitida'),
})
const invoiceUpdateSchema = invoiceSchema.partial()

const invoiceStore = new Map<string, Array<Record<string, unknown>>>()

const seedInvoices = (_companyId: string) => []

const getInvoicesForCompany = (companyId: string) => {
  const existing = invoiceStore.get(companyId)
  if (existing?.length) return existing

  const seeded = seedInvoices(companyId)
  invoiceStore.set(companyId, seeded)
  return seeded
}

router.use(authenticate)
router.use(requireTenantScope)

router.get('/', authorize(['owner', 'admin', 'manager', 'employee']), (req, res) => {
  const invoices = getInvoicesForCompany(req.user!.companyId)
  return res.status(200).json({ invoices })
})

router.get('/summary', authorize(['owner', 'admin', 'manager']), (req, res) => {
  const invoices = getInvoicesForCompany(req.user!.companyId)

  const total = invoices.length
  const openValue = invoices
    .filter((invoice) => invoice.status !== 'Paga')
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
  const dueTodayCount = invoices.filter((invoice) => invoice.dueDate === new Date().toISOString().slice(0, 10)).length

  return res.status(200).json({
    total,
    openValue,
    dueTodayCount,
    invoices,
  })
})

router.post('/', authorize(['owner', 'admin', 'manager']), validateBody(invoiceSchema), (req, res) => {
  const companyId = req.user!.companyId
  const invoices = getInvoicesForCompany(companyId)
  const payload = req.body as {
    client: string
    clientDocument?: string
    clientAddress?: string
    companyName?: string
    brandName?: string
    logoUrl?: string
    companyDocument?: string
    companyAddress?: string
    invoiceNumber?: string
    series?: string
    natureOfOperation?: string
    description?: string
    quantity?: number
    unitPrice?: number
    amount: number
    notes?: string
    dueDate: string
    type: 'Serviço' | 'Produto' | 'Recorrência' | 'Servico' | 'Recorrencia'
    status?: 'Emitida' | 'Paga' | 'Cancelada' | 'Em validação' | 'Em validacao'
  }

  const normalizedType = payload.type === 'Servico' ? 'Serviço' : payload.type === 'Recorrencia' ? 'Recorrência' : payload.type
  const normalizedStatus = payload.status === 'Em validacao' ? 'Em validação' : payload.status || 'Emitida'
  const quantity = Number(payload.quantity || 1)
  const unitPrice = Number(payload.unitPrice || payload.amount || 0)

  const nextInvoice = {
    id: `NF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(invoices.length + 1).padStart(3, '0')}`,
    companyId,
    client: payload.client.trim(),
    clientDocument: payload.clientDocument || '',
    clientAddress: payload.clientAddress || '',
    companyName: payload.companyName || payload.brandName || 'NEXO Sistemas',
    brandName: payload.brandName || payload.companyName || 'NEXO Sistemas',
    logoUrl: payload.logoUrl || '',
    companyDocument: payload.companyDocument || '12.345.678/0001-90',
    companyAddress: payload.companyAddress || 'Rua da Inovação, 123 - São Paulo/SP',
    invoiceNumber: payload.invoiceNumber || `NF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(invoices.length + 1).padStart(3, '0')}`,
    series: payload.series || '1',
    natureOfOperation: payload.natureOfOperation || 'Serviços prestados',
    description: payload.description || 'Serviço prestado',
    quantity,
    unitPrice,
    amount: Number(payload.amount),
    notes: payload.notes || '',
    dueDate: payload.dueDate,
    type: normalizedType,
    status: normalizedStatus,
    createdAt: new Date().toISOString(),
  }

  invoices.unshift(nextInvoice)
  invoiceStore.set(companyId, invoices)

  return res.status(201).json({ invoice: nextInvoice })
})

router.put('/:id', authorize(['owner', 'admin', 'manager']), validateBody(invoiceUpdateSchema), (req, res) => {
  const companyId = req.user!.companyId
  const invoices = getInvoicesForCompany(companyId)
  const invoiceId = String(req.params.id)
  const index = invoices.findIndex((invoice) => String(invoice.id) === invoiceId || String(invoice.invoiceNumber) === invoiceId)

  if (index === -1) {
    return res.status(404).json({ error: 'Invoice not found.' })
  }

  const existing = invoices[index] as Record<string, unknown>
  const nextInvoice = {
    ...existing,
    ...req.body,
    companyId,
    amount: Number(req.body.amount ?? existing.amount ?? 0),
    quantity: Number(req.body.quantity ?? existing.quantity ?? 1),
    unitPrice: Number(req.body.unitPrice ?? existing.unitPrice ?? 0),
    dueDate: req.body.dueDate ?? existing.dueDate,
    status: req.body.status ?? existing.status ?? 'Emitida',
    client: req.body.client ? String(req.body.client).trim() : String(existing.client ?? ''),
    companyName: req.body.companyName ?? req.body.brandName ?? existing.companyName ?? 'NEXO Sistemas',
    brandName: req.body.brandName ?? req.body.companyName ?? existing.brandName ?? 'NEXO Sistemas',
    logoUrl: req.body.logoUrl ?? existing.logoUrl ?? '',
    companyDocument: req.body.companyDocument ?? existing.companyDocument ?? '12.345.678/0001-90',
    companyAddress: req.body.companyAddress ?? existing.companyAddress ?? 'Rua da Inovação, 123 - São Paulo/SP',
    invoiceNumber: req.body.invoiceNumber ?? existing.invoiceNumber ?? invoiceId,
    series: req.body.series ?? existing.series ?? '1',
    natureOfOperation: req.body.natureOfOperation ?? existing.natureOfOperation ?? 'Serviços prestados',
    description: req.body.description ?? existing.description ?? 'Serviço prestado',
    notes: req.body.notes ?? existing.notes ?? '',
    type: req.body.type ?? existing.type ?? 'Serviço',
    updatedAt: new Date().toISOString(),
  }

  invoices[index] = nextInvoice
  invoiceStore.set(companyId, invoices)

  return res.status(200).json({ invoice: nextInvoice })
})

router.delete('/:id', authorize(['owner', 'admin', 'manager']), (req, res) => {
  const companyId = req.user!.companyId
  const invoices = getInvoicesForCompany(companyId)
  const invoiceId = String(req.params.id)
  const filteredInvoices = invoices.filter((invoice) => String(invoice.id) !== invoiceId && String(invoice.invoiceNumber) !== invoiceId)

  if (filteredInvoices.length === invoices.length) {
    return res.status(404).json({ error: 'Invoice not found.' })
  }

  invoiceStore.set(companyId, filteredInvoices)
  return res.status(200).json({ deleted: true, id: invoiceId })
})

export default router
