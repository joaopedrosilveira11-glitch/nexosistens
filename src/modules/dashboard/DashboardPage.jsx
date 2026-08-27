import { useState } from 'react'
import { getEffectiveRoleValue } from '../../config/navigation'
import { useDashboardViewModel } from '../../hooks/useDashboardViewModel'
import { SectionCard } from '../../components/common/SectionCard'

const defaultModules = [
  { name: 'Pedidos', value: 0, tone: 'flat', caption: 'neste período' },
  { name: 'Receita', value: 'R$ 0,00', tone: 'flat', caption: 'acumulado' },
  { name: 'Clientes', value: 0, tone: 'flat', caption: 'ativos' },
  { name: 'Produtos', value: 0, tone: 'flat', caption: 'em catálogo' },
]

const moduleCards = [
  { key: 'dashboard', title: 'Dashboard', amount: 0, status: 'pronto para uso' },
  { key: 'sales', title: 'Vendas', amount: 0, status: 'sem pedidos registrados' },
  { key: 'customers', title: 'Clientes', amount: 0, status: 'sem cadastros' },
  { key: 'products', title: 'Produtos', amount: 0, status: 'catálogo vazio' },
  { key: 'tasks', title: 'Tarefas', amount: 0, status: 'sem pendências' },
]

const dashboardModuleOptions = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'sales', label: 'Vendas' },
  { key: 'customers', label: 'Clientes' },
  { key: 'products', label: 'Produtos' },
  { key: 'tasks', label: 'Tarefas' },
]

const recentActivity = []

