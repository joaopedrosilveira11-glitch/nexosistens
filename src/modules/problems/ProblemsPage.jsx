import { useMemo, useState } from 'react'
import './ProblemsPage.css'

const categoryOptions = [
  'produção',
  'estoque',
  'financeiro',
  'cliente',
  'fornecedor',
  'equipamento',
  'sistema',
  'logística',
  'qualidade',
  'outros',
]

const statusOptions = [
  'aberto',
  'em análise',
  'em resolução',
  'aguardando',
  'resolvido',
  'encerrado',
]

const defaultProblems = []

const emptyForm = {
  id: '',
  title: '',
  description: '',
  category: 'produção',
  priority: 'média',
  responsible: '',
  sector: 'Produção',
  status: 'aberto',
  deadline: '',
  origin: 'Operação',
  attachments: 0,
  comments: 0,
  history: '',
}

const formatPriority = (priority) => {
  const map = {
    baixa: 'Baixa',
    média: 'Média',
    alta: 'Alta',
    crítica: 'Crítica',
  }

  return map[priority] || 'Média'
}

const formatStatus = (status) => {
  const map = {
    aberto: 'Aberto',
    'em análise': 'Em análise',
    'em resolução': 'Em resolução',
    aguardando: 'Aguardando',
    resolvido: 'Resolvido',
    encerrado: 'Encerrado',
  }

  return map[status] || 'Aberto'
}

