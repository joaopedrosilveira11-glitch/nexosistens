const blocks = []

export default function ReportsPage() {
  return (
    <section className="module-page">
      <div className="topbar">
        <div>
          <p className="eyebrow-light">Relatórios</p>
          <h1 className="module-title">Indicadores e monitoramento de execução</h1>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className="panel-card empty-state" style={{ maxWidth: 640, padding: '2rem' }}>
          <p className="panel-kicker">Base limpa</p>
          <h3>Nenhum indicador cadastrado ainda</h3>
          <p>Adicione clientes, pedidos e movimentações para que os relatórios comecem a gerar dados da sua operação.</p>
        </div>
      ) : (
        <div className="panel-grid four-up">
          {blocks.map((item) => (
            <article key={item.title} className="panel-card">
              <p className="panel-kicker">Indicador</p>
              <h3>{item.title}</h3>
              <strong className="value-big">{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
