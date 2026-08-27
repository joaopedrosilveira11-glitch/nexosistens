import { useEffect, useState } from 'react'
import './InventoryPage.css'

const defaultForm = {
  sku: '',
  name: '',
  qty: '0',
  location: '',
  status: 'Disponível',
}

const storageKey = 'nexo-inventory-items'

const initialItems = []

export default function InventoryPage() {
  const [items, setItems] = useState(() => {
    if (typeof window === 'undefined') {
      return initialItems
    }

    try {
      const stored = window.localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : initialItems
    } catch (error) {
      return initialItems
    }
  })
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [filters, setFilters] = useState({ status: 'Todos', search: '' })
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))

  const refreshInventory = () => {
    setLastUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    setItems((current) => current.map((item) => ({ ...item })))
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(items))
    }
  }, [items])

  const filteredItems = items.filter((item) => {
    const matchesStatus = filters.status === 'Todos' || item.status === filters.status
    const searchTerm = filters.search.trim().toLowerCase()
    const matchesSearch = !searchTerm || [item.name, item.sku, item.location].some((value) => (value || '').toLowerCase().includes(searchTerm))
    return matchesStatus && matchesSearch
  })

  const totalQty = filteredItems.reduce((sum, item) => sum + Number(item.qty || 0), 0)
  const lowStock = filteredItems.filter((item) => Number(item.qty || 0) <= 5).length
  const latestItem = filteredItems[filteredItems.length - 1]

  const metricCards = [
    { label: 'Itens em estoque', value: filteredItems.length, delta: `${totalQty} unidades` },
    { label: 'Baixo estoque', value: lowStock, delta: `${lowStock} itens críticos` },
    { label: 'Entrada', value: 'R$ 0,00', delta: 'sem movimentação' },
    { label: 'Último movimento', value: latestItem ? latestItem.name : '—', delta: latestItem ? 'registro recente' : 'sem registro' },
  ]

  const handleFieldChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleCreateItem = (event) => {
    event.preventDefault()

    if (!form.sku.trim() || !form.name.trim() || !form.location.trim()) {
      return
    }

    const nextItem = {
      sku: form.sku.trim().toUpperCase(),
      name: form.name.trim(),
      qty: Number(form.qty || 0),
      location: form.location.trim(),
      status: form.status,
    }

    setItems((current) => [...current, nextItem])
    setLastUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    setForm(defaultForm)
    setIsFormOpen(false)
  }

  const handleCloseForm = () => {
    setForm(defaultForm)
    setIsFormOpen(false)
  }

  return (
    <section className="inventory-page">
      <div className="topbar">
        <div>
          <p className="eyebrow-light">Estoque</p>
          <h1 className="module-title">Controle de estoque</h1>
        </div>

        <div className="topbar-actions">
          <button type="button" className="ghost-button light" onClick={() => setIsFilterOpen((current) => !current)}>
            Filtrar
          </button>
          <button type="button" className="primary-button" onClick={() => setIsFormOpen(true)}>
            Novo item
          </button>
        </div>
      </div>

      {isFilterOpen && (
        <div className="filter-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Filtros</p>
              <h2>Buscar itens</h2>
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
                placeholder="SKU, nome ou local"
              />
            </label>

            <label className="auth-field">
              <span>Status</span>
              <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="Todos">Todos</option>
                <option value="Disponível">Disponível</option>
                <option value="Baixo estoque">Baixo estoque</option>
                <option value="Reservado">Reservado</option>
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
        {filteredItems.length === 0 ? 'Nenhum item encontrado com os filtros atuais.' : 'Base de estoque ativa e atualizada.'}
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
        <div className="inventory-form-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Cadastro</p>
              <h2>Novo item</h2>
            </div>
            <button type="button" className="ghost-button small" onClick={handleCloseForm}>Fechar</button>
          </div>

          <form className="inventory-form" onSubmit={handleCreateItem}>
            <label className="auth-field">
              <span>SKU</span>
              <input type="text" value={form.sku} onChange={(event) => handleFieldChange('sku', event.target.value)} placeholder="EX: NEX-001" />
            </label>

            <label className="auth-field">
              <span>Nome do item</span>
              <input type="text" value={form.name} onChange={(event) => handleFieldChange('name', event.target.value)} placeholder="Ex: Fita isolante" />
            </label>

            <label className="auth-field">
              <span>Quantidade</span>
              <input type="number" min="0" value={form.qty} onChange={(event) => handleFieldChange('qty', event.target.value)} placeholder="0" />
            </label>

            <label className="auth-field">
              <span>Localização</span>
              <input type="text" value={form.location} onChange={(event) => handleFieldChange('location', event.target.value)} placeholder="Ex: Almoxarifado A" />
            </label>

            <label className="auth-field">
              <span>Status</span>
              <select value={form.status} onChange={(event) => handleFieldChange('status', event.target.value)}>
                <option value="Disponível">Disponível</option>
                <option value="Baixo estoque">Baixo estoque</option>
                <option value="Reservado">Reservado</option>
              </select>
            </label>

            <div className="inventory-form-actions">
              <button type="button" className="ghost-button" onClick={handleCloseForm}>Cancelar</button>
              <button type="submit" className="primary-button">Salvar item</button>
            </div>
          </form>
        </div>
      )}

      <div className="panel inventory-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Base</p>
            <h2>Itens em estoque</h2>
          </div>
          <button type="button" className="ghost-button small" onClick={refreshInventory}>Atualizar</button>
        </div>

        {filteredItems.length === 0 ? (
          <div className="empty-state-box">
            <div className="empty-state-icon" aria-hidden="true">+</div>
            <div>
              <h3>Nenhum item encontrado</h3>
              <p>Altere os filtros ou cadastre um novo item para continuar.</p>
            </div>
          </div>
        ) : null}

        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item</th>
                <th>Qtd.</th>
                <th>Local</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item, index) => (
                  <tr key={`${item.sku}-${index}`}>
                    <td>{item.sku}</td>
                    <td>{item.name}</td>
                    <td>{item.qty}</td>
                    <td>{item.location}</td>
                    <td>{item.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
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
