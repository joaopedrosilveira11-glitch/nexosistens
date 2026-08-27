import { useEffect, useState } from 'react'
import './ProductionPage.css'

const customerStorageKey = 'nexo-customers'

const defaultStages = []

const defaultForm = {
  orderName: '',
  customer: '',
  priority: 'Média',
  quantity: '0',
  status: 'Planejamento',
}

const readCustomerOptions = () => {
  if (typeof window === 'undefined') return []

  try {
    const stored = window.localStorage.getItem(customerStorageKey)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    return parsed.map((customer) => customer?.name).filter(Boolean)
  } catch (error) {
    return []
  }
}

export default function ProductionPage({ onNavigateToCustomers }) {
  const [stages, setStages] = useState(defaultStages)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false)
  const [filters, setFilters] = useState({ search: '', status: 'Todos' })
  const [form, setForm] = useState(defaultForm)
  const [customerOptions, setCustomerOptions] = useState([])
  const [customerMode, setCustomerMode] = useState('existing')
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))

  const stageOrder = ['Planejamento', 'Materiais', 'Produção', 'Qualidade']

  useEffect(() => {
    const syncCustomerOptions = () => setCustomerOptions(readCustomerOptions())
    syncCustomerOptions()

    if (typeof window === 'undefined') return undefined

    const handleStorage = (event) => {
      if (event.key === customerStorageKey || event.type === 'nexo-customers-updated') {
        syncCustomerOptions()
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('nexo-customers-updated', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('nexo-customers-updated', handleStorage)
    }
  }, [])

  const refreshProduction = () => {
    setLastUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    setStages((current) => current.map((stage) => ({ ...stage })))
  }

  const filteredStages = stages.filter((stage) => {
    const matchesStatus = filters.status === 'Todos' || stage.status === filters.status
    const searchTerm = filters.search.trim().toLowerCase()
    const matchesSearch = !searchTerm || stage.name.toLowerCase().includes(searchTerm) || stage.status.toLowerCase().includes(searchTerm)
    return matchesStatus && matchesSearch
  })

  const metricCards = [
    { label: 'Ordens', value: stages.length, delta: `${stages.length} ativas` },
    { label: 'Tempo total', value: '18h', delta: 'em cronograma' },
    { label: 'Eficiência', value: '92%', delta: 'na linha' },
    { label: 'Última etapa', value: stages[0]?.name || '—', delta: stages[0]?.status || 'aguardando cadastro' },
  ]

  const handleFieldChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleCustomerSelection = (value) => {
    if (value === 'new') {
      setCustomerMode('custom')
      setForm((current) => ({ ...current, customer: '' }))
      return
    }

    setCustomerMode('existing')
    setForm((current) => ({ ...current, customer: value }))
  }

  const addHistoryEntry = (stage, action, detail) => {
    const now = new Date()
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    setStages((current) => current.map((item) => {
      if (item.name !== stage.name) return item

      return {
        ...item,
        history: [
          { action, detail, time },
          ...(item.history || []),
        ],
      }
    }))
  }

  const handleCreateOrder = (event) => {
    event.preventDefault()

    if (!form.orderName.trim() || !form.customer.trim()) {
      return
    }

    const entryTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const nextStage = {
      name: form.orderName.trim().toUpperCase(),
      customer: form.customer.trim(),
      priority: form.priority,
      quantity: Number(form.quantity || 0),
      status: form.status,
      history: [
        { action: 'Pedido criado', detail: `Ordem aberta para ${form.customer.trim()} com prioridade ${form.priority.toLowerCase()}.`, time: entryTime },
      ],
    }

    setStages((current) => [
      nextStage,
      ...current,
    ])

    setForm(defaultForm)
    setCustomerMode('existing')
    setIsOrderFormOpen(false)
    setLastUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  }

  const handleAdvanceStage = (stage) => {
    const currentIndex = stageOrder.indexOf(stage.status)
    const nextStatus = stageOrder[currentIndex + 1]

    if (!nextStatus) {
      addHistoryEntry(stage, 'Ordem finalizada', `A ordem ${stage.name} foi concluída e enviada para liberação.`)
      return
    }

    setStages((current) => current.map((item) => {
      if (item.name !== stage.name) return item

      return {
        ...item,
        status: nextStatus,
        history: [
          { action: 'Etapa avançada', detail: `Status atualizado de ${item.status} para ${nextStatus}.`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
          ...(item.history || []),
        ],
      }
    }))

    setLastUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  }

  return (
    <section className="production-page">
      <div className="topbar">
        <div>
          <p className="eyebrow-light">Produção</p>
          <h1 className="module-title">Centro de produção</h1>
        </div>

        <div className="topbar-actions">
          <button type="button" className="ghost-button light" onClick={() => setIsFilterOpen((current) => !current)}>
            Filtrar
          </button>
          <button type="button" className="primary-button" onClick={() => setIsOrderFormOpen(true)}>
            Nova ordem
          </button>
        </div>
      </div>

      {isOrderFormOpen && (
        <div className="order-form-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Cadastro</p>
              <h2>Nova ordem</h2>
            </div>
            <button type="button" className="ghost-button small" onClick={() => setIsOrderFormOpen(false)}>
              Fechar
            </button>
          </div>

          <form className="order-form" onSubmit={handleCreateOrder}>
            <label className="auth-field">
              <span>Nome da ordem</span>
              <input type="text" value={form.orderName} onChange={(event) => handleFieldChange('orderName', event.target.value)} placeholder="Ex: OP-1048" />
            </label>

            <label className="auth-field">
              <span>Cliente</span>
              {customerOptions.length > 0 ? (
                <>
                  <select
                    value={customerMode === 'existing' ? (form.customer || '') : 'new'}
                    onChange={(event) => {
                      const selectedValue = event.target.value
                      if (selectedValue === 'new') {
                        handleCustomerSelection('new')
                        return
                      }
                      handleCustomerSelection(selectedValue)
                    }}
                  >
                    <option value="">Selecione um cliente</option>
                    {customerOptions.map((customerName) => (
                      <option key={customerName} value={customerName}>{customerName}</option>
                    ))}
                    <option value="new">Cadastrar novo cliente...</option>
                  </select>
                  {customerMode === 'custom' && (
                    <input
                      type="text"
                      value={form.customer}
                      onChange={(event) => handleFieldChange('customer', event.target.value)}
                      placeholder="Digite o novo cliente"
                      style={{ marginTop: 8 }}
                    />
                  )}
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() => {
                      setIsOrderFormOpen(false)
                      if (onNavigateToCustomers) onNavigateToCustomers()
                    }}
                    style={{ marginTop: 8, alignSelf: 'flex-start' }}
                  >
                    Abrir clientes para cadastrar
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    value={form.customer}
                    onChange={(event) => handleFieldChange('customer', event.target.value)}
                    placeholder="Ex: Cliente ABC"
                  />
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() => {
                      setIsOrderFormOpen(false)
                      if (onNavigateToCustomers) onNavigateToCustomers()
                    }}
                  >
                    Ir para clientes e cadastrar
                  </button>
                </div>
              )}
            </label>

            <label className="auth-field">
              <span>Prioridade</span>
              <select value={form.priority} onChange={(event) => handleFieldChange('priority', event.target.value)}>
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
              </select>
            </label>

            <label className="auth-field">
              <span>Quantidade</span>
              <input type="number" min="0" value={form.quantity} onChange={(event) => handleFieldChange('quantity', event.target.value)} placeholder="0" />
            </label>

            <label className="auth-field">
              <span>Etapa atual</span>
              <select value={form.status} onChange={(event) => handleFieldChange('status', event.target.value)}>
                <option value="Planejamento">Planejamento</option>
                <option value="Materiais">Materiais</option>
                <option value="Produção">Produção</option>
                <option value="Qualidade">Qualidade</option>
              </select>
            </label>

            <div className="order-form-actions">
              <button type="button" className="ghost-button" onClick={() => setIsOrderFormOpen(false)}>Cancelar</button>
              <button type="submit" className="primary-button">Salvar ordem</button>
            </div>
          </form>
        </div>
      )}

      {isFilterOpen && (
        <div className="filter-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Filtros</p>
              <h2>Buscar fluxo</h2>
            </div>
            <button type="button" className="ghost-button small" onClick={() => setIsFilterOpen(false)}>
              Fechar
            </button>
          </div>

          <div className="filter-fields">
            <label className="auth-field">
              <span>Busca</span>
              <input
                type="text"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Etapa ou status"
              />
            </label>

            <label className="auth-field">
              <span>Status</span>
              <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="Todos">Todos</option>
                <option value="Planejamento">Planejamento</option>
                <option value="Materiais">Materiais</option>
                <option value="Produção">Produção</option>
                <option value="Qualidade">Qualidade</option>
              </select>
            </label>
          </div>

          <div className="filter-actions">
            <button type="button" className="ghost-button" onClick={() => { setFilters({ search: '', status: 'Todos' }); setIsFilterOpen(false) }}>
              Limpar
            </button>
            <button type="button" className="primary-button" onClick={() => setIsFilterOpen(false)}>
              Aplicar
            </button>
          </div>
        </div>
      )}

      <div className="global-status info">
        <span className="global-status-dot" aria-hidden="true" />
        {filteredStages.length === 0 ? 'Nenhuma etapa encontrada com os filtros atuais.' : 'Fluxo de produção ativo e monitorado.'}
        <span className="last-updated">Atualizado às {lastUpdatedAt}</span>
      </div>

      <div className="kpi-grid">
        {metricCards.map((item) => (
          <article key={item.label} className="kpi-card">
            <p>{item.label}</p>
            <div className="kpi-main">
              <strong>{item.value}</strong>
              <span className="trend flat">{item.delta}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="production-layout">
        <div className="panel production-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Operação</p>
              <h2>Fluxo de produção</h2>
            </div>
            <button type="button" className="ghost-button small" onClick={refreshProduction}>Atualizar</button>
          </div>

          <div className="production-flow-list">
            {filteredStages.length > 0 ? filteredStages.map((stage, index) => (
              <div key={`${stage.name}-${index}`} className={`production-flow-item ${index === 0 ? 'active' : ''}`}>
                <div>
                  <strong>{stage.name}</strong>
                  <small>{stage.customer} · {stage.status}</small>
                  <div className="production-meta-row">
                    <span>Qtd: {stage.quantity}</span>
                    <span>Prioridade: {stage.priority}</span>
                  </div>
                </div>
                <div className="production-flow-actions">
                  <span>{stage.status === 'Qualidade' ? '100%' : `${Math.max((stageOrder.indexOf(stage.status) + 1) / stageOrder.length * 100, 25).toFixed(0)}%`}</span>
                  <button type="button" className="ghost-button small" onClick={() => handleAdvanceStage(stage)}>
                    {stage.status === 'Qualidade' ? 'Concluir' : 'Avançar etapa'}
                  </button>
                </div>
              </div>
            )) : (
              <div className="empty-state-box">
                <div className="empty-state-icon" aria-hidden="true">+</div>
                <div>
                  <h3>Nenhuma etapa encontrada</h3>
                  <p>Altere os filtros para visualizar outras etapas de produção.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="panel production-side-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Status</p>
              <h2>Resumo</h2>
            </div>
          </div>

          <div className="production-side-box">
            <h3>{filteredStages.length > 0 ? 'Produção em análise' : 'Sem produção ativa'}</h3>
            <p>{filteredStages.length > 0 ? 'Etapas disponíveis conforme os filtros aplicados.' : 'Não há ordens, materiais ou etapas cadastradas no momento.'}</p>
          </div>

          <div className="production-side-box muted-box">
            <h3>Histórico de operações</h3>
            <div className="history-list">
              {filteredStages.flatMap((stage) => (stage.history || []).slice(0, 3).map((entry, entryIndex) => (
                <div key={`${stage.name}-${entry.action}-${entryIndex}`} className="history-item">
                  <strong>{entry.action}</strong>
                  <p>{entry.detail}</p>
                  <small>{stage.name} · {entry.time}</small>
                </div>
              )))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
