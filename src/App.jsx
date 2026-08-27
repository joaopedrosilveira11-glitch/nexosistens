import AuthFlow from './components/AuthFlow'
import { getEffectiveRoleValue } from './config/navigation'
import { AppShellProvider, useAppShell } from './context/AppShellContext'
import DashboardPage from './modules/dashboard/DashboardPage'
import CustomersPage from './modules/customers/CustomersPage'
import ProductionPage from './modules/production/ProductionPage'
import InventoryPage from './modules/inventory/InventoryPage'
import UsersPage from './modules/users/UsersPage'
// EmployeesPage now embedded in UsersPage; menu entry removed
import FinancePage from './modules/finance/FinancePage'
import InvoicesPage from './modules/invoices/InvoicesPage'
import ReportsPage from './modules/reports/ReportsPage'
import BudgetsPage from './modules/budgets/BudgetsPage'
import OrdersPage from './modules/orders/OrdersPage'
import ProblemsPage from './modules/problems/ProblemsPage'
import AutomationPage from './modules/automation/AutomationPage'
import GovernancePage from './modules/governance/GovernancePage'
import './App.css'

function App() {
  return (
    <AppShellProvider>
      <AppContent />
    </AppShellProvider>
  )
}

function AppContent() {
  const {
    session,
    showLanding,
    activeModule,
    selectedPlan,
    theme,
    visibleNavigation,
    setSession,
    setActiveModule,
    setSelectedPlan,
    setShowLanding,
    enterApp,
    goToLanding,
    handleLogout,
    toggleTheme,
  } = useAppShell()

  const isOwner = getEffectiveRoleValue(session?.user) === 'owner'

  const scrollToSection = (id) => {
    if (typeof document === 'undefined') return
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const problemPoints = [
    'Dados espalhados em planilhas e sistemas que não conversam entre si.',
    'Time perdendo tempo em tarefas manuais e retrabalho operacional.',
    'Falta de visibilidade para reagir rápido às mudanças do negócio.',
  ]

  const solutionPoints = [
    'Conecte vendas, estoque, produção e pessoas em um único painel.',
    'Automatize processos repetitivos e reduza a fricção da operação.',
    'Tome decisões baseadas em dados em tempo real com clareza.',
  ]

  const featureCards = [
    { icon: '01', title: 'Gestão unificada', text: 'Acompanhe métricas, processos e entregas em um ambiente centralizado.', tone: 'tone-blue' },
    { icon: '02', title: 'Fluxos de operação', text: 'Estruture tarefas, aprovações, prioridades e indicadores em um único lugar.', tone: 'tone-cyan' },
    { icon: '03', title: 'Rastreabilidade', text: 'Veja o histórico de decisões, movimentações e evolução da operação em tempo real.', tone: 'tone-violet' },
  ]

  const automationCards = [
    { title: 'Alertas automáticos', text: 'Receba notificações de atrasos, estoque crítico e desvios de SLA.' },
    { title: 'Workflows inteligentes', text: 'Crie regras para aprovar, priorizar e responder a cenários operacionais.' },
    { title: 'Gatilhos de ação', text: 'Conecte processos com ações instantâneas para acelerar a operação.' },
  ]

  const pricingPlans = [
    {
      name: 'Starter',
      price: 'R$ 79',
      description: 'Para empresas que querem começar a organizar operação, clientes e estoque sem perder clareza.',
      features: ['Dashboard operacional', 'Gestão de clientes', 'Controle de estoque', 'Notas fiscais', 'Relatórios essenciais'],
    },
    {
      name: 'Growth',
      price: 'R$ 149',
      description: 'Para negócios em expansão que precisam visibilidade, produção e automação real.',
      features: ['Tudo do Starter', 'Produção e ordens', 'Automação de processos', 'Financeiro e projeções', 'Acesso para 10 usuários'],
    },
    {
      name: 'Pro',
      price: 'R$ 249',
      description: 'Para operações que exigem performance, previsibilidade e autonomia de equipe.',
      features: ['Tudo do Growth', 'Gestão de usuários', 'AI operacional', 'Suporte prioritário', 'Notas fiscais avançadas'],
      featured: true,
    },
    {
      name: 'Enterprise',
      price: 'Personalizado',
      description: 'Para empresas com múltiplos processos, altos volumes e requisitos específicos.',
      features: ['Tudo do Pro', 'Governança e segurança', 'SLA dedicado', 'Time de implementação', 'Compliance e auditoria'],
    },
  ]

  const faqItems = [
    {
      question: 'A NEXO funciona para empresas de diferentes tamanhos?',
      answer: 'Sim. A plataforma foi desenhada para operar desde pequenas empresas até equipes de maior complexidade, com configurações que acompanham o crescimento do negócio.',
    },
    {
      question: 'É possível implementar sem alterar processos existentes?',
      answer: 'Sim. A NEXO foi pensada para acelerar a operação sem quebrar os fluxos atuais, permitindo evoluir com clareza e menos resistência.',
    },
    {
      question: 'A plataforma é segura?',
      answer: 'Sim. A camada de segurança inclui controles de acesso, autenticação e proteção de dados para manter a operação em ambiente confiável.',
    },
  ]

  // A landing page independente permite que o usuário volte para a apresentação
  // inicial a qualquer momento, sem ficar preso ao formulário de login.
  if (showLanding) {
    return (
      <div className="landing-shell">
        <header className="landing-header">
          <div className="landing-brand">
            <div className="brand-mark">N</div>
            <div>
              <p>NEXO</p>
              <span>operational intelligence</span>
            </div>
          </div>

          <nav className="landing-nav" aria-label="Navegação principal">
            <a href="#problema">Problema</a>
            <a href="#solucoes">Soluções</a>
            <a href="#recursos">Recursos</a>
            <a href="#planos">Planos</a>
          </nav>
        </header>

        <main className="landing-content">
          <section className="landing-hero">
            <div className="landing-copy">
              <p className="landing-kicker">NEXO</p>
              <h1>A inteligência que conecta sua empresa.</h1>
              <p className="landing-lead">
                Centralize operações, pessoas, processos, vendas e informações em uma única plataforma inteligente.
              </p>

              <div className="landing-actions">
                <button type="button" className="primary-button" onClick={() => {
                 setSession(null)
                 setShowLanding(false)
                }}>
                  Começar agora
                </button>
                <button type="button" className="secondary-button" onClick={() => scrollToSection('solucoes')}>
                  Conhecer o NEXO
                </button>
              </div>

              <div className="trust-row">
                <span>Operações</span>
                <span>Vendas</span>
                <span>Produção</span>
                <span>Inteligência</span>
              </div>
            </div>

            <div className="hero-metrics-panel">
              <div className="metric-card highlight">
                <span>Tempo de decisão</span>
                <strong>3x</strong>
                <small>mais rápido com dados centralizados</small>
              </div>
              <div className="metric-card">
                <span>Eficiência operacional</span>
                <strong>+38%</strong>
                <small>em produtividade e execução</small>
              </div>
            </div>
          </section>

          <section id="problema" className="landing-section">
            <div className="section-heading">
              <p className="landing-kicker">Problema</p>
              <h2>Operações dispersas geram perda de tempo e risco.</h2>
            </div>
            <div className="feature-grid compact">
              {problemPoints.map((item) => (
                <div key={item} className="landing-card">
                  <div className="feature-icon">!</div>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="solucoes" className="landing-section">
            <div className="section-heading">
              <p className="landing-kicker">Solução</p>
              <h2>Uma base operacional que conecta tudo o que importa.</h2>
            </div>
            <div className="solution-panel">
              <div className="solution-copy">
                <p>
                  A NEXO transforma a operação em uma máquina mais clara, previsível e automatizada.
                  Com uma visão única do negócio, sua equipe reduz retrabalho e acelera decisões.
                </p>
              </div>
              <ul className="solution-list">
                {solutionPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section id="recursos" className="landing-section">
            <div className="section-heading">
              <p className="landing-kicker">Recursos</p>
              <h2>Ferramentas para operar com previsibilidade.</h2>
            </div>
            <div className="feature-grid">
              {featureCards.map((feature) => (
                <div key={feature.title} className={`landing-card ${feature.tone}`}>
                  <div className="feature-icon">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="landing-section">
            <div className="section-heading">
              <p className="landing-kicker">NEXO AI</p>
              <h2>IA para acelerar ações e decisões operacionais.</h2>
            </div>
            <div className="ai-showcase">
              <div className="ai-chat">
                <div className="ai-bubble user">Quais entregas correm risco hoje?</div>
                <div className="ai-bubble assistant">Há 3 pendências com risco de atraso. Também identifiquei um estoque crítico em nova solicitação.</div>
              </div>
              <div className="ai-benefits">
                <div>
                  <strong>Priorização inteligente</strong>
                  <span>Identifica gargalos com base em dados, SLA e impacto financeiro.</span>
                </div>
                <div>
                  <strong>Recomendações em tempo real</strong>
                  <span>Mostra os próximos passos com base em padrões da operação.</span>
                </div>
              </div>
            </div>
          </section>

          <section className="landing-section">
            <div className="section-heading">
              <p className="landing-kicker">Dashboard</p>
              <h2>Visão clara do que está funcionando e do que precisa de atenção.</h2>
            </div>
            <div className="dashboard-preview">
              <div className="mini-chart">
                <div className="bars" aria-label="Gráfico de desempenho">
                  <span style={{ height: '42%' }} />
                  <span style={{ height: '58%' }} />
                  <span style={{ height: '65%' }} />
                  <span style={{ height: '74%' }} />
                  <span style={{ height: '89%' }} />
                  <span style={{ height: '92%' }} />
                  <span style={{ height: '96%' }} />
                </div>
              </div>
              <div className="dashboard-stats">
                <div>
                  <strong>94%</strong>
                  <span>taxa de execução</span>
                </div>
                <div>
                  <strong>18h</strong>
                  <span>média de tempo economizado por semana</span>
                </div>
              </div>
            </div>
          </section>

          <section className="landing-section">
            <div className="section-heading">
              <p className="landing-kicker">Automações</p>
              <h2>Automatize o que se repete e libere seu time para o estratégico.</h2>
            </div>
            <div className="feature-grid compact">
              {automationCards.map((card) => (
                <div key={card.title} className="landing-card">
                  <div className="feature-icon">⚡</div>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="landing-section">
            <div className="section-heading">
              <p className="landing-kicker">Segurança</p>
              <h2>Controle, proteção e confiança para sua operação.</h2>
            </div>
            <div className="security-grid">
              <div className="security-item">
                <strong>Autenticação reforçada</strong>
                <span>Controle de acesso com autenticação segura e gestão de permissões.</span>
              </div>
              <div className="security-item">
                <strong>Dados protegidos</strong>
                <span>Estrutura preparada para manter informações sensíveis e críticas protegidas.</span>
              </div>
            </div>
          </section>

          <section id="planos" className="landing-section">
            <div className="section-heading">
              <p className="landing-kicker">Planos</p>
              <h2>Escolha o plano certo para sua etapa de crescimento.</h2>
            </div>
            <div className="pricing-grid">
              {pricingPlans.map((plan) => (
                <div key={plan.name} className={`pricing-card ${plan.featured ? 'featured' : ''}`}>
                  <div className="pricing-head-row">
                    <p className="pricing-label">{plan.name}</p>
                    {plan.featured ? <span className="pricing-badge">Mais escolhido</span> : null}
                  </div>
                  <h3>{plan.price}<small>/mês</small></h3>
                  <p>{plan.description}</p>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      setSelectedPlan(plan.name)
                      setSession(null)
                      setShowLanding(false)
                    }}
                  >
                    {plan.featured ? 'Começar agora' : 'Escolher plano'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="landing-section">
            <div className="section-heading">
              <p className="landing-kicker">FAQ</p>
              <h2>Perguntas frequentes.</h2>
            </div>
            <div className="faq-list">
              {faqItems.map((item) => (
                <div key={item.question} className="faq-item">
                  <strong>{item.question}</strong>
                  <p>{item.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="landing-section">
            <div className="cta-panel">
              <div>
                <p className="landing-kicker">Pronto para evoluir?</p>
                <h2>Transforme sua operação em um motor de crescimento.</h2>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setSelectedPlan('Pro')
                  setSession(null)
                  setShowLanding(false)
                }}
              >
                Começar agora
              </button>
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Entrar</h2>
        <AuthFlow
          initialPlan={selectedPlan}
          onAuthenticated={(nextSession) => {
            enterApp(nextSession)
          }}
          onBackToLanding={goToLanding}
          onPlanSelected={(plan) => {
            setSelectedPlan(plan)
          }}
        />
      </div>
    )
  }

  const renderModule = () => {
    switch (activeModule) {
      case 'customers':
        return <CustomersPage session={session} />
      case 'production':
        return <ProductionPage onNavigateToCustomers={() => setActiveModule('customers')} />
      case 'inventory':
        return <InventoryPage />
      case 'finance':
        return <FinancePage session={session} />
      case 'invoices':
        return <InvoicesPage session={session} />
      case 'reports':
        return <ReportsPage />
      case 'budgets':
        return <BudgetsPage />
      case 'orders':
        return <OrdersPage />
      case 'problems':
        return <ProblemsPage />
      case 'automation':
        return <AutomationPage />
      case 'users':
        return <UsersPage session={session} />
      case 'governance':
        return <GovernancePage />
      case 'dashboard':
      default:
        return <DashboardPage session={session} theme={theme} onThemeToggle={toggleTheme} />
    }
  }

  return (
    <div className="nexo-app" data-theme={theme}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">N</div>
          <div>
            <p className="brand-name">NEXO</p>
            <span>operational intelligence</span>
          </div>
        </div>

        <nav className="nav-section" aria-label="Menu principal">
          {visibleNavigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeModule === item.id ? 'active' : ''}`}
              onClick={() => setActiveModule(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button type="button" className="logout-button" onClick={handleLogout}>
          Logout
        </button>

        <div className="sidebar-card">
          <p className="card-label">Plano ativo</p>
          <div className="plan-badge">{selectedPlan}</div>
          <div className="status-row">
            <span className="dot green" aria-hidden="true" />
            Ambiente limpo
          </div>
          <div className="status-row muted">
            <span className="dot amber" aria-hidden="true" />
            Sem dados exemplo
          </div>
        </div>
      </aside>

      <main className="workspace">{renderModule()}</main>
    </div>
  )
}

export default App
