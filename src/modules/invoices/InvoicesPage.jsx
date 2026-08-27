import { useEffect, useMemo, useState } from 'react'

const API_BASE = 'http://localhost:4000/api'
const customerStorageKey = 'nexo-customers'
const invoiceStorageKey = 'nexo-invoices'

const invoiceDefaults = {
  client: '',
  clientDocument: '',
  clientAddress: '',
  companyName: 'NEXO Sistemas',
  brandName: 'NEXO Sistemas',
  logoUrl: '',
  companyDocument: '12.345.678/0001-90',
  companyAddress: 'Rua da Inovação, 123 - São Paulo/SP',
  invoiceNumber: '',
  series: '1',
  natureOfOperation: 'Serviços prestados',
  description: 'Consultoria e implementação de automações',
  quantity: '1',
  unitPrice: '2450.00',
  amount: '2450.00',
  icms: '0.00',
  iss: '0.00',
  ipi: '0.00',
  notes: '',
  dueDate: '2026-09-03',
  type: 'Serviço',
}

const defaultCustomerForm = {
  name: '',
  document: '',
  email: '',
  phone: '',
  segment: 'Comercial',
  status: 'Ativo',
  contact: '',
  address: '',
  city: '',
  state: 'SP',
  zipCode: '',
  notes: '',
}

const initialCustomerRows = []

const defaultInvoices = []

const buildCustomerKey = (customer) => `${customer?.name || ''}|${customer?.contact || ''}|${customer?.segment || ''}`.toLowerCase()

const formatCurrency = (value) => {
  const numberValue = Number(value || 0)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numberValue)
}

const parseCurrency = (value) => {
  const sanitized = String(value || '').replace(/[R$\s.]/g, '').replace(',', '.')
  const parsed = Number(sanitized)
  return Number.isFinite(parsed) ? parsed : 0
}

const generateInvoiceNumber = (items = []) => {
  const nextSequential = (items || []).reduce((max, invoice) => {
    const rawNumber = Number(String(invoice?.invoiceNumber || invoice?.id || '').match(/(\d+)$/)?.[1] || 0)
    return Math.max(max, rawNumber)
  }, 0)

  return `NF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(nextSequential + 1).padStart(3, '0')}`
}

const normalizeCustomer = (customer = {}) => ({
  name: customer.name || customer.customerName || '',
  document: customer.document || customer.cpfCnpj || '',
  email: customer.email || '',
  phone: customer.phone || customer.contact || '',
  segment: customer.segment || 'Comercial',
  status: customer.status === 'inactive' ? 'Pendente' : 'Ativo',
  contact: customer.contact || customer.phone || customer.email || '',
  address: customer.address || '',
  city: customer.city || '',
  state: customer.state || 'SP',
  zipCode: customer.zipCode || '',
  notes: customer.notes || '',
})

const normalizeInvoiceType = (type) => (type === 'Servico' ? 'Serviço' : type === 'Recorrencia' ? 'Recorrência' : type || 'Serviço')

const normalizeInvoice = (invoice = {}) => ({
  id: invoice.id || `NF-${Date.now()}`,
  client: invoice.client || '',
  clientDocument: invoice.clientDocument || '',
  clientAddress: invoice.clientAddress || '',
  companyName: invoice.companyName || invoice.brandName || 'NEXO Sistemas',
  brandName: invoice.brandName || invoice.companyName || 'NEXO Sistemas',
  logoUrl: invoice.logoUrl || '',
  companyDocument: invoice.companyDocument || '12.345.678/0001-90',
  companyAddress: invoice.companyAddress || 'Rua da Inovação, 123 - São Paulo/SP',
  invoiceNumber: invoice.invoiceNumber || invoice.id || '',
  series: invoice.series || '1',
  natureOfOperation: invoice.natureOfOperation || 'Serviços prestados',
  description: invoice.description || 'Consultoria e implementação de automações',
  quantity: Number(invoice.quantity || 1),
  unitPrice: Number(invoice.unitPrice || invoice.amount || 0),
  amount: Number(invoice.amount || 0),
  icms: Number(invoice.icms || 0),
  iss: Number(invoice.iss || 0),
  ipi: Number(invoice.ipi || 0),
  notes: invoice.notes || '',
  status: invoice.status === 'Em validacao' ? 'Em validação' : invoice.status || 'Emitida',
  dueDate: invoice.dueDate || new Date().toISOString().slice(0, 10),
  type: normalizeInvoiceType(invoice.type),
})

const getAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

const getInvoiceDetailValues = (invoice) => {
  const quantity = Number(invoice.quantity || 1)
  const unitPrice = Number(invoice.unitPrice || invoice.amount || 0)
  const amount = Number(invoice.amount || quantity * unitPrice)
  const icms = Number(invoice.icms || 0)
  const iss = Number(invoice.iss || 0)
  const ipi = Number(invoice.ipi || 0)

  return { quantity, unitPrice, amount, icms, iss, ipi, taxesTotal: icms + iss + ipi }
}

