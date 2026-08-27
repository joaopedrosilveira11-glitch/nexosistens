import { useEffect, useMemo, useState } from "react"
import { getEffectiveRoleValue, navigation } from "../../config/navigation"
import "./EmployeesPage.css"

const API_BASE = 'http://localhost:4000/api'

const defaultEmployees = []

const emptyForm = {
  name: '',
  role: '',
  department: 'Operações',
  email: '',
  password: '',
  phone: '',
  status: 'Ativo',
}

const moduleCatalog = navigation.map((item) => ({ id: item.id, label: item.label }))
const ownerModuleDefaults = Object.fromEntries(moduleCatalog.map((module) => [module.id, true]))

const getDefaultModuleAssignments = (employeeModules = []) => {
  const enabledModules = new Set(
    Array.isArray(employeeModules)
      ? employeeModules.map((moduleId) => String(moduleId).trim()).filter(Boolean)
      : []
  )

  return Object.fromEntries(
    moduleCatalog.map((module) => [module.id, enabledModules.size > 0 ? enabledModules.has(module.id) : true])
  )
}

const normalizeEmployee = (employee = {}) => ({
  id: employee.id || employee._id || 'emp-' + Date.now(),
  name: employee.name || '',
  role: employee.role || '',
  department: employee.department || 'Operações',
  email: employee.email || '',
  phone: employee.phone || '',
  status: employee.status || 'Ativo',
  modules: Array.isArray(employee.modules) ? employee.modules.map((moduleId) => String(moduleId).trim()).filter(Boolean) : [],
})

const getAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: 'Bearer ' + token } : {}),
})