export default function DashboardPage({ session, theme = 'dark', onThemeToggle }) {
  const name = session?.user?.name || session?.user?.email?.split('@')[0] || 'você'
  const currentPlan = session?.user?.plan || 'Pro'
  const isOwner = getEffectiveRoleValue(session?.user) === 'owner'
  const isAiPlanEnabled = ['Pro', 'Enterprise'].includes(currentPlan)
  const { selectedFilter, setSelectedFilter, metrics } = useDashboardViewModel('mes-atual')
  const [firstModuleCreated, setFirstModuleCreated] = useState(true)
  const [panelConfigOpen, setPanelConfigOpen] = useState(false)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [aiQuestion, setAiQuestion] = useState('Quais são os principais riscos operacionais desta semana?')
  const [aiDomain, setAiDomain] = useState('operations')
  const [aiResponse, setAiResponse] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [enabledModules, setEnabledModules] = useState(() => {
    const initial = {}
    dashboardModuleOptions.forEach((module) => {
      initial[module.key] = true
    })
    return initial
  })

  const kpis = firstModuleCreated
    ? [
        { name: 'Módulos', value: Object.values(enabledModules).filter(Boolean).length, tone: 'up', caption: 'ativos' },
        ...defaultModules.slice(1),
      ]
    : metrics.length ? metrics : defaultModules

  const visibleModuleCards = moduleCards.filter((item) => enabledModules[item.key] ?? true)
  const displayModuleCards = visibleModuleCards.length
    ? visibleModuleCards
    : [{ key: 'empty', title: 'Sem módulos ativos', amount: 0, status: 'configure o painel para exibir itens' }]

  const statusText = firstModuleCreated
    ? 'Ambiente limpo e pronto para receber a operação do cliente.'
    : 'Espaço limpo e pronto para o novo usuário.'

  const statusClass = firstModuleCreated ? 'global-status success' : 'global-status info'

  const handleCreateFirstModule = () => {
    setFirstModuleCreated(true)
    setPanelConfigOpen(false)
  }

  const handleToggleModule = (moduleKey) => {
    if (!isOwner) {
      setActionMessage('Apenas o proprietário pode ativar ou ocultar módulos.')
      return
    }

    setEnabledModules((current) => ({
      ...current,
      [moduleKey]: !(current[moduleKey] ?? true),
    }))
  }

  const handleQuickAction = (actionLabel) => {
    setActionMessage(`${actionLabel} foi registrado com sucesso.`)
    setActionMenuOpen(false)
  }

  const handleAskAi = async () => {
    if (!isAiPlanEnabled) {
      setAiError('A IA operacional está disponível apenas nos planos Pro e Enterprise.')
      return
    }

    setAiLoading(true)
    setAiError('')
    setAiResponse('')

    try {
      const response = await fetch('http://localhost:4000/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.token ? { Authorization: `Bearer ${session?.token}` } : {}),
        },
        body: JSON.stringify({
          question: aiQuestion.trim() || 'Quais são os principais riscos operacionais desta semana?',
          plan: currentPlan,
          context: { domain: aiDomain },
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível consultar a IA.')
      }

      setAiResponse(payload.answer || 'Sem resposta disponível.')
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'O assistente de IA não está disponível no momento.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="workspace">
      <div className="topbar">
        <div className="search-box search-box-global">
          <span aria-hidden="true">⌕</span>
          <input aria-label="Busca geral" placeholder="Buscar no sistema" type="text" />
        </div>

        <div className="topbar-actions">
          <button type="button" className="theme-toggle" onClick={onThemeToggle}>
            {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </button>
          <button type="button" className="ghost-button small" onClick={() => setActionMenuOpen((current) => !current)}>
            Nova ação
          </button>
        </div>
      </div>

      {actionMenuOpen && (
        <div className="quick-action-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Ações rápidas</span>
              <h3>Nova ação</h3>
            </div>
            <button type="button" className="ghost-button small" onClick={() => setActionMenuOpen(false)}>Fechar</button>
          </div>

          <div className="quick-action-list">
            {['Criar cliente', 'Registrar pedido', 'Adicionar tarefa'].map((actionLabel) => (
              <button key={actionLabel} type="button" className="quick-action-item" onClick={() => handleQuickAction(actionLabel)}>
                {actionLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      {actionMessage ? (
        <div className="global-status success">
          <span className="global-status-dot" aria-hidden="true" />
          {actionMessage}
          <button type="button" className="ghost-button small inline-dismiss" onClick={() => setActionMessage('')}>
            Fechar
          </button>
        </div>
      ) : (
        <div className={statusClass}>
          <span className="global-status-dot" aria-hidden="true" />
          {statusText}
        </div>
      )}

      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Visão geral</p>
          <h1>Bem-vindo, {name}</h1>
          <p className="hero-text">
            A operação está pronta para receber seus cadastros, pedidos e movimentações sem dados de exemplo.
          </p>
          <div className="hero-actions">
            {isOwner ? (
              <>
                <button type="button" className="primary-button" onClick={handleCreateFirstModule} disabled={firstModuleCreated}>
                  {firstModuleCreated ? 'Módulo criado' : 'Cadastrar primeiro módulo'}
                </button>
                <button
                  type="button"
                  className="ghost-button light"
                  onClick={() => setPanelConfigOpen((current) => !current)}
                >
                  {panelConfigOpen ? 'Fechar painel' : 'Configurar painel'}
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="hero-analytics">
          <div className="mini-card highlight">
            <span>Resumo geral</span>
            <strong>{firstModuleCreated ? 5 : 0}</strong>
            <small>módulos ativos</small>
          </div>
          <div className="mini-card">
            <span>Próxima etapa</span>
            <strong>{firstModuleCreated ? '✓' : '—'}</strong>
            <small>{firstModuleCreated ? 'sincronização OK' : 'sem pendências'}</small>
          </div>
        </div>
      </section>

      {panelConfigOpen && (
        <div className="dashboard-config-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Painel</span>
              <h3>Personalizar módulos</h3>
            </div>
            <button className="ghost-button" onClick={() => setPanelConfigOpen(false)}>
              Fechar
            </button>
          </div>

          <div className="module-toggle-grid">
            {dashboardModuleOptions.map((module) => (
              <button
                key={module.key}
                type="button"
                className={`module-toggle ${enabledModules[module.key] ? 'enabled' : 'disabled'}`}
                onClick={() => handleToggleModule(module.key)}
              >
                <span>{module.label}</span>
                <strong>{enabledModules[module.key] ? 'Ativo' : 'Oculto'}</strong>
              </button>
            ))}
          </div>

          <div className="panel-footer">
            <button className="secondary-button" onClick={() => setPanelConfigOpen(false)}>
              Salvar configuração
            </button>
          </div>
        </div>
      )}

      {isAiPlanEnabled ? (
        <section className="ai-assistant-panel panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow-light">NEXO AI</p>
              <h3>Assistente operacional</h3>
            </div>
          </div>

          <div className="ai-domain-switcher" aria-label="Domínio da IA">
            {[
              ['operations', 'Operações'],
              ['sales', 'Vendas'],
              ['inventory', 'Estoque'],
              ['finance', 'Financeiro'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`domain-pill ${aiDomain === key ? 'active' : ''}`}
                onClick={() => setAiDomain(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ai-assistant-body">
            <textarea
              value={aiQuestion}
              onChange={(event) => setAiQuestion(event.target.value)}
              rows={3}
              placeholder="Pergunte à IA sobre demanda, estoque, metas ou riscos..."
            />
            <button type="button" className="primary-button" onClick={handleAskAi} disabled={aiLoading}>
              {aiLoading ? 'Consultando IA…' : 'Perguntar à IA'}
            </button>
          </div>

          {aiError ? <p className="ai-assistant-error">{aiError}</p> : null}
          {aiResponse ? <div className="ai-assistant-response"><strong>Resposta da IA:</strong><p>{aiResponse}</p></div> : null}
        </section>
      ) : null}

      <section className="executive-strip">
        <div className="executive-heading">
          <div>
            <p className="eyebrow-light">Performance</p>
            <h2>Indicadores do período</h2>
          </div>

          <div className="filter-group" aria-label="Filtro de período">
            {[
              ['mes-atual', 'Mês atual'],
              ['mes-passado', 'Mês anterior'],
              ['trimestre', 'Trimestre'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`filter-pill ${selectedFilter === value ? 'active' : ''}`}
                onClick={() => setSelectedFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="kpi-grid">
        {kpis.map((metric) => (
          <article key={metric.name} className="kpi-card">
            <p>{metric.name}</p>
            <div className="kpi-main">
              <strong>{metric.value}</strong>
              <span className={`trend ${metric.tone || 'flat'}`}>{metric.caption}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <SectionCard subtitle="Módulos" title="Resumo operacional" className="panel">
          <div className="tenant-grid">
            {displayModuleCards.map((item) => (
              <div key={item.key || item.title} className="tenant-item">
                <strong>{item.title}</strong>
                <p>
                  <strong style={{ fontSize: '1.7rem', display: 'block', marginBottom: 4 }}>{item.amount}</strong>
                  {item.status}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard subtitle="Fluxo" title="Atividade recente" className="panel">
          <div className="notification-list" style={{ marginTop: 12 }}>
            {recentActivity.map((entry, index) => (
              <div key={`${entry.title}-${index}`} className={`notification-item ${index === 0 ? 'unread' : ''}`}>
                <div className="notification-icon">{index + 1}</div>
                <div className="notification-copy">
                  <strong>{entry.title}</strong>
                  <p>{entry.description}</p>
                  <small>{entry.time}</small>
                </div>
                <button type="button" className="notification-close" aria-label="Fechar">×</button>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="detail-grid">
        <SectionCard subtitle="Estrutura" title="Módulos da visão geral" className="panel">
          <div className="client-portal-summary-grid">
            {[
             ['Dashboard', '0 itens ativos'],
             ['Clientes', '0 cadastrados'],
             ['Produtos', '0 ativos'],
             ['Operações', '0 em andamento'],
            ].map(([name, info]) => (
              <div key={name} className="client-portal-summary-card">
                <strong>{name}</strong>
                <p>{info}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard subtitle="Status" title="Sistema" className="panel">
          <div className="status-row">
            <span className="dot green" aria-hidden="true" />
            Ambiente inicial pronto
          </div>
          <div className="status-row muted">
            <span className="dot amber" aria-hidden="true" />
            Nenhum alerta de rotina pendente
          </div>
          <div className="status-row muted">
            <span className="dot" style={{ background: '#a78bfa' }} aria-hidden="true" />
            Dados limpos para nova empresa
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