export default function InvoicesPage({ session }) {
  const token = session?.token
  const [form, setForm] = useState(invoiceDefaults)
  const [customers, setCustomers] = useState(() => {
    if (typeof window === 'undefined') return initialCustomerRows
    try {
      const stored = window.localStorage.getItem(customerStorageKey)
      return stored ? JSON.parse(stored) : initialCustomerRows
    } catch {
      return initialCustomerRows
    }
  })
  const [invoices, setInvoices] = useState(() => {
    if (typeof window === 'undefined') return defaultInvoices
    try {
      const stored = window.localStorage.getItem(invoiceStorageKey)
      return stored ? JSON.parse(stored) : defaultInvoices
    } catch {
      return defaultInvoices
    }
  })
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [customerMode, setCustomerMode] = useState('existing')
  const [customerForm, setCustomerForm] = useState(defaultCustomerForm)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedClientFilter, setSelectedClientFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [editingInvoiceId, setEditingInvoiceId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const total = useMemo(() => invoices.length, [invoices])
  const openInvoicesValue = useMemo(
    () => invoices.filter((invoice) => invoice.status !== 'Paga').reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
    [invoices],
  )
  const dueTodayCount = useMemo(
    () => invoices.filter((invoice) => invoice.dueDate === new Date().toISOString().slice(0, 10)).length,
    [invoices],
  )
  const filteredInvoices = useMemo(() => {
    const normalizedInvoices = invoices.filter((invoice) => {
      const matchesStatus = statusFilter === 'all' ? true : (invoice.status || 'Emitida') === statusFilter
      const matchesClient = selectedClientFilter === 'all' ? true : (invoice.client || '').toLowerCase() === selectedClientFilter.toLowerCase()
      const invoiceDate = invoice.dueDate || invoice.createdAt || ''
      const matchesFrom = !dateFrom || invoiceDate >= dateFrom
      const matchesTo = !dateTo || invoiceDate <= dateTo
      return matchesStatus && matchesClient && matchesFrom && matchesTo
    })

    return [...normalizedInvoices].sort((a, b) => String(b.dueDate || '').localeCompare(String(a.dueDate || '')))
  }, [invoices, statusFilter, selectedClientFilter, dateFrom, dateTo])


  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncCustomers = () => {
      try {
        const stored = window.localStorage.getItem(customerStorageKey)
        if (stored) {
          const parsed = JSON.parse(stored)
          setCustomers(Array.isArray(parsed) ? parsed : initialCustomerRows)
        }
      } catch {
        setCustomers(initialCustomerRows)
      }
    }

    const syncInvoices = () => {
      try {
        const stored = window.localStorage.getItem(invoiceStorageKey)
        if (stored) {
          const parsed = JSON.parse(stored)
          setInvoices(Array.isArray(parsed) ? parsed : defaultInvoices)
        }
      } catch {
        setInvoices(defaultInvoices)
      }
    }

    syncCustomers()
    syncInvoices()
    window.addEventListener('nexo-customers-updated', syncCustomers)
    return () => window.removeEventListener('nexo-customers-updated', syncCustomers)
  }, [])

  useEffect(() => {
    if (!token) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(invoiceStorageKey, JSON.stringify(invoices))
      }
      return
    }

    const loadData = async () => {
      setIsLoading(true)

      try {
        const [customersResponse, invoicesResponse] = await Promise.all([
          fetch(`${API_BASE}/customers`, { headers: getAuthHeaders(token) }),
          fetch(`${API_BASE}/invoices`, { headers: getAuthHeaders(token) }),
        ])

        if (customersResponse.ok) {
          const customerPayload = await customersResponse.json()
          const nextCustomers = (customerPayload.customers || []).map((customer) => normalizeCustomer(customer))
          setCustomers(nextCustomers)
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(customerStorageKey, JSON.stringify(nextCustomers))
          }
        }

        if (invoicesResponse.ok) {
          const invoicePayload = await invoicesResponse.json()
          const nextInvoices = (invoicePayload.invoices || []).map((invoice) => normalizeInvoice(invoice))
          setInvoices(nextInvoices)
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(invoiceStorageKey, JSON.stringify(nextInvoices))
          }
        }
      } catch (error) {
        console.warn('Failed to load invoice data from backend, using local fallback.', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [token])

  const persistCustomers = (nextCustomers) => {
    setCustomers(nextCustomers)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(customerStorageKey, JSON.stringify(nextCustomers))
      window.dispatchEvent(new CustomEvent('nexo-customers-updated'))
    }
  }

  const onChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const applyCustomerToInvoiceForm = (customer) => {
    if (!customer) {
      return
    }

    setForm((current) => ({
      ...current,
      client: customer.name || current.client || '',
      clientDocument: customer.document || current.clientDocument || '',
      clientAddress: customer.address || current.clientAddress || '',
    }))
  }

  const handleCustomerSelection = (value) => {
    setSelectedCustomer(value)
    const customer = customers.find((entry) => entry.name === value)

    if (customer) {
      applyCustomerToInvoiceForm(customer)
      return
    }

    setForm((current) => ({ ...current, client: value || '' }))
  }

  const handleSaveCustomer = async () => {
    if (!customerForm.name.trim() || !customerForm.contact.trim()) {
      return
    }

    const nextCustomerPayload = {
      name: customerForm.name.trim(),
      document: customerForm.document.trim(),
      segment: customerForm.segment,
      status: customerForm.status === 'Ativo' ? 'active' : 'inactive',
      phone: customerForm.phone.trim() || customerForm.contact.trim(),
      email: customerForm.email.trim() || customerForm.contact.trim(),
      address: customerForm.address.trim(),
      city: customerForm.city.trim(),
      state: customerForm.state,
      zipCode: customerForm.zipCode.trim(),
      notes: customerForm.notes.trim(),
    }

    if (token) {
      try {
        const response = await fetch(`${API_BASE}/customers`, {
          method: 'POST',
          headers: getAuthHeaders(token),
          body: JSON.stringify(nextCustomerPayload),
        })

        if (!response.ok) {
          throw new Error('Não foi possível salvar o cliente no backend.')
        }

        const payload = await response.json()
        const storedCustomer = normalizeCustomer(payload.customer)
        const nextCustomers = [...customers.filter((customer) => customer.name !== storedCustomer.name), storedCustomer]
        persistCustomers(nextCustomers)
        setSelectedCustomer(storedCustomer.name)
        setForm((current) => ({ ...current, client: storedCustomer.name }))
        setCustomerForm(defaultCustomerForm)
        setCustomerMode('existing')
        return
      } catch (error) {
        console.warn('Backend customer save failed, fallback to local storage.', error)
      }
    }

    const nextCustomer = {
      name: customerForm.name.trim(),
      document: customerForm.document.trim(),
      email: customerForm.email.trim(),
      phone: customerForm.phone.trim(),
      segment: customerForm.segment,
      status: customerForm.status,
      contact: customerForm.contact.trim() || customerForm.email.trim() || customerForm.phone.trim(),
      address: customerForm.address.trim(),
      city: customerForm.city.trim(),
      state: customerForm.state,
      zipCode: customerForm.zipCode.trim(),
      notes: customerForm.notes.trim(),
    }

    const exists = customers.some((customer) => buildCustomerKey(customer) === buildCustomerKey(nextCustomer))
    const nextCustomers = exists ? customers.map((customer) => (buildCustomerKey(customer) === buildCustomerKey(nextCustomer) ? nextCustomer : customer)) : [...customers, nextCustomer]

    persistCustomers(nextCustomers)
    setSelectedCustomer(nextCustomer.name)
    setForm((current) => ({ ...current, client: nextCustomer.name }))
    setCustomerForm(defaultCustomerForm)
    setCustomerMode('existing')
  }

  const buildInvoicePayload = (statusOverride = 'Emitida') => {
    const quantity = Number(form.quantity || 1)
    const unitPrice = parseCurrency(form.unitPrice || form.amount)
    const icms = parseCurrency(form.icms)
    const iss = parseCurrency(form.iss)
    const ipi = parseCurrency(form.ipi)
    const amount = parseCurrency(form.amount) || quantity * unitPrice

    return {
      client: form.client.trim(),
      clientDocument: form.clientDocument.trim(),
      clientAddress: form.clientAddress.trim(),
      companyName: form.companyName.trim(),
      brandName: form.companyName.trim(),
      logoUrl: form.logoUrl.trim(),
      companyDocument: form.companyDocument.trim(),
      companyAddress: form.companyAddress.trim(),
      invoiceNumber: form.invoiceNumber.trim() || generateInvoiceNumber(invoices),
      series: form.series.trim() || '1',
      natureOfOperation: form.natureOfOperation.trim() || 'Serviços prestados',
      description: form.description.trim() || 'Serviço prestado',
      quantity,
      unitPrice,
      amount,
      icms,
      iss,
      ipi,
      notes: form.notes.trim(),
      dueDate: form.dueDate,
      type: normalizeInvoiceType(form.type),
      status: statusOverride,
    }
  }

  const handleEmitInvoice = async () => {
    if (!form.client.trim() || !form.amount || parseCurrency(form.amount) <= 0 || !form.dueDate) {
      return
    }

    const requestBody = buildInvoicePayload('Emitida')

    if (editingInvoiceId) {
      const invoiceId = editingInvoiceId
      if (token) {
        try {
          const response = await fetch(`${API_BASE}/invoices/${invoiceId}`, {
            method: 'PUT',
            headers: getAuthHeaders(token),
            body: JSON.stringify(requestBody),
          })
          if (!response.ok) throw new Error('Falha ao editar a NF.')
          const payload = await response.json()
          const nextInvoice = normalizeInvoice(payload.invoice)
          setInvoices((current) => current.map((invoice) => (invoice.id === invoiceId || invoice.invoiceNumber === invoiceId ? nextInvoice : invoice)))
          setEditingInvoiceId(null)
          setForm({ ...invoiceDefaults, dueDate: form.dueDate })
          setSelectedCustomer('')
          return
        } catch (error) {
          console.warn('Editar NF no backend falhou, usando fallback local.', error)
        }
      }

      setInvoices((current) =>
        current.map((invoice) => (invoice.id === invoiceId || invoice.invoiceNumber === invoiceId ? normalizeInvoice({ ...invoice, ...requestBody, id: invoiceId, invoiceNumber: requestBody.invoiceNumber }) : invoice)),
      )
      setEditingInvoiceId(null)
      setForm({ ...invoiceDefaults, dueDate: form.dueDate })
      setSelectedCustomer('')
      return
    }

    if (token) {
      try {
        const response = await fetch(`${API_BASE}/invoices`, {
          method: 'POST',
          headers: getAuthHeaders(token),
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          throw new Error('Não foi possível emitir a NF no backend.')
        }

        const payload = await response.json()
        const nextInvoice = normalizeInvoice(payload.invoice)
        setInvoices((current) => [nextInvoice, ...current])
        setForm({ ...invoiceDefaults, dueDate: form.dueDate })
        setSelectedCustomer('')
        return
      } catch (error) {
        console.warn('Backend invoice create failed, fallback to local storage.', error)
      }
    }

    const nextInvoice = {
      id: requestBody.invoiceNumber || generateInvoiceNumber(invoices),
      client: requestBody.client,
      clientDocument: requestBody.clientDocument,
      clientAddress: requestBody.clientAddress,
      companyName: requestBody.companyName,
      brandName: requestBody.brandName,
      logoUrl: requestBody.logoUrl,
      companyDocument: requestBody.companyDocument,
      companyAddress: requestBody.companyAddress,
      invoiceNumber: requestBody.invoiceNumber || generateInvoiceNumber(invoices),
      series: requestBody.series,
      natureOfOperation: requestBody.natureOfOperation,
      description: requestBody.description,
      quantity: requestBody.quantity,
      unitPrice: requestBody.unitPrice,
      amount: requestBody.amount,
      icms: requestBody.icms,
      iss: requestBody.iss,
      ipi: requestBody.ipi,
      notes: requestBody.notes,
      status: 'Emitida',
      dueDate: requestBody.dueDate,
      type: requestBody.type,
    }

    setInvoices((current) => [nextInvoice, ...current])
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(invoiceStorageKey, JSON.stringify([nextInvoice, ...invoices]))
    }
    setForm({ ...invoiceDefaults, dueDate: form.dueDate })
    setSelectedCustomer('')
  }

  const handleEditInvoice = (invoice) => {
    setEditingInvoiceId(invoice.id)
    setSelectedCustomer(invoice.client)
    setCustomerMode('existing')
    setForm({
      ...invoiceDefaults,
      client: invoice.client || '',
      clientDocument: invoice.clientDocument || '',
      clientAddress: invoice.clientAddress || '',
      companyName: invoice.companyName || invoice.brandName || 'NEXO Sistemas',
      brandName: invoice.brandName || invoice.companyName || 'NEXO Sistemas',
      logoUrl: invoice.logoUrl || '',
      companyDocument: invoice.companyDocument || '12.345.678/0001-90',
      companyAddress: invoice.companyAddress || 'Rua da Inovação, 123 - São Paulo/SP',
      invoiceNumber: invoice.invoiceNumber || invoice.id || '',
      series: invoice.series || '1',
      natureOfOperation: invoice.natureOfOperation || 'Serviços prestados',
      description: invoice.description || 'Serviço prestado',
      quantity: String(invoice.quantity || 1),
      unitPrice: String(invoice.unitPrice || invoice.amount || 0),
      amount: String(invoice.amount || 0),
      icms: String(invoice.icms || 0),
      iss: String(invoice.iss || 0),
      ipi: String(invoice.ipi || 0),
      notes: invoice.notes || '',
      dueDate: invoice.dueDate || '',
      type: invoice.type || 'Serviço',
    })
  }

  const updateInvoiceStatus = async (invoiceId, nextStatus) => {
    const target = invoices.find((invoice) => invoice.id === invoiceId || invoice.invoiceNumber === invoiceId)
    if (!target) return

    const updated = normalizeInvoice({ ...target, status: nextStatus })

    if (token) {
      try {
        const response = await fetch(`${API_BASE}/invoices/${invoiceId}`, {
          method: 'PUT',
          headers: getAuthHeaders(token),
          body: JSON.stringify({ ...buildInvoicePayload(nextStatus), id: invoiceId, invoiceNumber: target.invoiceNumber || invoiceId }),
        })
        if (!response.ok) throw new Error('Falha ao atualizar status da NF.')
        const payload = await response.json()
        const persisted = normalizeInvoice(payload.invoice)
        setInvoices((current) => current.map((item) => (item.id === invoiceId || item.invoiceNumber === invoiceId ? persisted : item)))
        return
      } catch (error) {
        console.warn('Atualização de status no backend falhou, usando fallback local.', error)
      }
    }

    setInvoices((current) => current.map((invoice) => (invoice.id === invoiceId || invoice.invoiceNumber === invoiceId ? updated : invoice)))
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(invoiceStorageKey, JSON.stringify(invoices.map((invoice) => (invoice.id === invoiceId || invoice.invoiceNumber === invoiceId ? updated : invoice))))
    }
  }

  const previewInvoice = {
    ...form,
    id: `NF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String((invoices || []).length + 1).padStart(3, '0')}`,
    amount: parseCurrency(form.amount || 0),
    quantity: Number(form.quantity || 1),
    unitPrice: parseCurrency(form.unitPrice || form.amount || 0),
    icms: parseCurrency(form.icms || 0),
    iss: parseCurrency(form.iss || 0),
    ipi: parseCurrency(form.ipi || 0),
    status: 'Emitida',
    companyName: form.companyName || form.brandName || 'NEXO Sistemas',
    brandName: form.brandName || form.companyName || 'NEXO Sistemas',
    logoUrl: form.logoUrl || '',
    companyDocument: form.companyDocument || '12.345.678/0001-90',
    companyAddress: form.companyAddress || 'Rua da Inovação, 123 - São Paulo/SP',
    invoiceNumber: form.invoiceNumber || generateInvoiceNumber(invoices || []),
    series: form.series || '1',
    natureOfOperation: form.natureOfOperation || 'Serviços prestados',
    description: form.description || 'Serviço prestado',
  }

  const buildInvoiceHtml = (invoice) => {
    const detail = getInvoiceDetailValues(invoice)
    const issuer = invoice.companyName || invoice.brandName || 'NEXO Sistemas'
    const issuerDocument = invoice.companyDocument || '12.345.678/0001-90'
    const issuerAddress = invoice.companyAddress || 'Rua da Inovação, 123 - São Paulo/SP'
    const taxes = [
      { label: 'ICMS', value: Number(invoice.icms || 0) },
      { label: 'ISS', value: Number(invoice.iss || 0) },
      { label: 'IPI', value: Number(invoice.ipi || 0) },
    ].filter((tax) => tax.value > 0)
    const subtotal = Math.max(0, detail.amount - detail.taxesTotal)
    const logoMarkup = invoice.logoUrl
      ? `<img src="${invoice.logoUrl}" alt="Logo" style="max-height: 48px; max-width: 140px; object-fit: contain; border-radius: 10px;" />`
      : `<div style="font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #60759e;">${issuer}</div>`

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${invoice.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; background: #f3f6fb; color: #152033; }
            .invoice-box {
              max-width: 900px;
              margin: 0 auto;
              background: #ffffff;
              border: 1px solid #dfe6ef;
              border-radius: 18px;
              padding: 28px;
              box-shadow: 0 8px 18px rgba(27, 48, 79, 0.08);
            }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
            .brand { display: flex; align-items: center; min-height: 48px; }
            .number-meta { color: #475a7a; margin-top: 8px; }
            .title { font-size: 30px; font-weight: 800; margin-top: 6px; }
            .status { font-weight: 700; font-size: 14px; color: #2d5ca8; }
            .section { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 20px; }
            .card { background: #f5f8ff; border: 1px solid #e1eaf7; border-radius: 12px; padding: 16px; }
            h3 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #4a5a75; }
            .muted { color: #475a7a; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
            th, td { border-bottom: 1px solid #dde7f3; padding: 12px 10px; text-align: left; }
            th { color: #4a5a75; font-size: 12px; text-transform: uppercase; }
            .totals { margin-top: 16px; max-width: 260px; margin-left: auto; }
            .tax-row { display: flex; justify-content: space-between; margin-top: 8px; }
            .total { font-size: 26px; font-weight: 800; text-align: right; margin-top: 12px; }
            .notes { margin-top: 16px; border-top: 1px solid #e1eaf7; padding-top: 12px; color: #475a7a; }
            @media print { body { margin: 0; background: white; } .invoice-box { box-shadow: none; border: none; } }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <div class="header">
              <div>
                <div class="brand">${logoMarkup}</div>
                <div class="title">Nota Fiscal</div>
                <div class="number-meta">Nº ${invoice.invoiceNumber || invoice.id} • Série ${invoice.series || '1'} • ${invoice.natureOfOperation || 'Serviços prestados'}</div>
              </div>
              <div class="status">${invoice.status || 'Emitida'}</div>
            </div>

            <div class="section">
              <div class="card">
                <h3>Emitente</h3>
                <div><strong>${issuer}</strong></div>
                <div class="muted">${issuerDocument}</div>
                <div class="muted">${issuerAddress}</div>
              </div>
              <div class="card">
                <h3>Destinatário</h3>
                <div><strong>${invoice.client || 'Cliente não informado'}</strong></div>
                <div class="muted">${invoice.clientDocument || 'CPF/CNPJ não informado'}</div>
                <div class="muted">${invoice.clientAddress || 'Endereço não informado'}</div>
              </div>
            </div>

            <div class="card">
              <h3>Descrição da operação</h3>
              <div>${invoice.description || 'Serviço prestado'}</div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qtd</th>
                  <th>Vlr. unit.</th>
                  <th>Vlr. total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${invoice.type || 'Serviço'}</td>
                  <td>${detail.quantity}</td>
                  <td>${formatCurrency(detail.unitPrice)}</td>
                  <td>${formatCurrency(detail.amount)}</td>
                </tr>
              </tbody>
            </table>

            <div class="totals">
              <div class="tax-row"><span>Subtotal</span><strong>${formatCurrency(subtotal)}</strong></div>
              ${taxes.map((tax) => `<div class="tax-row"><span>${tax.label}</span><strong>${formatCurrency(tax.value)}</strong></div>`).join('')}
              <div class="total">Total: ${formatCurrency(detail.amount)}</div>
            </div>

            <div class="notes">
              <strong>Vencimento:</strong> ${invoice.dueDate}
              ${invoice.notes ? `<div style="margin-top: 10px;"><strong>Observações:</strong> ${invoice.notes}</div>` : ''}
            </div>
          </div>
        </body>
      </html>
    `
  }

  const handlePrintInvoice = (invoice) => {
    const printWindow = window.open('', '_blank', 'width=900,height=800')

    if (!printWindow) {
      return
    }

    printWindow.document.write(buildInvoiceHtml(invoice))
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      setTimeout(() => printWindow.close(), 1200)
    }, 250)
  }

  const handleDownloadInvoicePdf = (invoice) => {
    const printWindow = window.open('', '_blank', 'width=900,height=800')

    if (!printWindow) {
      return
    }

    printWindow.document.write(buildInvoiceHtml(invoice))
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const handleSendInvoiceEmail = (invoice) => {
    const subject = encodeURIComponent(`NF ${invoice.invoiceNumber || invoice.id} - ${invoice.companyName || 'NEXO Sistemas'}`)
    const body = encodeURIComponent(
      `Olá,\n\nSegue a nota fiscal ${invoice.invoiceNumber || invoice.id} no valor de ${formatCurrency(invoice.amount)}.\n\nCliente: ${invoice.client}\nVencimento: ${invoice.dueDate}\nNatureza da operação: ${invoice.natureOfOperation || 'Serviços prestados'}\n\nAtenciosamente,\n${invoice.companyName || 'NEXO Sistemas'}`,
    )

    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <section className="module-page">
      <div className="topbar">
        <div>
          <p className="eyebrow-light">Notas fiscais</p>
          <h1 className="module-title">Emissão e acompanhamento de NFs</h1>
        </div>
      </div>

      {isLoading && (
        <div className="global-status info">
          <span className="global-status-dot" aria-hidden="true" />
          Sincronizando clientes e notas fiscais com o backend...
        </div>
      )}

      <div className="kpi-grid">
        <article className="kpi-card">
          <p>Emitidas</p>
          <div className="kpi-main"><strong>{total}</strong><span className="trend up">este mês</span></div>
        </article>
        <article className="kpi-card">
          <p>Vencimento hoje</p>
          <div className="kpi-main"><strong>{dueTodayCount}</strong><span className="trend flat">documentos</span></div>
        </article>
        <article className="kpi-card">
          <p>Valor em aberto</p>
          <div className="kpi-main"><strong>{formatCurrency(openInvoicesValue)}</strong><span className="trend flat">acumulado</span></div>
        </article>
      </div>

      <div className="panel-grid split">
        <article className="panel-card">
          <p className="panel-kicker">Nova emissão</p>
          <h3>Gerar nota fiscal</h3>
          <div className="inventory-form">
            <div className="customer-mode-toggle">
              <button
                type="button"
                className={customerMode === 'existing' ? 'customer-mode-button selected existing' : 'customer-mode-button existing'}
                onClick={() => setCustomerMode('existing')}
              >
                Cliente cadastrado
              </button>
              <button
                type="button"
                className={customerMode === 'new' ? 'customer-mode-button selected new' : 'customer-mode-button new'}
                onClick={() => setCustomerMode('new')}
              >
                Cadastrar cliente
              </button>
            </div>

            {customerMode === 'existing' ? (
              <label className="auth-field">
                <span>Cliente</span>
                <select value={selectedCustomer} onChange={(event) => handleCustomerSelection(event.target.value)}>
                  <option value="">Selecione um cliente cadastrado</option>
                  {customers.map((customer) => (
                    <option key={`${customer.name}-${customer.contact}`} value={customer.name}>
                      {customer.name} • {customer.segment}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="customer-registration-panel is-collapsed" aria-hidden="true">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: '12px' }}>
                  <label className="auth-field">
                    <span>Nome do cliente</span>
                    <input
                      value={customerForm.name}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Ex: João Santos"
                    />
                  </label>
                  <label className="auth-field">
                    <span>CPF / CNPJ</span>
                    <input
                      value={customerForm.document}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, document: event.target.value }))}
                      placeholder="00.000.000/0000-00"
                    />
                  </label>
                  <label className="auth-field">
                    <span>E-mail</span>
                    <input
                      value={customerForm.email}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="cliente@email.com"
                    />
                  </label>
                  <label className="auth-field">
                    <span>Telefone</span>
                    <input
                      value={customerForm.phone}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="(11) 99999-0000"
                    />
                  </label>
                  <label className="auth-field">
                    <span>Segmento</span>
                    <select
                      value={customerForm.segment}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, segment: event.target.value }))}
                    >
                      <option value="Comercial">Comercial</option>
                      <option value="Industrial">Industrial</option>
                      <option value="Serviços">Serviços</option>
                      <option value="Logística">Logística</option>
                      <option value="Tecnologia">Tecnologia</option>
                    </select>
                  </label>
                  <label className="auth-field">
                    <span>Status</span>
                    <select
                      value={customerForm.status}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, status: event.target.value }))}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Pendente">Pendente</option>
                      <option value="Negociação">Negociação</option>
                    </select>
                  </label>
                  <label className="auth-field" style={{ gridColumn: '1 / -1' }}>
                    <span>Endereço</span>
                    <input
                      value={customerForm.address}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))}
                      placeholder="Rua, número, bairro"
                    />
                  </label>
                  <label className="auth-field">
                    <span>Cidade</span>
                    <input
                      value={customerForm.city}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, city: event.target.value }))}
                      placeholder="São Paulo"
                    />
                  </label>
                  <label className="auth-field">
                    <span>Estado</span>
                    <select
                      value={customerForm.state}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, state: event.target.value }))}
                    >
                      <option value="SP">SP</option>
                      <option value="RJ">RJ</option>
                      <option value="MG">MG</option>
                      <option value="PR">PR</option>
                      <option value="SC">SC</option>
                      <option value="RS">RS</option>
                      <option value="GO">GO</option>
                      <option value="DF">DF</option>
                      <option value="PE">PE</option>
                      <option value="BA">BA</option>
                    </select>
                  </label>
                  <label className="auth-field">
                    <span>CEP</span>
                    <input
                      value={customerForm.zipCode}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, zipCode: event.target.value }))}
                      placeholder="00000-000"
                    />
                  </label>
                  <label className="auth-field">
                    <span>Contato principal</span>
                    <input
                      value={customerForm.contact}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, contact: event.target.value }))}
                      placeholder="Nome do responsável"
                    />
                  </label>
                  <label className="auth-field" style={{ gridColumn: '1 / -1' }}>
                    <span>Observações</span>
                    <input
                      value={customerForm.notes}
                      onChange={(event) => setCustomerForm((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Detalhes, preferências, pendências..."
                    />
                  </label>
                </div>
                <button type="button" className="primary-button" onClick={handleSaveCustomer}>
                  Salvar cliente
                </button>
              </div>
            )}

            <label className="auth-field">
              <span>CPF/CNPJ do cliente</span>
              <input
                value={form.clientDocument}
                onChange={(event) => onChange('clientDocument', event.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </label>
            <label className="auth-field">
              <span>Endereço do cliente</span>
              <input
                value={form.clientAddress}
                onChange={(event) => onChange('clientAddress', event.target.value)}
                placeholder="Rua, número, bairro, cidade/UF"
              />
            </label>
            <label className="auth-field">
              <span>Nome da marca / emitente</span>
              <input
                value={form.companyName}
                onChange={(event) => onChange('companyName', event.target.value)}
                placeholder="NEXO Sistemas"
              />
            </label>
            <label className="auth-field">
              <span>URL da logo</span>
              <input
                value={form.logoUrl}
                onChange={(event) => onChange('logoUrl', event.target.value)}
                placeholder="https://exemplo.com/logo.png"
              />
            </label>
            <label className="auth-field">
              <span>CNPJ emitente</span>
              <input
                value={form.companyDocument}
                onChange={(event) => onChange('companyDocument', event.target.value)}
                placeholder="12.345.678/0001-90"
              />
            </label>
            <label className="auth-field">
              <span>Endereço do emitente</span>
              <input
                value={form.companyAddress}
                onChange={(event) => onChange('companyAddress', event.target.value)}
                placeholder="Rua da Inovação, 123 - São Paulo/SP"
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <label className="auth-field">
                <span>Número da nota</span>
                <input
                  value={form.invoiceNumber}
                  onChange={(event) => onChange('invoiceNumber', event.target.value)}
                  placeholder="0001"
                />
              </label>
              <label className="auth-field">
                <span>Série</span>
                <input
                  value={form.series}
                  onChange={(event) => onChange('series', event.target.value)}
                  placeholder="1"
                />
              </label>
              <label className="auth-field">
                <span>Natureza da operação</span>
                <input
                  value={form.natureOfOperation}
                  onChange={(event) => onChange('natureOfOperation', event.target.value)}
                  placeholder="Serviços prestados"
                />
              </label>
            </div>
            <label className="auth-field">
              <span>Descrição da operação</span>
              <input
                value={form.description}
                onChange={(event) => onChange('description', event.target.value)}
                placeholder="Ex: Consultoria e suporte mensal"
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label className="auth-field">
                <span>Quantidade</span>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(event) => {
                    const nextQuantity = event.target.value
                    onChange('quantity', nextQuantity)
                    if (nextQuantity && Number(nextQuantity) > 0) {
                      const nextUnitValue = parseCurrency(form.unitPrice || form.amount)
                      onChange('amount', String(nextQuantity * nextUnitValue))
                    }
                  }}
                />
              </label>
              <label className="auth-field">
                <span>Valor unitário</span>
                <input
                  value={form.unitPrice}
                  onChange={(event) => {
                    const nextUnitValue = event.target.value
                    onChange('unitPrice', nextUnitValue)
                    onChange('amount', String(Number.parseFloat(nextUnitValue || '0') * Number(form.quantity || 1)))
                  }}
                />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
             <label className="auth-field">
               <span>ICMS</span>
               <input value={form.icms} onChange={(event) => onChange('icms', event.target.value)} />
             </label>
             <label className="auth-field">
               <span>ISS</span>
               <input value={form.iss} onChange={(event) => onChange('iss', event.target.value)} />
             </label>
             <label className="auth-field">
               <span>IPI</span>
               <input value={form.ipi} onChange={(event) => onChange('ipi', event.target.value)} />
             </label>
            </div>
            <label className="auth-field">
              <span>Valor total</span>
              <input value={form.amount} onChange={(event) => onChange('amount', event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Tipo</span>
              <select value={form.type} onChange={(event) => onChange('type', event.target.value)}>
                <option>Serviço</option>
                <option>Produto</option>
                <option>Recorrência</option>
              </select>
            </label>
            <label className="auth-field">
              <span>Vencimento</span>
              <input type="date" value={form.dueDate} onChange={(event) => onChange('dueDate', event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Observações</span>
              <input
                value={form.notes}
                onChange={(event) => onChange('notes', event.target.value)}
                placeholder="Observações da nota fiscal"
              />
            </label>
            <button
              type="button"
              className="primary-button"
              onClick={handleEmitInvoice}
              disabled={!form.client || !form.amount || parseCurrency(form.amount) <= 0 || !form.dueDate}
            >
              {editingInvoiceId ? 'Salvar alterações' : 'Emitir NF'}
            </button>
            {editingInvoiceId ? (
              <button
                type="button"
                className="ghost-button light"
                onClick={() => {
                  setEditingInvoiceId(null)
                  setForm({ ...invoiceDefaults, dueDate: form.dueDate })
                  setSelectedCustomer('')
                }}
              >
                Cancelar edição
              </button>
            ) : null}
          </div>
        </article>

        <article className="panel-card">
          <p className="panel-kicker">Pré-visualização</p>
          <h3>Nota em edição</h3>
          <div
            className="invoice-preview"
            style={{
              background: 'linear-gradient(180deg, #f5f8ff 0%, #edf4ff 100%)',
              border: '1px solid #dfe7f7',
              borderRadius: '16px',
              padding: '18px',
              marginBottom: '16px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
            }}
          >
            {previewInvoice.logoUrl ? (
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'flex-start' }}>
                <img src={previewInvoice.logoUrl} alt="Logo da empresa" style={{ maxHeight: 42, maxWidth: 140, objectFit: 'contain', borderRadius: 8 }} />
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#60759e' }}>
                  {previewInvoice.brandName || previewInvoice.companyName || 'NEXO Sistemas'}
                </div>
                <strong style={{ fontSize: '15px' }}>{previewInvoice.invoiceNumber || previewInvoice.id}</strong>
              </div>
              <span className="state-pill blue">{previewInvoice.status}</span>
            </div>

            <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', border: '1px solid #dde7f5' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', color: '#3a4968' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60759e' }}>Emitente</div>
                  <div><strong>{previewInvoice.companyName}</strong></div>
                  <div>{previewInvoice.companyDocument}</div>
                  <div>{previewInvoice.companyAddress}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60759e' }}>Destinatário</div>
                  <div><strong>{previewInvoice.client || 'Cliente ainda não informado'}</strong></div>
                  <div>{previewInvoice.clientDocument || 'CPF/CNPJ não informado'}</div>
                  <div>{previewInvoice.clientAddress || 'Endereço não informado'}</div>
                </div>
              </div>
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#3a4968' }}>
                <strong>Natureza:</strong> {previewInvoice.natureOfOperation || 'Serviços prestados'}
              </div>
            </div>

            <div style={{ marginTop: '14px', borderRadius: '12px', background: '#fff', border: '1px solid #dde7f5', padding: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60759e', marginBottom: '6px' }}>
                Descrição
              </div>
              <div style={{ fontSize: '13px', color: '#3a4968' }}>{previewInvoice.description}</div>
            </div>

            <div style={{ marginTop: '14px', background: '#fff', borderRadius: '12px', border: '1px solid #dde7f5', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.7fr 1fr 1fr', gap: '8px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60759e', background: '#eef4ff', padding: '10px 12px' }}>
                <span>Item</span>
                <span>Qtd</span>
                <span>Unit.</span>
                <span>Total</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.7fr 1fr 1fr', gap: '8px', padding: '12px', fontSize: '12px', color: '#33415d' }}>
                <span>{previewInvoice.type || 'Serviço'}</span>
                <span>{previewInvoice.quantity || 1}</span>
                <span>{formatCurrency(previewInvoice.unitPrice || previewInvoice.amount)}</span>
                <span>{formatCurrency(previewInvoice.amount)}</span>
              </div>
            </div>

            <div style={{ marginTop: '14px', borderTop: '1px solid #dfe7f7', paddingTop: '12px', fontSize: '12px', color: '#3a4968' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><strong>{formatCurrency(Math.max(0, previewInvoice.amount - (previewInvoice.icms + previewInvoice.iss + previewInvoice.ipi)))}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ICMS</span><strong>{formatCurrency(previewInvoice.icms)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ISS</span><strong>{formatCurrency(previewInvoice.iss)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>IPI</span><strong>{formatCurrency(previewInvoice.ipi)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '18px', color: '#1a2334' }}><span>Total</span><strong>{formatCurrency(previewInvoice.amount)}</strong></div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button type="button" className="primary-button" onClick={() => handlePrintInvoice(previewInvoice)}>
              Visualizar/Imprimir NF
            </button>
            <button type="button" className="ghost-button light" onClick={() => handleDownloadInvoicePdf(previewInvoice)}>
              Baixar PDF
            </button>
            <button type="button" className="ghost-button light" onClick={() => handleSendInvoiceEmail(previewInvoice)}>
              Enviar por e-mail
            </button>
          </div>
        </article>

        <article className="panel-card">
          <p className="panel-kicker">Últimas notas</p>
          <h3>Histórico</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {['all', 'Emitida', 'Paga', 'Cancelada'].map((status) => (
              <button
                key={status}
                type="button"
                className={statusFilter === status ? 'primary-button' : 'ghost-button light'}
                onClick={() => setStatusFilter(status)}
                style={{ padding: '6px 10px', fontSize: '12px' }}
              >
                {status === 'all' ? 'Todos' : status}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <label className="auth-field">
              <span>Cliente</span>
              <select value={selectedClientFilter} onChange={(event) => setSelectedClientFilter(event.target.value)}>
                <option value="all">Todos</option>
                {customers.map((customer) => (
                  <option key={customer.name} value={customer.name}>{customer.name}</option>
                ))}
              </select>
            </label>
            <label className="auth-field">
              <span>Data inicial</span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Data final</span>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
          </div>
          <div className="list-stack">
            {filteredInvoices.map((item) => (
              <div key={item.id} className="invoice-history-item">
                <div className="invoice-history-meta">
                  <strong>{item.invoiceNumber || item.id}</strong>
                  <span>{item.client}</span>
                </div>

                <div className="invoice-history-side">
                  <strong className="invoice-history-total">{formatCurrency(item.amount)}</strong>

                  <div className="invoice-history-actions">
                    <button type="button" className="ghost-button light history-action-button" onClick={() => handlePrintInvoice(item)}>
                      Imprimir
                    </button>
                    <button type="button" className="ghost-button light history-action-button" onClick={() => handleEditInvoice(item)}>
                      Editar
                    </button>
                    <button type="button" className="ghost-button light history-action-button" onClick={() => updateInvoiceStatus(item.id, 'Paga')}>
                      Paga
                    </button>
                    <button type="button" className="ghost-button light history-action-button" onClick={() => updateInvoiceStatus(item.id, 'Cancelada')}>
                      Cancelar
                    </button>
                  </div>

                  <span className={`state-pill ${item.status === 'Paga' ? 'green' : item.status === 'Cancelada' ? 'red' : item.status === 'Emitida' ? 'blue' : 'amber'}`}>
                    {item.status || 'Emitida'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}
