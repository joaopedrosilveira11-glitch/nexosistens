import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validation.js'

const router = Router()

const financialEntrySchema = z.object({
  type: z.enum(['income', 'expense', 'receivable', 'payable']),
  description: z.string().min(3),
  amount: z.number().nonnegative(),
  dueDate: z.string().optional(),
  client: z.string().optional().default('Cliente interno'),
  category: z.string().optional().default('Serviço'),
  status: z.enum(['paid', 'open', 'canceled']).optional().default('open'),
})

const financeStore = new Map<string, Array<Record<string, unknown>>>()

const seedTransactions = (_companyId: string) => []

const getTransactionsForCompany = (companyId: string) => {
  const existing = financeStore.get(companyId)
  if (existing?.length) return existing

  const seeded = seedTransactions(companyId)
  financeStore.set(companyId, seeded)
  return seeded
}

const formatCurrency = (value: number) => Number(value || 0)

const toMonthlySeries = (transactions: Array<Record<string, unknown>>) => {
  const monthMap = new Map<string, { key: string, label: string, total: number, paid: number, open: number, canceled: number }>()

  transactions.forEach((transaction) => {
    const rawDate = String(transaction.dueDate || new Date().toISOString().slice(0, 10))
    const parsed = new Date(`${rawDate}T00:00:00`)
    const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
    const label = parsed.toLocaleString('pt-BR', { month: 'short' })
    const existing = monthMap.get(key) || { key, label, total: 0, paid: 0, open: 0, canceled: 0 }
    const amount = Number(transaction.amount || 0)

    existing.total += amount
    if (transaction.status === 'paid') existing.paid += amount
    else if (transaction.status === 'canceled') existing.canceled += amount
    else existing.open += amount

    monthMap.set(key, existing)
  })

  return [...monthMap.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-6)
}

const buildReceivablesList = (transactions: Array<Record<string, unknown>>) => {
  return [...transactions]
    .filter((transaction) => transaction.type === 'income' && transaction.status !== 'paid' && transaction.status !== 'canceled')
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
    .map((transaction) => ({
      id: String(transaction.id),
      client: String(transaction.client || 'Cliente não informado'),
      amount: Number(transaction.amount || 0),
      dueDate: String(transaction.dueDate || ''),
      category: String(transaction.category || 'Serviço'),
      description: String(transaction.description || 'Receita'),
      status: String(transaction.status || 'open'),
    }))
}