export default function ProblemsPage() {
  const [problems, setProblems] = useState(defaultProblems)
  const [form, setForm] = useState(emptyForm)

  const metrics = useMemo(() => {
    const total = problems.length
    const averageResolution = total
      ? (problems.reduce((sum, item) => sum + Number(item.resolutionDays || 0), 0) / total).toFixed(1)
      : '0.0'

    const sectorMap = problems.reduce((accumulator, item) => {
      const key = item.sector || 'Outros'
      accumulator[key] = (accumulator[key] || 0) + 1
      return accumulator
    }, {})

    const recurrentMap = problems.reduce((accumulator, item) => {
      const key = item.title.trim().toLowerCase()
      if (!key) return accumulator
      accumulator[key] = (accumulator[key] || 0) + 1
      return accumulator
    }, {})

    const recurrent = Object.values(recurrentMap).filter((count) => count > 1).length

    return {
      total,
      averageResolution,
      sectorMap,
      recurrent,
    }
  }, [problems])

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const title = form.title.trim()
    const description = form.description.trim()
    const responsible = form.responsible.trim()

    if (!title || !description || !responsible) return

    const nextProblem = {
      id: form.id || `PRO-${Date.now().toString().slice(-4)}`,
      title,
      description,
      category: form.category,
      priority: form.priority,
      responsible,
      sector: form.sector,
      status: form.status,
      deadline: form.deadline || 'Sem prazo',
      origin: form.origin,
      attachments: Number(form.attachments) || 0,
      comments: Number(form.comments) || 0,
      history: form.history || 'Registro inicial da ocorrência.',
      resolutionDays: 1,
    }

    setProblems((current) => [nextProblem, ...current])
    setForm(emptyForm)
  }

  return (
    <section className="module-page problems-page">
      <div className="topbar">
        <div>
          <p className="eyebrow-light">Pro • Enterprise</p>
          <h1 className="module-title">Central de problemas</h1>
        </div>
      </div>

      <div className="kpi-grid four-up">
        <article className="panel-card">
          <p className="panel-kicker">Problemas</p>
          <h3>{metrics.total}</h3>
          <span className="state-pill blue">Total em operação</span>
        </article>
        <article className="panel-card">
          <p className="panel-kicker">Tempo médio</p>
          <h3>{metrics.averageResolution}d</h3>
          <span className="state-pill green">Resolução média</span>
        </article>
        <article className="panel-card">
          <p className="panel-kicker">Setores</p>
          <h3>{Object.keys(metrics.sectorMap).length}</h3>
          <span className="state-pill purple">Com ocorrência</span>
        </article>
        <article className="panel-card">
          <p className="panel-kicker">Recorrentes</p>
          <h3>{metrics.recurrent}</h3>
          <span className="state-pill amber">Casos repetidos</span>
        </article>
      </div>

      <div className="panel-grid split challenges-grid">
        <form className="panel-card problems-form" onSubmit={handleSubmit}>
          <div className="form-header">
            <p className="panel-kicker">Registrar incidente</p>
            <h3>Novo problema</h3>
          </div>

          <div className="form-grid two-col">
            <label className="field">
              <span>Número</span>
              <input value={form.id} onChange={(event) => handleChange('id', event.target.value)} placeholder="PRO-1068" />
            </label>

            <label className="field">
              <span>Prioridade</span>
              <select value={form.priority} onChange={(event) => handleChange('priority', event.target.value)}>
                <option value="baixa">Baixa</option>
                <option value="média">Média</option>
                <option value="alta">Alta</option>
                <option value="crítica">Crítica</option>
              </select>
            </label>

            <label className="field full-width">
              <span>Título</span>
              <input value={form.title} onChange={(event) => handleChange('title', event.target.value)} placeholder="Ex: Falta de insumo crítico" />
            </label>

            <label className="field full-width">
              <span>Descrição</span>
              <textarea value={form.description} onChange={(event) => handleChange('description', event.target.value)} rows="4" placeholder="Descreva o impacto e a condição atual do problema." />
            </label>

            <label className="field">
              <span>Categoria</span>
              <select value={form.category} onChange={(event) => handleChange('category', event.target.value)}>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Setor</span>
              <input value={form.sector} onChange={(event) => handleChange('sector', event.target.value)} placeholder="Produção" />
            </label>

            <label className="field">
              <span>Responsável</span>
              <input value={form.responsible} onChange={(event) => handleChange('responsible', event.target.value)} placeholder="Nome do responsável" />
            </label>

            <label className="field">
              <span>Status</span>
              <select value={form.status} onChange={(event) => handleChange('status', event.target.value)}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{formatStatus(status)}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Prazo</span>
              <input type="date" value={form.deadline} onChange={(event) => handleChange('deadline', event.target.value)} />
            </label>

            <label className="field">
              <span>Origem</span>
              <input value={form.origin} onChange={(event) => handleChange('origin', event.target.value)} placeholder="Operação" />
            </label>

            <label className="field">
              <span>Anexos</span>
              <input type="number" min="0" value={form.attachments} onChange={(event) => handleChange('attachments', event.target.value)} />
            </label>

            <label className="field">
              <span>Comentários</span>
              <input type="number" min="0" value={form.comments} onChange={(event) => handleChange('comments', event.target.value)} />
            </label>

            <label className="field full-width">
              <span>Histórico</span>
              <textarea value={form.history} onChange={(event) => handleChange('history', event.target.value)} rows="3" placeholder="Resumo do histórico e ações realizadas." />
            </label>
          </div>

          <button type="submit" className="primary-button">Salvar problema</button>
        </form>

        <div className="panel-card problem-list-panel">
          <div className="form-header">
            <p className="panel-kicker">Monitoramento</p>
            <h3>Problemas ativos</h3>
          </div>

          <div className="problem-list">
            {problems.map((problem) => (
              <article key={`${problem.id}-${problem.title}`} className="problem-item">
                <div className="problem-item-header">
                  <div>
                    <span className="problem-code">{problem.id}</span>
                    <h4>{problem.title}</h4>
                  </div>
                  <span className={`state-pill ${problem.priority === 'crítica' ? 'warning' : problem.priority === 'alta' ? 'purple' : 'blue'}`}>
                    {formatPriority(problem.priority)}
                  </span>
                </div>

                <p>{problem.description}</p>

                <div className="problem-meta">
                  <span>{problem.category}</span>
                  <span>{problem.sector}</span>
                  <span>{problem.responsible}</span>
                  <span>{formatStatus(problem.status)}</span>
                </div>

                <div className="problem-footer">
                  <small>Prazo: {problem.deadline}</small>
                  <small>Anexos: {problem.attachments}</small>
                  <small>Comentários: {problem.comments}</small>
                </div>
                <div className="problem-history">{problem.history}</div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-card metrics-panel">
        <div className="form-header">
          <p className="panel-kicker">Métricas</p>
          <h3>Problemas por setor</h3>
        </div>

        <div className="sector-metrics">
          {Object.entries(metrics.sectorMap).map(([sector, count]) => (
            <div key={sector} className="sector-row">
              <div className="sector-row-text">
                <strong>{sector}</strong>
                <span>{count} ocorrências</span>
              </div>
              <div className="sector-bar">
                <span style={{ width: `${(count / Math.max(metrics.total, 1)) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
