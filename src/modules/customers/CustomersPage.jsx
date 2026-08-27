import { useEffect, useState } from 'react'
import './CustomersPage.css'

const API_BASE = 'http://localhost:4000/api'

const defaultForm = {
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

const storageKey = 'nexo-customers'

const initialRows = []

const buildCustomerKey = (customer) => `${customer?.name || ''}|${customer?.contact || ''}|${customer?.segment || ''}`.toLowerCase()

const normalizeCustomer = (customer = {}) => ({
  id: customer.id || undefined,
  name: customer.name || '',
  document: customer.document || customer.cpfCnpj || '',
  email: customer.email || '',
  phone: customer.phone || customer.contact || '',
  segment: customer.segment || 'Comercial',
  status: customer.status === 'inactive' ? 'Pendente' : customer.status === 'active' ? 'Ativo' : (customer.status || 'Ativo'),
  contact: customer.contact || customer.phone || customer.email || '',
  address: customer.address || '',
  city: customer.city || '',
  state: customer.state || 'SP',
  zipCode: customer.zipCode || '',
  notes: customer.notes || '',
})

const getAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

export default function CustomersPage({ session }) {
  const token = session?.access_token || session?.token || ''

  const [customers, setCustomers] = useState(() => {
    if (typeof window === 'undefined') return initialRows
    try {
      const stored = window.localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : initialRows
    } catch (error) {
      return initialRows
    }
  })
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingCustomerKey, setEditingCustomerKey] = useState('')
  const [form, setForm] = useState(defaultForm)
  const [filters, setFilters] = useState({ status: 'Todos', search: '' })
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))

  const persistCustomers = (nextCustomers) => {
    setCustomers(nextCustomers)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(nextCustomers))
      window.dispatchEvent(new CustomEvent('nexo-customers-updated'))
    }
  }

  const refreshCustomers = () => {
    setLastUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    setCustomers((current) => current.map((customer) => ({ ...customer })))
  }

  const filteredCustomers = customers.filter((customer) => {
    const matchesStatus = filters.status === 'Todos' || customer.status === filters.status
    const searchTerm = filters.search.trim().toLowerCase()
    const matchesSearch = !searchTerm || [
      customer.name,
      customer.segment,
      customer.contact,
      customer.email,
      customer.phone,
      customer.document,
      customer.city,
      customer.state,
    ].some((value) => (value || '').toLowerCase().includes(searchTerm))
    return matchesStatus && matchesSearch
  })

  const metricCards = [
    { label: 'Clientes', value: filteredCustomers.length, delta: `${filteredCustomers.filter((customer) => customer.status === 'Ativo').length} ativos` },
    { label: 'Pendentes', value: filteredCustomers.filter((customer) => customer.status === 'Pendente').length, delta: `${filteredCustomers.filter((customer) => customer.status === 'Pendente').length} em análise` },
    { label: 'Negociação', value: filteredCustomers.filter((customer) => customer.status === 'Negociação').length, delta: `${filteredCustomers.filter((customer) => customer.status === 'Negociação').length} em prospecção` },
    { label: 'Último cadastro', value: filteredCustomers.length ? filteredCustomers[filteredCustomers.length - 1].name : '—', delta: filteredCustomers.length ? 'registro recente' : 'sem registros' },
  ]

  const handleFieldChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(customers))
    }
  }, [customers])

  const loadCustomersFromBackend = async () => {
    if (!token) return

    try {
      const response = await fetch(`${API_BASE}/customers`, { headers: getAuthHeaders(token) })
      if (!response.ok) throw new Error('Não foi possível carregar clientes do backend.')
      const payload = await response.json()
      const nextCustomers = (payload.customers || []).map((customer) => normalizeCustomer(customer))
      persistCustomers(nextCustomers)
    } catch (error) {
      console.warn('Falha ao carregar clientes do backend, mantendo fallback local.', error)
    }
  }

  useEffect(() => {
    loadCustomersFromBackend()
  }, [token])

  const handleEditCustomer = (customer) => {
    setForm({
      name: customer.name || '',
      document: customer.document || '',
      email: customer.email || '',
      phone: customer.phone || customer.contact || '',
      segment: customer.segment || 'Comercial',
      status: customer.status || 'Ativo',
      contact: customer.contact || customer.email || customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || 'SP',
      zipCode: customer.zipCode || '',
      notes: customer.notes || '',
    })
    setEditingCustomerKey(customer.id || buildCustomerKey(customer))
    setIsEditing(true)
    setIsFormOpen(true)
  }

  const handleCreateCustomer = async (event) => {
    event.preventDefault()

    if (!form.name.trim() || (!form.contact.trim() && !form.email.trim() && !form.phone.trim())) {
      return
    }

    const nextCustomer = {
      name: form.name.trim(),
      document: form.document.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      segment: form.segment,
      status: form.status,
      contact: form.contact.trim() || form.email.trim() || form.phone.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state,
      zipCode: form.zipCode.trim(),
      notes: form.notes.trim(),
    }

    if (token) {
      try {
        const isUpdate = isEditing && editingCustomerKey
        const response = await fetch(`${API_BASE}/customers${isUpdate ? `/${editingCustomerKey}` : ''}`, {
          method: isUpdate ? 'PUT' : 'POST',
          headers: getAuthHeaders(token),
          body: JSON.stringify({
            ...nextCustomer,
            status: form.status === 'Ativo' ? 'active' : 'inactive',
          }),
        })

        if (!response.ok) throw new Error('Não foi possível salvar cliente no backend.')

        const payload = await response.json()
        const storedCustomer = normalizeCustomer(payload.customer || nextCustomer)
        const savedCustomers = isUpdate
          ? customers.map((customer) => (customer.id === editingCustomerKey || buildCustomerKey(customer) === editingCustomerKey ? storedCustomer : customer))
          : [...customers, storedCustomer]

        persistCustomers(savedCustomers)
        setLastUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        setForm(defaultForm)
        setEditingCustomerKey('')
        setIsEditing(false)
        setIsFormOpen(false)
        return
      } catch (error) {
        console.warn('Backend customer save failed, fallback to local storage.', error)
      }
    }

    if (isEditing && editingCustomerKey) {
      const updatedCustomers = customers.map((customer) => {
        const currentKey = customer.id || buildCustomerKey(customer)
        if (currentKey === editingCustomerKey) {
          return nextCustomer
        }
        return customer
      })
      persistCustomers(updatedCustomers)
    } else {
      persistCustomers([...customers, nextCustomer])
    }

    setLastUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    setForm(defaultForm)
    setEditingCustomerKey('')
    setIsEditing(false)
    setIsFormOpen(false)
  }

  const handleCloseForm = () => {
    setForm(defaultForm)
    setEditingCustomerKey('')
    setIsEditing(false)
    setIsFormOpen(false)
  }

  const handleRemoveCustomer = async (customer) => {
    const confirmed = window.confirm(`Deseja remover o cliente "${customer.name}" da base?`)
    if (!confirmed) return

    if (token && customer.id) {
      try {
        const response = await fetch(`${API_BASE}/customers/${customer.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(token),
        })

        if (!response.ok) throw new Error('Não foi possível remover o cliente no backend.')
      } catch (error) {
        console.warn('Backend customer delete failed, fallback to local storage.', error)
      }
    }

    const nextCustomers = customers.filter((item) => (customer.id ? (item.id || buildCustomerKey(item)) !== (customer.id || buildCustomerKey(customer)) : buildCustomerKey(item) !== buildCustomerKey(customer)))
    persistCustomers(nextCustomers)
    setLastUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  }

  return (
    <section className="customers-page">
      <div className="topbar">
        <div>
          <p className="eyebrow-light">Clientes</p>
          <h1 className="module-title">Cadastro de clientes</h1>
        </div>

        <div className="topbar-actions">
          <button type="button" className="ghost-button light" onClick={() => setIsFilterOpen((current) => !current)}>
            Filtrar
          </button>
          <button type="button" className="primary-button" onClick={() => setIsFormOpen(true)}>
            Novo cliente
          </button>
        </div>
      </div>

      {isFilterOpen && (
        <div className="filter-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Filtros</p>
              <h2>Buscar clientes</h2>
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
                placeholder="Nome, segmento ou contato"
              />
            </label>

            <label className="auth-field">
              <span>Status</span>
              <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="Todos">Todos</option>
                <option value="Ativo">Ativo</option>
                <option value="Pendente">Pendente</option>
                <option value="Negociação">Negociação</option>
              </select>
            </label>
          </div>

          <div className="filter-actions">
            <button type="button" className="ghost-button" onClick={() => { setFilters({ status: 'Todos', search: '' }); setIsFilterOpen(false) }}>
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
        {filteredCustomers.length === 0 ? 'Nenhum cliente encontrado com os filtros atuais.' : 'Base de clientes ativa e atualizada.'}
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

      {isFormOpen && (
        <div className="customer-form-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Cadastro</p>
              <h2>Novo cliente</h2>
            </div>
            <button type="button" className="ghost-button small" onClick={handleCloseForm}>
              Fechar
            </button>
          </div>

          <form className="customer-form" onSubmit={handleCreateCustomer}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: '12px' }}>
              <label className="auth-field">
                <span>{isEditing ? 'Editar cliente' : 'Nome do cliente'}</span>
                <input type="text" value={form.name} onChange={(event) => handleFieldChange('name', event.target.value)} placeholder="Ex: João da Silva" />
              </label>

              <label className="auth-field">
                <span>CPF / CNPJ</span>
                <input type="text" value={form.document} onChange={(event) => handleFieldChange('document', event.target.value)} placeholder="00.000.000/0000-00" />
              </label>

              <label className="auth-field">
                <span>Segmento</span>
                <select value={form.segment} onChange={(event) => handleFieldChange('segment', event.target.value)}>
                  <option value="Comercial">Comercial</option>
                  <option value="Industrial">Industrial</option>
                  <option value="Serviços">Serviços</option>
                  <option value="Logística">Logística</option>
                  <option value="Tecnologia">Tecnologia</option>
                </select>
              </label>

              <label className="auth-field">
                <span>Status</span>
                <select value={form.status} onChange={(event) => handleFieldChange('status', event.target.value)}>
                  <option value="Ativo">Ativo</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Negociação">Negociação</option>
                </select>
              </label>

              <label className="auth-field">
                <span>E-mail</span>
                <input type="email" value={form.email} onChange={(event) => handleFieldChange('email', event.target.value)} placeholder="cliente@email.com" />
              </label>

              <label className="auth-field">
                <span>Telefone</span>
                <input type="text" value={form.phone} onChange={(event) => handleFieldChange('phone', event.target.value)} placeholder="(11) 99999-0000" />
              </label>

              <label className="auth-field" style={{ gridColumn: '1 / -1' }}>
                <span>Endereço</span>
                <input type="text" value={form.address} onChange={(event) => handleFieldChange('address', event.target.value)} placeholder="Rua, número, bairro" />
              </label>

              <label className="auth-field">
                <span>Cidade</span>
                <input type="text" value={form.city} onChange={(event) => handleFieldChange('city', event.target.value)} placeholder="São Paulo" />
              </label>

              <label className="auth-field">
                <span>Estado</span>
                <select value={form.state} onChange={(event) => handleFieldChange('state', event.target.value)}>
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
                <input type="text" value={form.zipCode} onChange={(event) => handleFieldChange('zipCode', event.target.value)} placeholder="00000-000" />
              </label>

              <label className="auth-field">
                <span>Contato principal</span>
                <input type="text" value={form.contact} onChange={(event) => handleFieldChange('contact', event.target.value)} placeholder="Nome do responsável" />
              </label>

              <label className="auth-field" style={{ gridColumn: '1 / -1' }}>
                <span>Observações</span>
                <input type="text" value={form.notes} onChange={(event) => handleFieldChange('notes', event.target.value)} placeholder="Detalhes de cobrança, preferências, pendências..." />
              </label>
            </div>

            <div className="customer-form-actions">
              <button type="button" className="ghost-button" onClick={handleCloseForm}>Cancelar</button>
              <button type="submit" className="primary-button">{isEditing ? 'Salvar alterações' : 'Salvar cliente'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="panel customers-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Base</p>
            <h2>Clientes cadastrados</h2>
          </div>
          <button type="button" className="ghost-button small" onClick={refreshCustomers}>Atualizar</button>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="empty-state-box">
            <div className="empty-state-icon" aria-hidden="true">+</div>
            <div>
              <h3>Nenhum cliente encontrado</h3>
              <p>Altere os filtros ou cadastre um novo cliente para continuar.</p>
            </div>
          </div>
        ) : null}

        <div className="customers-table-wrap">
          <table className="customers-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Documento</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th>Endereço</th>
                <th>Cidade/Estado</th>
                <th>Status</th>
                <th>Observações</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer, index) => (
                  <tr key={`${customer.name}-${index}`}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <strong>{customer.name}</strong>
                        <span>{customer.segment}</span>
                      </div>
                    </td>
                    <td>{customer.document || '—'}</td>
                    <td>{customer.email || '—'}</td>
                    <td>{customer.phone || customer.contact || '—'}</td>
                    <td>{customer.address || '—'}</td>
                    <td>{customer.city && customer.state ? `${customer.city}/${customer.state}` : customer.city || customer.state || '—'}</td>
                    <td>{customer.status}</td>
                    <td>{customer.notes || '—'}</td>
                    <td>
                      <div className="customer-actions">
                        <button
                          type="button"
                          className="ghost-button small"
                          onClick={() => handleEditCustomer(customer)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="ghost-button small danger"
                          onClick={() => handleRemoveCustomer(customer)}
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
