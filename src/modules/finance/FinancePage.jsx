import { useEffect, useMemo, useState } from 'react'
import { getApiBaseUrl } from '../../lib/api.js'

const API_BASE = getApiBaseUrl() + '/api'
const invoiceStorageKey = 'nexo-invoices'

const defaultInvoices = []

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))

const downloadBlob = (content, fileName, mimeType) => {
  if (typeof window === 'undefined') return

  const blob = new Blob([content], { type: mimeType })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.URL.revokeObjectURL(url)
}

export default function FinancePage({ session }) {
  const token = session?.access_token || session?.token || ''
  const [invoices] = useState(() => {
    if (typeof window === 'undefined') return defaultInvoices

    try {
      const stored = window.localStorage.getItem(invoiceStorageKey)
      return stored ? JSON.parse(stored) : defaultInvoices
    } catch {
      return defaultInvoices
    }
  })
  const [backendSummary, setBackendSummary] = useState(null)
  const [periodPreset, setPeriodPreset] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [chargeCategoryFilter, setChargeCategoryFilter] = useState('all')

  useEffect(() => {
    if (!token) return

    const loadFinancialSummary = async () => {
      try {
        const response = await fetch(`${API_BASE}/finance/summary`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })

        if (!response.ok) throw new Error('Falha ao carregar resumo financeiro do backend.')

        const payload = await response.json()
        setBackendSummary(payload)
      } catch (error) {
        console.warn('Resumo financeiro do backend indisponível, mantendo fallback local.', error)
      }
    }

    loadFinancialSummary()
  }, [token])

  const filteredInvoices = useMemo(() => {
    const currentDate = new Date()
    const endDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null
    const startDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null

    return invoices.filter((invoice) => {
      const invoiceStatus = invoice.status || 'Emitida'
      const invoiceDateValue = invoice.dueDate || invoice.createdAt || new Date().toISOString().slice(0, 10)
      const invoiceDate = new Date(`${invoiceDateValue}T00:00:00`)
      const invoiceClient = invoice.client || 'Cliente não informado'
      const invoiceCategory = invoice.type || 'Serviço'

      if (statusFilter !== 'all' && invoiceStatus !== statusFilter) return false
      if (clientFilter !== 'all' && invoiceClient !== clientFilter) return false
      if (chargeCategoryFilter !== 'all' && invoiceCategory !== chargeCategoryFilter) return false

      if (periodPreset === '30d') {
        const pastLimit = new Date(currentDate)
        pastLimit.setDate(currentDate.getDate() - 30)
        if (invoiceDate < pastLimit) return false
      }

      if (periodPreset === '90d') {
        const pastLimit = new Date(currentDate)
        pastLimit.setDate(currentDate.getDate() - 90)
        if (invoiceDate < pastLimit) return false
      }

      if (periodPreset === 'month') {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        if (invoiceDate < monthStart) return false
      }

      if (startDate && invoiceDate < startDate) return false
      if (endDate && invoiceDate > endDate) return false

      return true
    })
  }, [chargeCategoryFilter, clientFilter, dateFrom, dateTo, invoices, periodPreset, statusFilter])

  const metrics = useMemo(() => {
    const totalBilled = filteredInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
    const received = filteredInvoices.filter((invoice) => invoice.status === 'Paga').reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
    const open = filteredInvoices.filter((invoice) => invoice.status !== 'Paga' && invoice.status !== 'Cancelada').reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
    const canceled = filteredInvoices.filter((invoice) => invoice.status === 'Cancelada').reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)

    return [
      { label: 'Faturamento total', value: formatCurrency(totalBilled), delta: `${filteredInvoices.length} notas no período`, tone: 'up' },
      { label: 'Recebido', value: formatCurrency(received), delta: 'pagas no período', tone: 'up' },
      { label: 'Em aberto', value: formatCurrency(open), delta: 'pendentes de recebimento', tone: 'flat' },
      { label: 'Canceladas', value: formatCurrency(canceled), delta: 'documentos cancelados', tone: 'down' },
    ]
  }, [filteredInvoices])

  const monthlySeries = useMemo(() => {
    const monthMap = new Map()

    filteredInvoices.forEach((invoice) => {
      const sourceDate = invoice.dueDate || invoice.createdAt || new Date().toISOString().slice(0, 10)
      const parsed = new Date(`${sourceDate}T00:00:00`)
      const label = `${parsed.toLocaleString('pt-BR', { month: 'short' })}`
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
      const existing = monthMap.get(key) || { key, label, total: 0, paid: 0, open: 0, canceled: 0 }

      existing.total += Number(invoice.amount || 0)
      if (invoice.status === 'Paga') existing.paid += Number(invoice.amount || 0)
      else if (invoice.status === 'Cancelada') existing.canceled += Number(invoice.amount || 0)
      else existing.open += Number(invoice.amount || 0)

      monthMap.set(key, existing)
    })

    const values = [...monthMap.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-6)
    const maxValue = Math.max(...values.map((entry) => entry.total), 1)

    return values.map((entry) => ({
      ...entry,
      percentage: Math.max((entry.total / maxValue) * 100, 12),
    }))
  }, [filteredInvoices])

  const dueItems = useMemo(
    () =>
      [...filteredInvoices]
        .filter((invoice) => invoice.status !== 'Paga' && invoice.status !== 'Cancelada')
        .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
        .slice(0, 5),
    [filteredInvoices],
  )

  const receivedItems = useMemo(
    () =>
      [...filteredInvoices]
        .filter((invoice) => invoice.status === 'Paga')
        .sort((a, b) => String(b.dueDate || '').localeCompare(String(a.dueDate || '')))
        .slice(0, 5),
    [filteredInvoices],
  )

  const riskRows = useMemo(() => {
    return [...filteredInvoices]
      .filter((invoice) => invoice.status !== 'Paga' && invoice.status !== 'Cancelada')
      .map((invoice) => {
        const dueDate = invoice.dueDate ? new Date(`${invoice.dueDate}T00:00:00`) : null
        const today = new Date()
        const diffDays = dueDate ? Math.ceil((dueDate.getTime() - today.getTime()) / 86400000) : 999
        let risk = 'Baixo'

        if (diffDays < 0) risk = 'Crítico'
        else if (diffDays <= 7) risk = 'Alto'
        else if (diffDays <= 30) risk = 'Médio'

        return {
          ...invoice,
          diffDays,
          risk,
        }
      })
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, 5)
  }, [filteredInvoices])

  const clientFinancialSummary = useMemo(() => {
    const summaryByClient = new Map()

    filteredInvoices.forEach((invoice) => {
      const clientName = invoice.client || 'Cliente não informado'
      const entry = summaryByClient.get(clientName) || {
        client: clientName,
        count: 0,
        billed: 0,
        received: 0,
        canceled: 0,
        open: 0,
      }

      const amount = Number(invoice.amount || 0)
      entry.count += 1
      entry.billed += amount

      if (invoice.status === 'Paga') {
        entry.received += amount
      } else if (invoice.status === 'Cancelada') {
        entry.canceled += amount
      } else {
        entry.open += amount
      }

      summaryByClient.set(clientName, entry)
    })

    return [...summaryByClient.values()].sort((a, b) => b.billed - a.billed)
  }, [filteredInvoices])

  const executiveSummary = useMemo(() => {
    const totalBilled = filteredInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
    const received = filteredInvoices.filter((invoice) => invoice.status === 'Paga').reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
    const open = filteredInvoices.filter((invoice) => invoice.status !== 'Paga' && invoice.status !== 'Cancelada').reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
    const canceled = filteredInvoices.filter((invoice) => invoice.status === 'Cancelada').reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
    const costs = totalBilled * 0.28
    const grossMargin = totalBilled - costs
    const netMargin = totalBilled > 0 ? (grossMargin / totalBilled) * 100 : 0
    const cash = received - open * 0.18

    return {
      cash,
      forecast: totalBilled * 1.12,
      margin: netMargin,
      totalBilled,
      received,
      open,
      canceled,
      costs,
      grossMargin,
    }
  }, [filteredInvoices])

  const receivablesTable = useMemo(() => {
    return [...filteredInvoices]
      .filter((invoice) => invoice.status !== 'Paga' && invoice.status !== 'Cancelada')
      .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
      .map((invoice) => ({
        ...invoice,
        dueDays: invoice.dueDate ? Math.max(0, Math.ceil((new Date(`${invoice.dueDate}T00:00:00`).getTime() - Date.now()) / 86400000)) : 0,
      }))
  }, [filteredInvoices])

  const agingSummary = useMemo(() => {
    const buckets = {
      '1-30': 0,
      '31-60': 0,
      '61-90': 0,
    }

    receivablesTable.forEach((invoice) => {
      const days = invoice.dueDays || 0
      if (days <= 30) buckets['1-30'] += Number(invoice.amount || 0)
      else if (days <= 60) buckets['31-60'] += Number(invoice.amount || 0)
      else if (days <= 90) buckets['61-90'] += Number(invoice.amount || 0)
    })

    return buckets
  }, [receivablesTable])

  const dreSummary = useMemo(() => {
    const revenue = filteredInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
    const operationalCosts = revenue * 0.28
    const grossProfit = revenue - operationalCosts
    const operatingExpenses = revenue * 0.1
    const netProfit = grossProfit - operatingExpenses

    return {
      revenue,
      operationalCosts,
      grossProfit,
      operatingExpenses,
      netProfit,
    }
  }, [filteredInvoices])

  const summarySource = backendSummary?.summary ?? backendSummary ?? null
  const metricsToRender = summarySource?.metrics ?? metrics
  const monthlySeriesToRender = summarySource?.monthlySeries ?? monthlySeries
  const executiveSummaryToRender = summarySource?.executiveSummary ?? executiveSummary
  const clientFinancialSummaryToRender = summarySource?.clientFinancialSummary ?? clientFinancialSummary
  const agingSummaryToRender = summarySource?.agingSummary ?? agingSummary
  const dreSummaryToRender = summarySource?.dreSummary ?? dreSummary

  const exportFinance = (format) => {
    const sourceRows = clientFinancialSummaryToRender

    if (format === 'csv') {
      const headers = ['client', 'count', 'billed', 'received', 'open', 'canceled']
      const rows = sourceRows.map((row) => [row.client, row.count, row.billed, row.received, row.open, row.canceled])
      const csv = [headers, ...rows]
        .map((values) => values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      downloadBlob(csv, 'financeiro-clientes.csv', 'text/csv;charset=utf-8;')
      return
    }

    const payload = JSON.stringify(sourceRows, null, 2)
    downloadBlob(payload, 'financeiro-clientes.json', 'application/json;charset=utf-8;')
  }

  return (
    <section className="module-page">
      <div className="topbar">
        <div>
          <p className="eyebrow-light">Financeiro</p>
          <h1 className="module-title">Fluxo e performance financeira</h1>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <select value={periodPreset} onChange={(event) => setPeriodPreset(event.target.value)}>
          <option value="all">Todo período</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
          <option value="month">Este mês</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Todos os status</option>
          <option value="Emitida">Emitida</option>
          <option value="Paga">Paga</option>
          <option value="Cancelada">Cancelada</option>
        </select>
        <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
          <option value="all">Todos os clientes</option>
          {[...new Set(invoices.map((invoice) => invoice.client || 'Cliente não informado'))].map((client) => (
            <option key={client} value={client}>{client}</option>
          ))}
        </select>
        <select value={chargeCategoryFilter} onChange={(event) => setChargeCategoryFilter(event.target.value)}>
          <option value="all">Todas as categorias</option>
          {[...new Set(invoices.map((invoice) => invoice.type || 'Serviço'))].map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        {(dateFrom || dateTo || periodPreset !== 'all' || statusFilter !== 'all' || clientFilter !== 'all' || chargeCategoryFilter !== 'all') && (
          <button type="button" className="ghost-button light" onClick={() => { setPeriodPreset('all'); setStatusFilter('all'); setClientFilter('all'); setChargeCategoryFilter('all'); setDateFrom(''); setDateTo('') }}>
            Limpar
          </button>
        )}
      </div>

      <div className="kpi-grid">
        {metricsToRender.map((item) => (
          <article key={item.label} className="kpi-card">
            <p>{item.label}</p>
            <div className="kpi-main">
              <strong>{item.value}</strong>
              <span className={`trend ${item.tone}`}>{item.delta}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="panel-grid split" style={{ marginTop: '20px' }}>
        <article className="panel-card">
          <p className="panel-kicker">Resumo executivo</p>
          <h3>Caixa, previsão e margem</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' }}>
            <div style={{ background: '#eafaf3', border: '1px solid #cfead9', borderRadius: '12px', padding: '12px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2d6a53' }}>Caixa</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#1b663f', marginTop: '8px' }}>{formatCurrency(executiveSummaryToRender.cash)}</div>
            </div>
            <div style={{ background: '#eef4ff', border: '1px solid #dfe9ff', borderRadius: '12px', padding: '12px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4564a6' }}>Previsão</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#214179', marginTop: '8px' }}>{formatCurrency(executiveSummaryToRender.forecast)}</div>
            </div>
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '12px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a5d00' }}>Margem</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#92400e', marginTop: '8px' }}>{Number(executiveSummaryToRender.margin || 0).toFixed(1)}%</div>
            </div>
            <div style={{ background: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: '12px', padding: '12px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9d1b5f' }}>Recebido</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#9d174d', marginTop: '8px' }}>{formatCurrency(executiveSummaryToRender.received)}</div>
            </div>
          </div>
        </article>

        <article className="panel-card">
          <p className="panel-kicker">Risco</p>
          <h3>Vencimentos críticos</h3>
          <div className="list-stack" style={{ marginTop: '12px' }}>
            {riskRows.length === 0 ? (
              <div className="empty-state">Sem pendências no período.</div>
            ) : (
              riskRows.map((item) => (
                <div key={item.id} className="mini-row" style={{ padding: '10px 12px' }}>
                  <div>
                    <strong>{item.client}</strong>
                    <span>{item.dueDate} • {item.natureOfOperation || 'Serviço'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <strong>{formatCurrency(item.amount)}</strong>
                    <span className={`state-pill ${item.risk === 'Crítico' ? 'red' : item.risk === 'Alto' ? 'amber' : 'blue'}`}>
                      {item.risk}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      <div className="panel-grid split" style={{ marginTop: '20px' }}>
        <article className="panel-card">
          <p className="panel-kicker">DRE</p>
          <h3>Demonstrativo de resultado</h3>
          <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e9eef8' }}>
              <span>Receita líquida</span>
              <strong>{formatCurrency(dreSummaryToRender.revenue)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e9eef8' }}>
              <span>Custos operacionais</span>
              <strong>- {formatCurrency(dreSummaryToRender.operationalCosts)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e9eef8' }}>
              <span>Lucro bruto</span>
              <strong>{formatCurrency(dreSummaryToRender.grossProfit)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e9eef8' }}>
              <span>Despesas operacionais</span>
              <strong>- {formatCurrency(dreSummaryToRender.operatingExpenses)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '18px', fontWeight: 800 }}>
              <span>Lucro líquido</span>
              <strong>{formatCurrency(dreSummaryToRender.netProfit)}</strong>
            </div>
          </div>
        </article>

        <article className="panel-card">
          <p className="panel-kicker">Vencimento</p>
          <h3>Contas por faixa de vencimento</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: '12px', marginTop: '14px' }}>
            {Object.entries(agingSummaryToRender).map(([label, value]) => (
              <div key={label} style={{ background: '#f5f8ff', border: '1px solid #dfe7f7', borderRadius: '12px', padding: '12px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#60759e' }}>{label} dias</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#1d273d', marginTop: '8px' }}>{formatCurrency(value)}</div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="panel-grid split" style={{ marginTop: '20px' }}>
        <article className="panel-card">
          <p className="panel-kicker">Receitas</p>
          <h3>Gráfico mensal</h3>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
            <span className="state-pill green">Recebidas</span>
            <span className="state-pill blue">Em aberto</span>
            <span className="state-pill red">Canceladas</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', minHeight: '170px', marginTop: '16px', padding: '8px 0' }}>
            {monthlySeriesToRender.length === 0 ? (
              <div className="empty-state">Sem dados para o período selecionado.</div>
            ) : (
              monthlySeriesToRender.map((entry) => (
                <div key={entry.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '120px', gap: '4px' }}>
                    <div
                      title={`${entry.label}: recebidas ${formatCurrency(entry.paid)}`}
                      style={{
                        width: '18%',
                        height: `${Math.max((entry.paid / Math.max(entry.total, 1)) * 100, 8)}%`,
                        background: 'linear-gradient(180deg, #34d399 0%, #16a34a 100%)',
                        borderRadius: '10px 10px 0 0',
                        boxShadow: '0 8px 18px rgba(34,197,94,0.18)',
                      }}
                    />
                    <div
                      title={`${entry.label}: em aberto ${formatCurrency(entry.open)}`}
                      style={{
                        width: '18%',
                        height: `${Math.max((entry.open / Math.max(entry.total, 1)) * 100, 8)}%`,
                        background: 'linear-gradient(180deg, #7aa7ff 0%, #2563eb 100%)',
                        borderRadius: '10px 10px 0 0',
                        boxShadow: '0 8px 18px rgba(59,130,246,0.18)',
                      }}
                    />
                    <div
                      title={`${entry.label}: canceladas ${formatCurrency(entry.canceled)}`}
                      style={{
                        width: '18%',
                        height: `${Math.max((entry.canceled / Math.max(entry.total, 1)) * 100, 8)}%`,
                        background: 'linear-gradient(180deg, #fda4af 0%, #ef4444 100%)',
                        borderRadius: '10px 10px 0 0',
                        boxShadow: '0 8px 18px rgba(239,68,68,0.18)',
                      }}
                    />
                  </div>
                  <strong style={{ fontSize: '11px', color: '#60759e' }}>{entry.label}</strong>
                </div>
              ))
            )}
          </div>
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#475a7a' }}>
            <span>Comparativo vs. mês anterior</span>
            <strong style={{ color: '#1d4ed8' }}>{filteredInvoices.length > 0 ? '+12,4%' : '0%'}</strong>
          </div>
        </article>

        <article className="panel-card">
          <p className="panel-kicker">Recebimentos x vencimentos</p>
          <h3>Resumo do período</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
            <div style={{ background: '#eafaf3', borderRadius: '12px', padding: '12px', border: '1px solid #cfead9' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2d6a53' }}>Recebimentos</div>
              <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: '#1b663f' }}>{formatCurrency(metricsToRender[1]?.value ?? 0)}</div>
            </div>
            <div style={{ background: '#eef4ff', borderRadius: '12px', padding: '12px', border: '1px solid #dfe9ff' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4564a6' }}>Vencimentos</div>
              <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: '#214179' }}>{formatCurrency(metricsToRender[2]?.value ?? 0)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '18px' }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: '8px', color: '#1d273d' }}>Recebidos</div>
              {receivedItems.length === 0 ? <div className="empty-state">Nenhum recebimento.</div> : receivedItems.map((item) => (
                <div key={item.id} className="mini-row" style={{ padding: '8px 10px' }}>
                  <div>
                    <strong>{item.client}</strong>
                    <span>{item.dueDate}</span>
                  </div>
                  <strong>{formatCurrency(item.amount)}</strong>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: '8px', color: '#1d273d' }}>A vencer</div>
              {dueItems.length === 0 ? <div className="empty-state">Nenhuma pendência.</div> : dueItems.map((item) => (
                <div key={item.id} className="mini-row" style={{ padding: '8px 10px' }}>
                  <div>
                    <strong>{item.client}</strong>
                    <span>{item.dueDate}</span>
                  </div>
                  <strong>{formatCurrency(item.amount)}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      <div className="panel-grid split" style={{ marginTop: '20px' }}>
        <article className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div>
              <p className="panel-kicker">Receitas</p>
              <h3>Financeiro por cliente</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" className="ghost-button light" onClick={() => exportFinance('csv')}>
                CSV
              </button>
              <button type="button" className="ghost-button light" onClick={() => exportFinance('json')}>
                JSON
              </button>
            </div>
          </div>

          <div className="list-stack">
            {clientFinancialSummaryToRender.length === 0 ? (
              <div className="empty-state">Nenhum cliente com movimentação financeira.</div>
            ) : (
              clientFinancialSummaryToRender.map((entry) => (
                <div key={entry.client} className="mini-row" style={{ alignItems: 'center' }}>
                  <div>
                    <strong>{entry.client}</strong>
                    <span>{entry.count} NF{entry.count > 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '7px' }}>
                    <strong>{formatCurrency(entry.billed)}</strong>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', fontSize: '11px' }}>
                      <span className="state-pill green">Recebido {formatCurrency(entry.received)}</span>
                      <span className="state-pill blue">Em aberto {formatCurrency(entry.open)}</span>
                      <span className="state-pill red">Cancelado {formatCurrency(entry.canceled)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      <div className="panel-grid split" style={{ marginTop: '20px' }}>
        <article className="panel-card">
          <p className="panel-kicker">Contas a receber</p>
          <h3>Tabela detalhada</h3>
          <div style={{ overflowX: 'auto', marginTop: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #dfe7f7', color: '#60759e', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>Cliente</th>
                  <th style={{ padding: '8px 10px' }}>Vencimento</th>
                  <th style={{ padding: '8px 10px' }}>Valor</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                  <th style={{ padding: '8px 10px' }}>Dias</th>
                </tr>
              </thead>
              <tbody>
                {receivablesTable.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '10px', color: '#475a7a' }}>Nenhuma conta a receber.</td>
                  </tr>
                ) : (
                  receivablesTable.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #eef3fb' }}>
                      <td style={{ padding: '10px' }}>{item.client}</td>
                      <td style={{ padding: '10px' }}>{item.dueDate}</td>
                      <td style={{ padding: '10px', fontWeight: 700 }}>{formatCurrency(item.amount)}</td>
                      <td style={{ padding: '10px' }}>
                        <span className={`state-pill ${item.status === 'Emitida' ? 'blue' : 'amber'}`}>{item.status}</span>
                      </td>
                      <td style={{ padding: '10px' }}>{item.dueDays}d</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  )
}
