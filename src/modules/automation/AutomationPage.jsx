const flows = [
  { title: 'Alerta de estoque crítico', detail: 'Envia notificação ao responsável quando o nível cai abaixo do mínimo.' },
  { title: 'Aprovação automática', detail: 'Prioriza pedidos com SLA e rejeita itens fora de regra.' },
  { title: 'Reagendamento de produção', detail: 'Replaneja cargas quando há atraso de fornecedor ou cliente.' },
]

export default function AutomationPage() {
  return (
    <section className="module-page">
      <div className="topbar">
        <div>
          <p className="eyebrow-light">Automação</p>
          <h1 className="module-title">Fluxos inteligentes para operação</h1>
        </div>
      </div>

      <div className="panel-grid three-up">
        {flows.map((item) => (
          <article key={item.title} className="panel-card">
            <p className="panel-kicker">Workflow</p>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <span className="state-pill blue">ativo</span>
          </article>
        ))}
      </div>
    </section>
  )
}
