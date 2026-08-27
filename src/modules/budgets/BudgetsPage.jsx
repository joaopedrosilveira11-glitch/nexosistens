import { useMemo, useState } from 'react'
import './BudgetsPage.css'

const defaultBudgets = []

const defaultOrders = []

const initialForm = {
  customer: '',
  title: '',
  validityDays: 15,
  deadline: '',
  discount: 0,
  itemType: 'produto',
  itemName: '',
  itemQty: 1,
  itemUnitPrice: 0,
}

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState(defaultBudgets)
  const [orders, setOrders] = useState(defaultOrders)
  const [form, setForm] = useState(initialForm)
  const [draftItems, setDraftItems] = useState([])

  const totals = useMemo(() => {
    const subtotal = draftItems.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0), 0)
    const discountValue = subtotal * (Number(form.discount) || 0) / 100
    const total = subtotal - discountValue

    return {
      subtotal,
      discountValue,
      total,
    }
  }, [draftItems, form.discount])

  const handleFormField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleAddItem = () => {
    const itemName = form.itemName.trim()
    const qty = Number(form.itemQty) || 1
    const unitPrice = Number(form.itemUnitPrice) || 0

    if (!itemName || unitPrice <= 0) return

    setDraftItems((current) => [
      ...current,
      {
        id: `draft-${Date.now()}`,
        type: form.itemType,
        name: itemName,
        qty,
        unitPrice,
      },
    ])

    setForm((current) => ({
      ...current,
      itemType: 'produto',
      itemName: '',
      itemQty: 1,
      itemUnitPrice: 0,
    }))
  }

  const handleCreateBudget = () => {
    const customer = form.customer.trim()
    const title = form.title.trim()

    if (!customer || !title || draftItems.length === 0) return

    const nextBudget = {
      id: `ORC-${Math.floor(1000 + Math.random() * 9000)}`,
      customer,
      title,
      status: 'enviado',
      validityDays: Number(form.validityDays) || 15,
      deadline: form.deadline || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
      discount: Number(form.discount) || 0,
      items: draftItems,
      sentAt: new Date().toISOString().slice(0, 10),
      approvedOrderId: null,
    }

    setBudgets((current) => [nextBudget, ...current])
    setForm(initialForm)
    setDraftItems([])
  }

  const handlePdf = (budget) => {
    const html = `
      <html><body>
        <h2>Orçamento ${budget.id}</h2>
        <p>Cliente: ${budget.customer}</p>
        <p>Projeto: ${budget.title}</p>
        <ul>${budget.items.map((item) => `<li>${item.name} — ${item.qty} x ${money(item.unitPrice)}</li>`).join('')}</ul>
        <p>Desconto: ${budget.discount}%</p>
        <p>Total: ${money(budget.items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0) * (1 - budget.discount / 100))}</p>
      </body></html>
    `

    if (typeof window === 'undefined') return

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const handleSend = (budgetId) => {
    setBudgets((current) => current.map((budget) => (budget.id === budgetId ? { ...budget, status: 'enviado', sentAt: new Date().toISOString().slice(0, 10) } : budget)))
  }

  const handleApprove = (budgetId) => {
    const selectedBudget = budgets.find((budget) => budget.id === budgetId)
    if (!selectedBudget) return

    const generatedOrder = {
      id: `PED-${Math.floor(2000 + Math.random() * 9000)}`,
      sourceBudget: selectedBudget.id,
      customer: selectedBudget.customer,
      total: selectedBudget.items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0) * (1 - (selectedBudget.discount || 0) / 100),
      status: 'Gerado automaticamente',
    }

    setOrders((current) => [generatedOrder, ...current])
    setBudgets((current) => current.map((budget) => (budget.id === budgetId ? { ...budget, status: 'aprovado', approvedOrderId: generatedOrder.id } : budget)))
  }

  const handleDecline = (budgetId) => {
    setBudgets((current) => current.map((budget) => (budget.id === budgetId ? { ...budget, status: 'recusado' } : budget)))
  }

  return (
    <section className="module-page budgets-page">
      <div className="topbar">
        <div>
          <p className="eyebrow-light">Todos os planos</p>
          <h1 className="module-title">Sistema de orçamentos</h1>
        </div>
      </div>

      <div className="budget-summary-grid">
        <article className="panel-card">
          <p className="panel-kicker">Total</p>
          <h3>{budgets.length}</h3>
          <span className="state-pill blue">Orçamentos</span>
        </article>
        <article className="panel-card">
          <p className="panel-kicker">Aprovados</p>
          <h3>{budgets.filter((budget) => budget.status === 'aprovado').length}</h3>
          <span className="state-pill green">Pedidos gerados</span>
        </article>
        <article className="panel-card">
          <p className="panel-kicker">Pendentes</p>
          <h3>{budgets.filter((budget) => budget.status === 'enviado' || budget.status === 'aguardando aprovação').length}</h3>
          <span className="state-pill amber">Aguardando resposta</span>
        </article>
        <article className="panel-card">
          <p className="panel-kicker">Pedidos</p>
          <h3>{orders.length}</h3>
          <span className="state-pill purple">Automáticos</span>
        </article>
      </div>

      <div className="budget-layout">
        <div className="panel-card budget-form-panel">
          <div className="budget-panel-header">
            <div>
              <p className="panel-kicker">Criar orçamento</p>
              <h3>Novo orçamento</h3>
            </div>
          </div>

          <div className="budget-form-grid">
            <label className="field">
              <span>Cliente</span>
              <input value={form.customer} onChange={(event) => handleFormField('customer', event.target.value)} placeholder="Nome do cliente" />
            </label>

            <label className="field">
              <span>Título</span>
              <input value={form.title} onChange={(event) => handleFormField('title', event.target.value)} placeholder="Orçamento de manutenção" />
            </label>

            <label className="field">
              <span>Validade</span>
              <input type="number" min="1" value={form.validityDays} onChange={(event) => handleFormField('validityDays', event.target.value)} />
            </label>

            <label className="field">
              <span>Prazo</span>
              <input type="date" value={form.deadline} onChange={(event) => handleFormField('deadline', event.target.value)} />
            </label>

            <label className="field">
              <span>Desconto</span>
              <input type="number" min="0" max="100" value={form.discount} onChange={(event) => handleFormField('discount', event.target.value)} />
            </label>

            <div className="line-break" />

            <label className="field">
              <span>Tipo</span>
              <select value={form.itemType} onChange={(event) => handleFormField('itemType', event.target.value)}>
                <option value="produto">Produto</option>
                <option value="serviço">Serviço</option>
              </select>
            </label>

            <label className="field">
              <span>Nome</span>
              <input value={form.itemName} onChange={(event) => handleFormField('itemName', event.target.value)} placeholder="Kit, serviço ou consultoria" />
            </label>

            <label className="field">
              <span>Quantidade</span>
              <input type="number" min="1" value={form.itemQty} onChange={(event) => handleFormField('itemQty', event.target.value)} />
            </label>

            <label className="field">
              <span>Valor unitário</span>
              <input type="number" min="0" step="0.01" value={form.itemUnitPrice} onChange={(event) => handleFormField('itemUnitPrice', event.target.value)} />
            </label>

            <button type="button" className="ghost-button full-button" onClick={handleAddItem}>Adicionar item</button>
          </div>

          <div className="draft-items">
            {draftItems.length === 0 ? (
              <div className="empty-state">Nenhum item adicionado. Comece a montar o primeiro orçamento em branco.</div>
            ) : (
              draftItems.map((item) => (
                <div key={item.id} className="draft-item">
                  <span>{item.type}</span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.qty} × {money(item.unitPrice)}
                  </small>
                </div>
              ))
            )}
          </div>

          <div className="budget-totals">
            <div>
              <span>Subtotal</span>
              <strong>{money(totals.subtotal)}</strong>
            </div>
            <div>
              <span>Desconto</span>
              <strong>-{money(totals.discountValue)}</strong>
            </div>
            <div className="total-box">
              <span>Total</span>
              <strong>{money(totals.total)}</strong>
            </div>
          </div>

          <button type="button" className="primary-button" onClick={handleCreateBudget}>Salvar orçamento</button>
        </div>

        <div className="panel-card budget-list-panel">
          <div className="budget-panel-header">
            <div>
              <p className="panel-kicker">Orçamentos</p>
              <h3>Lista ativa</h3>
            </div>
          </div>

          <div className="budget-list">
            {budgets.length === 0 ? (
              <div className="empty-state">Nenhum orçamento cadastrado. O ambiente está limpo para a nova empresa.</div>
            ) : (
              budgets.map((budget) => {
                const subtotal = budget.items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0)
                const withDiscount = subtotal * (1 - (budget.discount || 0) / 100)

                return (
                  <article key={budget.id} className="budget-card">
                    <div className="budget-card-header">
                      <div>
                        <span className="budget-id">{budget.id}</span>
                        <h4>{budget.title}</h4>
                      </div>
                      <span className={`quote-status ${budget.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {budget.status}
                      </span>
                    </div>

                    <p className="budget-client">Cliente: {budget.customer}</p>

                    <div className="budget-items">
                      {budget.items.map((item) => (
                        <div key={`${budget.id}-${item.id}`} className="budget-item-line">
                          <span>{item.name}</span>
                          <strong>{money(item.qty * item.unitPrice)}</strong>
                        </div>
                      ))}
                    </div>

                    <div className="budget-meta-row">
                      <small>Validade: {budget.validityDays} dias</small>
                      <small>Prazo: {budget.deadline}</small>
                    </div>

                    <div className="budget-total-row">
                      <span>Desconto</span>
                      <strong>{budget.discount}%</strong>
                    </div>

                    <div className="budget-total-row total-highlight">
                      <span>Total</span>
                      <strong>{money(withDiscount)}</strong>
                    </div>

                    <div className="budget-actions">
                      <button type="button" className="ghost-button small" onClick={() => handlePdf(budget)}>Gerar PDF</button>
                      <button type="button" className="ghost-button small" onClick={() => handleSend(budget.id)}>Enviar</button>
                      <button type="button" className="primary-button small" onClick={() => handleApprove(budget.id)}>Aprovar</button>
                      <button type="button" className="logout-button small" onClick={() => handleDecline(budget.id)}>Recusar</button>
                    </div>

                    {budget.approvedOrderId ? (
                      <div className="budget-order-box">
                        <span>Pedido gerado</span>
                        <strong>{budget.approvedOrderId}</strong>
                      </div>
                    ) : null}
                  </article>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div className="panel-card order-panel">
        <div className="budget-panel-header">
          <div>
            <p className="panel-kicker">Pedidos</p>
            <h3>Gerados automaticamente</h3>
          </div>
        </div>

        <div className="order-list">
          {orders.map((order) => (
            <div key={order.id} className="order-item">
              <div>
                <span className="budget-id">{order.id}</span>
                <h4>{order.customer}</h4>
              </div>
              <div className="order-copy">
                <small>Origem: {order.sourceBudget}</small>
                <strong>{money(order.total)}</strong>
              </div>
              <span className="state-pill green">{order.status}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
