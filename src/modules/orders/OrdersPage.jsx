import { useMemo, useState } from 'react'
import './OrdersPage.css'

const defaultOrders = []

const statusFlow = ['recebido', 'em produção', 'em separação', 'em entrega', 'concluído']

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export default function OrdersPage() {
  const [orders, setOrders] = useState(defaultOrders)
  const [form, setForm] = useState({
    customer: '',
    title: '',
    total: 0,
    sourceBudget: '',
  })

  const metrics = useMemo(() => {
    const total = orders.length
    const emProducao = orders.filter((order) => order.status === 'em produção').length
    const emEntrega = orders.filter((order) => order.status === 'em entrega').length
    const concluidos = orders.filter((order) => order.status === 'concluído').length

    return { total, emProducao, emEntrega, concluidos }
  }, [orders])

  const advanceOrder = (id) => {
    setOrders((current) => current.map((order) => {
      const currentIndex = statusFlow.indexOf(order.status)
      const nextStatus = statusFlow[Math.min(currentIndex + 1, statusFlow.length - 1)]
      return order.id === id ? { ...order, status: nextStatus } : order
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const customer = form.customer.trim()
    const title = form.title.trim()
    if (!customer || !title) return

    const nextOrder = {
      id: `PED-${Math.floor(2000 + Math.random() * 9000)}`,
      sourceBudget: form.sourceBudget || 'manual',
      customer,
      title,
      total: Number(form.total) || 0,
      status: 'recebido',
      priority: 'média',
      createdAt: new Date().toISOString().slice(0, 10),
      deliveryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 12).toISOString().slice(0, 10),
      items: [{ name: title, qty: 1, unitPrice: Number(form.total) || 0 }],
    }

    setOrders((current) => [nextOrder, ...current])
    setForm({ customer: '', title: '', total: 0, sourceBudget: '' })
  }

  return (
    <section className="module-page orders-page">
      <div className="topbar">
        <div>
          <p className="eyebrow-light">Operação</p>
          <h1 className="module-title">Pedidos</h1>
        </div>
      </div>

      <div className="kpi-grid four-up">
        <article className="panel-card">
          <p className="panel-kicker">Pedidos</p>
          <h3>{metrics.total}</h3>
          <span className="state-pill blue">Ativos</span>
        </article>
        <article className="panel-card">
          <p className="panel-kicker">Produção</p>
          <h3>{metrics.emProducao}</h3>
          <span className="state-pill purple">Em andamento</span>
        </article>
        <article className="panel-card">
          <p className="panel-kicker">Entrega</p>
          <h3>{metrics.emEntrega}</h3>
          <span className="state-pill amber">Em rota</span>
        </article>
        <article className="panel-card">
          <p className="panel-kicker">Concluídos</p>
          <h3>{metrics.concluidos}</h3>
          <span className="state-pill green">Finalizados</span>
        </article>
      </div>

      <div className="orders-layout">
        <form className="panel-card orders-form" onSubmit={handleSubmit}>
          <div className="form-header">
            <p className="panel-kicker">Novo pedido</p>
            <h3>Criar pedido manual</h3>
          </div>

          <label className="field">
            <span>Cliente</span>
            <input value={form.customer} onChange={(event) => setForm((current) => ({ ...current, customer: event.target.value }))} placeholder="Nome do cliente" />
          </label>

          <label className="field">
            <span>Título</span>
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Pedido de entrega" />
          </label>

          <label className="field">
            <span>Origem do orçamento</span>
            <input value={form.sourceBudget} onChange={(event) => setForm((current) => ({ ...current, sourceBudget: event.target.value }))} placeholder="ORC-1005" />
          </label>

          <label className="field">
            <span>Valor total</span>
            <input type="number" min="0" step="0.01" value={form.total} onChange={(event) => setForm((current) => ({ ...current, total: Number(event.target.value) }))} placeholder="0,00" />
          </label>

          <button type="submit" className="primary-button">Salvar pedido</button>
        </form>

        <div className="panel-card order-list-panel">
          <div className="form-header">
            <p className="panel-kicker">Fluxo</p>
            <h3>Pedidos em execução</h3>
          </div>

          <div className="order-list">
            {orders.length === 0 ? (
              <div className="empty-state">Nenhum pedido cadastrado. O ambiente está limpo para a nova empresa.</div>
            ) : (
              orders.map((order) => (
                <article key={order.id} className="order-card">
                  <div className="order-card-head">
                    <div>
                      <span className="order-id">{order.id}</span>
                      <h4>{order.title}</h4>
                    </div>
                    <span className={`quote-status ${order.status.replace(/\s+/g, '-')}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="order-card-row">
                    <span>Cliente</span>
                    <strong>{order.customer}</strong>
                  </div>

                  <div className="order-card-row">
                    <span>Origem</span>
                    <strong>{order.sourceBudget}</strong>
                  </div>

                  <div className="order-item-list">
                    {order.items.map((item, index) => (
                      <div key={`${order.id}-${index}`} className="order-item-line">
                        <span>{item.name}</span>
                        <strong>{item.qty} × {money(item.unitPrice)}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="order-card-row total-row">
                    <span>Total</span>
                    <strong>{money(order.total)}</strong>
                  </div>

                  <div className="order-card-row">
                    <span>Entrega</span>
                    <strong>{order.deliveryDate}</strong>
                  </div>

                  <div className="order-progress">
                    {statusFlow.map((status) => (
                      <span key={`${order.id}-${status}`} className={order.status === status ? 'active' : ''}>{status}</span>
                    ))}
                  </div>

                  <button type="button" className="primary-button small" onClick={() => advanceOrder(order.id)}>
                    Avançar status
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