export default function EmployeesPage({ session }) {
  const token = session?.access_token || session?.token || ''
  const isOwner = getEffectiveRoleValue(session?.user) === 'owner'
  const [employees, setEmployees] = useState(defaultEmployees)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [employeeDashboard, setEmployeeDashboard] = useState(null)
  const [employeeDashboardError, setEmployeeDashboardError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [showModuleAssignment, setShowModuleAssignment] = useState(false)
  const [moduleAssignments, setModuleAssignments] = useState(ownerModuleDefaults)
  const [showAccessModal, setShowAccessModal] = useState(false)
  const [createdAccessCode, setCreatedAccessCode] = useState('')
  const [createdFallbackEmail, setCreatedFallbackEmail] = useState('')

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) || employees[0] || null

  useEffect(() => {
    if (!selectedEmployee) {
      setModuleAssignments(ownerModuleDefaults)
      return
    }

    setModuleAssignments(getDefaultModuleAssignments(selectedEmployee.modules))
  }, [selectedEmployee])

  useEffect(() => {
    setEmployeeDashboard(null)
    setEmployeeDashboardError('')
  }, [selectedEmployee])

  useEffect(() => {
    if (!token) return

    const loadEmployeesFromBackend = async () => {
      try {
        const response = await fetch(API_BASE + '/employees', { headers: getAuthHeaders(token) })
        if (!response.ok) throw new Error('Não foi possível carregar funcionários do backend.')
        const payload = await response.json()
        const nextEmployees = (payload.employees || []).map(normalizeEmployee)
        setEmployees(nextEmployees)
        if (nextEmployees.length > 0 && !nextEmployees.some((employee) => employee.id === selectedEmployeeId)) {
          setSelectedEmployeeId(nextEmployees[0].id)
        }
      } catch (error) {
        console.warn('Falha ao carregar funcionários do backend.', error)
        setEmployees([])
      }
    }

    loadEmployeesFromBackend()
  }, [token])

  useEffect(() => {
    if (!token || !selectedEmployee) return

    const loadDashboardFromBackend = async () => {
      try {
        const response = await fetch(API_BASE + '/employees/' + selectedEmployee.id + '/dashboard', { headers: getAuthHeaders(token) })
        if (!response.ok) throw new Error('Não foi possível carregar o painel do funcionário.')
        const payload = await response.json()
        setEmployeeDashboard(payload.dashboard || null)
        setEmployeeDashboardError('')
      } catch (error) {
        console.warn('Falha ao carregar painel do funcionário; não usar fallback local.', error)
        setEmployeeDashboard(null)
        setEmployeeDashboardError('Não foi possível carregar o painel do colaborador. Tente novamente.')
      }
    }

    loadDashboardFromBackend()
  }, [token, selectedEmployee])

  const summary = useMemo(() => {
    const total = employees.length
    const ativos = employees.filter((employee) => employee.status === 'Ativo').length
    const emFerias = employees.filter((employee) => employee.status === 'Em férias').length
    const suspensos = employees.filter((employee) => employee.status === 'Suspenso').length
    return { total, ativos, emFerias, suspensos }
  }, [employees])

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const name = form.name.trim()
    const role = form.role.trim()
    const email = form.email.trim()
    const password = form.password.trim()

    if (!name || !role || !email || password.length < 6) {
      return
    }

    const modules = Object.entries(moduleAssignments).filter(([, enabled]) => Boolean(enabled)).map(([moduleId]) => moduleId)

    const nextEmployee = { name, role, department: form.department, email, phone: form.phone.trim(), status: form.status, modules, password }

    if (token) {
      try {
        const response = await fetch(API_BASE + '/employees', { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ ...nextEmployee, modules }) })
        if (!response.ok) { const text = await response.text().catch(() => ''); throw new Error(text || 'Não foi possível salvar o funcionário no backend.') }

        const payload = await response.json()
        const storedEmployee = normalizeEmployee(payload.employee)
        setEmployees((current) => [storedEmployee, ...current])
        setForm(emptyForm)
        setModuleAssignments(ownerModuleDefaults)
        setShowAddEmployee(false)
        if (payload.accessCode) {
          setCreatedAccessCode(String(payload.accessCode))
          // show the fallback email if backend returned a created user record (auto-generated)
          if (payload.user && payload.user.email) {
            setCreatedFallbackEmail(String(payload.user.email))
          } else {
            setCreatedFallbackEmail('')
          }
          setShowAccessModal(true)
        }
        return
      } catch (error) {
        console.error('Backend de funcionários falhou.', error)
        window.alert(error instanceof Error ? error.message : 'Erro ao criar colaborador')
        return
      }
    }

    window.alert('Sessão inválida para criar colaborador no banco real.')
  }

  const handleModuleToggle = async (moduleId) => {
    const nextAssignments = { ...moduleAssignments, [moduleId]: !moduleAssignments[moduleId] }
    setModuleAssignments(nextAssignments)
    if (!selectedEmployee?.id || !token) return

    try {
      const modules = Object.entries(nextAssignments).filter(([, enabled]) => Boolean(enabled)).map(([key]) => key)
      await fetch(API_BASE + '/employees/' + selectedEmployee.id + '/modules', { method: 'POST', headers: getAuthHeaders(token), body: JSON.stringify({ modules }) })
    } catch (error) {
      console.error('Não foi possível salvar módulos do colaborador no backend.', error)
    }
  }

  const handleSuspendEmployee = async (employeeId) => {
    if (!employeeId || !isOwner) return
    const employeeToSuspend = employees.find((employee) => employee.id === employeeId)
    if (!employeeToSuspend) return
    const confirmed = window.confirm('Suspender o acesso de ' + (employeeToSuspend.name || 'este colaborador') + '? O histórico será mantido, mas o acesso aos módulos será bloqueado.')
    if (!confirmed) return

    const nextEmployees = employees.map((employee) => employee.id === employeeId ? { ...employee, status: 'Suspenso' } : employee)
    setEmployees(nextEmployees)

    if (token) {
      try {
        const response = await fetch(API_BASE + '/employees/' + employeeId, { method: 'DELETE', headers: getAuthHeaders(token) })
        if (!response.ok) throw new Error('Não foi possível suspender o colaborador no backend.')
      } catch (error) {
        console.warn('Não foi possível suspender o colaborador no backend.', error)
        window.alert('Falha ao suspender colaborador no servidor. Verifique a conexão.')
      }
    }

    setSelectedEmployeeId(employeeId)
  }

  const renderStatus = (status) => {
    const normalized = String(status || 'Ativo').trim()
    const classes = { Ativo: 'status-active', 'Em férias': 'status-vacation', Afastado: 'status-absent', 'Em desligamento': 'status-offboarding', Suspenso: 'status-suspended' }
    return (<span className={'employee-status ' + (classes[normalized] || 'status-active')}>{normalized}</span>)
  }

  return (
    <section className="panel employees-page">
      <div className="panel-header employees-page-header">
        <div>
          <p className="panel-kicker">Enterprise</p>
          <h2>Painel do colaborador</h2>
          <p className="employees-page-description">Acesso individual do colaborador no app da operação.</p>
        </div>
      </div>

      {isOwner ? (
        <div className="employees-owner-actions">
          <button type="button" className="secondary-button" onClick={() => setShowModuleAssignment((current) => !current)}>{showModuleAssignment ? 'Fechar acessos' : 'Conceder acesso do colaborador'}</button>
          <button type="button" className="primary-button" onClick={() => setShowAddEmployee(true)}>Adicionar usuário / funcionário</button>
        </div>
      ) : null}

      <div className="employees-summary">
        <div className="employees-summary-card"><span>Total</span><strong>{summary.total}</strong></div>
        <div className="employees-summary-card success"><span>Ativos</span><strong>{summary.ativos}</strong></div>
        <div className="employees-summary-card warning"><span>Em férias</span><strong>{summary.emFerias}</strong></div>
        <div className="employees-summary-card danger"><span>Suspensos</span><strong>{summary.suspensos}</strong></div>
      </div>

      {selectedEmployee ? (
        <div className="employee-dashboard">
          <div className="employee-dashboard-header">
            <div>
              <p className="panel-kicker">Área do colaborador</p>
              <h3>{(employeeDashboard && employeeDashboard.greeting) ? employeeDashboard.greeting : 'Bom dia, ' + (selectedEmployee.name.split(' ')[0] || '') + '.'}</h3>
            </div>
            <label className="employee-picker"><span>Colaborador</span><select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>{employees.map((employee) => (<option key={employee.id} value={employee.id}>{employee.name}</option>))}</select></label>
          </div>
          {employeeDashboardError ? (<div className="employee-dashboard-error"><p>{employeeDashboardError}</p></div>) : null}
          <div className="employee-actions">{isOwner ? (<button className="danger-button" type="button" onClick={() => handleSuspendEmployee(selectedEmployee.id)}>Suspender colaborador</button>) : null}</div>
        </div>
      ) : null}

      {showModuleAssignment ? (
        <div className="employees-form employees-list-wrap">
          <div className="panel-card-header">
            <div>
              <p className="panel-kicker">Acesso por módulo</p>
              <h3>Permissões do colaborador</h3>
            </div>
          </div>

          {selectedEmployee ? (
            <p className="employees-module-hint">Colaborador: <strong>{selectedEmployee.name}</strong></p>
          ) : (
            <p className="employees-module-hint">Selecione um colaborador para definir os módulos.</p>
          )}

          <div className="module-access-grid">
            {moduleCatalog.map((module) => (
              <label key={module.id} className="module-toggle-item">
                <input
                  type="checkbox"
                  checked={Boolean(moduleAssignments[module.id])}
                  onChange={() => handleModuleToggle(module.id)}
                  disabled={!selectedEmployee || !token}
                />
                <span>{module.label}</span>
              </label>
            ))}
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setShowModuleAssignment(false)}>Fechar</button>
          </div>
        </div>
      ) : null}

      {showAddEmployee ? (<div className="modal"><div className="modal-content"><h3>Criar colaborador</h3><form onSubmit={handleSubmit}><label>Nome<input value={form.name} onChange={(e) => handleChange('name', e.target.value)} /></label><label>Papel<input value={form.role} onChange={(e) => handleChange('role', e.target.value)} /></label><label>Email<input value={form.email} onChange={(e) => handleChange('email', e.target.value)} /></label><label>Telefone<input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} /></label><label>Senha<input type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} /></label><div className="modal-actions"><button type="submit" className="primary-button">Criar</button><button type="button" className="secondary-button" onClick={() => setShowAddEmployee(false)}>Cancelar</button></div></form></div></div>) : null}

      {showAccessModal ? (
          <div className="modal">
            <div className="modal-content">
              <h3>Código de acesso gerado</h3>
              <p>Compartilhe este código com o colaborador para que ele realize o login inicial:</p>
              <pre className="access-code">{createdAccessCode}</pre>

              {createdFallbackEmail ? (
                <div style={{ marginTop: '0.75rem' }}>
                  <p><strong>E-mail temporário gerado:</strong> {createdFallbackEmail}</p>
                  <p style={{ fontSize: '0.9rem', color: '#444' }}>Observação: este e-mail foi criado automaticamente pelo sistema pois nenhum e-mail foi informado. Recomendamos que atualize o perfil do colaborador com um e-mail real para que ele possa recuperar a senha ou receber notificações.</p>
                </div>
              ) : null}

              <div className="modal-actions">
                <button type="button" className="primary-button" onClick={() => { navigator.clipboard?.writeText(createdAccessCode); alert('Código copiado'); }}>Copiar</button>
                <button type="button" className="secondary-button" onClick={() => { setShowAccessModal(false); setCreatedAccessCode(''); setCreatedFallbackEmail(''); }}>Fechar</button>
              </div>
            </div>
          </div>
        ) : null}

    </section>
  )
}