const buildSummary = (companyId: string) => {
  const transactions = getTransactionsForCompany(companyId)
  const totalBilled = transactions
    .filter((transaction) => transaction.type === 'income' && transaction.status !== 'canceled')
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
  const received = transactions
    .filter((transaction) => transaction.type === 'income' && transaction.status === 'paid')
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
  const open = transactions
    .filter((transaction) => transaction.type === 'income' && transaction.status === 'open')
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
  const canceled = transactions
    .filter((transaction) => transaction.type === 'income' && transaction.status === 'canceled')
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
  const costs = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
  const grossMargin = totalBilled - costs
  const margin = totalBilled > 0 ? (grossMargin / totalBilled) * 100 : 0
  const cash = received - open * 0.18
  const forecast = totalBilled * 1.12

  const metrics = [
    { label: 'Faturamento total', value: formatCurrency(totalBilled), delta: `${transactions.filter((transaction) => transaction.type === 'income').length} notas no período`, tone: 'up' },
    { label: 'Recebido', value: formatCurrency(received), delta: 'pagas no período', tone: 'up' },
    { label: 'Em aberto', value: formatCurrency(open), delta: 'pendentes de recebimento', tone: 'flat' },
    { label: 'Canceladas', value: formatCurrency(canceled), delta: 'documentos cancelados', tone: 'down' },
  ]

  const monthlySeries = toMonthlySeries(transactions)
  const dueItems = buildReceivablesList(transactions)
  const clientFinancialSummary = Array.from(
    [...transactions]
      .filter((transaction) => transaction.type === 'income')
      .reduce((acc, transaction) => {
        const client = String(transaction.client || 'Cliente não informado')
        const current = acc.get(client) || { client, count: 0, billed: 0, received: 0, open: 0, canceled: 0 }
        const amount = Number(transaction.amount || 0)

        current.count += 1
        current.billed += amount

        if (transaction.status === 'paid') current.received += amount
        else if (transaction.status === 'canceled') current.canceled += amount
        else current.open += amount

        acc.set(client, current)
        return acc
      }, new Map<string, { client: string, count: number, billed: number, received: number, open: number, canceled: number }>())
      .values(),
  )
    .map((entry) => ({ ...entry }))
    .sort((a, b) => b.billed - a.billed)

  const executiveSummary = {
    cash,
    forecast,
    margin,
    totalBilled,
    received,
    open,
    canceled,
    costs,
    grossMargin,
  }

  const agingSummary = {
    '1-30': dueItems.filter((item) => {
      if (!item.dueDate) return true
      const diffDays = Math.ceil((new Date(`${item.dueDate}T00:00:00`).getTime() - Date.now()) / 86400000)
      return diffDays <= 30
    }).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    '31-60': dueItems.filter((item) => {
      if (!item.dueDate) return false
      const diffDays = Math.ceil((new Date(`${item.dueDate}T00:00:00`).getTime() - Date.now()) / 86400000)
      return diffDays > 30 && diffDays <= 60
    }).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    '61-90': dueItems.filter((item) => {
      if (!item.dueDate) return false
      const diffDays = Math.ceil((new Date(`${item.dueDate}T00:00:00`).getTime() - Date.now()) / 86400000)
      return diffDays > 60 && diffDays <= 90
    }).reduce((sum, item) => sum + Number(item.amount || 0), 0),
  }

  const dreSummary = {
    revenue: totalBilled,
    operationalCosts: costs,
    grossProfit: grossMargin,
    operatingExpenses: totalBilled * 0.1,
    netProfit: grossMargin - totalBilled * 0.1,
  }

  return {
    summary: {
      totalBilled,
      received,
      open,
      canceled,
      costs,
      grossMargin,
      margin,
      cash,
      forecast,
      metrics,
      monthlySeries,
      dueItems,
      clientFinancialSummary,
      executiveSummary,
      agingSummary,
      dreSummary,
    },
    transactions,
  }
}

router.use(authenticate)

router.get('/', authorize(['owner', 'admin', 'manager', 'employee'], { plans: ['Growth', 'Pro', 'Enterprise'], module: 'finance' }), (req, res) => {
  const result = buildSummary(req.user!.companyId)
  return res.status(200).json({ transactions: result.transactions, summary: result.summary })
})

router.get('/summary', authorize(['owner', 'admin', 'manager'], { plans: ['Growth', 'Pro', 'Enterprise'], module: 'finance' }), (req, res) => {
  const result = buildSummary(req.user!.companyId)
  return res.status(200).json(result.summary)
})

router.post('/transactions', authorize(['owner', 'admin'], { plans: ['Growth', 'Pro', 'Enterprise'], module: 'finance' }), validateBody(financialEntrySchema), (req, res) => {
  const companyId = req.user!.companyId
  const transactions = getTransactionsForCompany(companyId)
  const payload = req.body as {
    type: 'income' | 'expense' | 'receivable' | 'payable'
    description: string
    amount: number
    dueDate?: string
    client?: string
    category?: string
    status?: 'paid' | 'open' | 'canceled'
  }

  const nextEntry = {
    id: `fin-${Date.now()}`,
    companyId,
    type: payload.type,
    description: payload.description.trim(),
    client: payload.client || 'Cliente interno',
    category: payload.category || 'Serviço',
    amount: Number(payload.amount || 0),
    dueDate: payload.dueDate || new Date().toISOString().slice(0, 10),
    status: payload.status || 'open',
    createdAt: new Date().toISOString(),
  }

  transactions.unshift(nextEntry)
  financeStore.set(companyId, transactions)

  return res.status(201).json({ transaction: nextEntry })
})

export default router