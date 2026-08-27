const controls = [
  { title: 'Permissões por perfil', detail: 'Acesso controlado para usuários, áreas e líderes.' },
  { title: 'Auditoria de ações', detail: 'Histórico completo de alterações e aprovações realizadas.' },
  { title: 'Políticas de qualidade', detail: 'Conformidade e checkpoints para operação crítica.' },
]

export default function GovernancePage() {
  return (
    <section className="module-page">
      <div className="topbar">
        <div>
          <p className="eyebrow-light">Governança</p>
          <h1 className="module-title">Segurança, compliance e controle operacional</h1>
        </div>
      </div>

      <div className="panel-grid three-up">
        {controls.map((item) => (
          <article key={item.title} className="panel-card">
            <p className="panel-kicker">Controle</p>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <span className="state-pill green">verificado</span>
          </article>
        ))}
      </div>
    </section>
  )
}
