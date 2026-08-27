import { useEffect, useState } from 'react'
import { getEffectiveRoleValue } from '../../config/navigation'
import { supabase } from '../../lib/supabase'
import './UsersPage.css'
import EmployeesPage from '../employees/EmployeesPage'

const backendUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000') + '/api'

const generateAccessCode = () => {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `NEXO-${randomPart}`
}

const statusLabel = {
  active: 'Ativo',
  inactive: 'Inativo',
  invited: 'Convidado',
}

const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  role: 'Operador',
  status: 'active',
}

const normalizeUser = (user = {}, fallbackRole = 'Operador') => {
  const firstName = user.first_name || ''
  const lastName = user.last_name || ''
  const accessCode = user.access_code || user.accessCode || `NEXO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const email = `${accessCode.toLowerCase()}@nexo.local`
  const membership = user.memberships?.[0]
  const role = user.role || membership?.roles?.name || fallbackRole
  const status = user.status || membership?.status || 'active'

  return {
    id: user.id || `local-user-${Date.now()}`,
    first_name: firstName,
    last_name: lastName,
    email,
    role,
    status,
    access_code: accessCode,
    accessCode,
    created_at: user.created_at || new Date().toISOString(),
    department: user.department || 'Operações',
    memberships: Array.isArray(user.memberships) && user.memberships.length > 0
      ? user.memberships
      : [{ status, roles: { name: role, slug: role.toLowerCase().replace(/\s+/g, '-') } }],
  }
}

export default function UsersPage({ session }) {
  const isOwner = getEffectiveRoleValue(session?.user) === 'owner'
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [isLoading, setIsLoading] = useState(() => Boolean(supabase))
  const [error, setError] = useState(() => (supabase ? '' : 'O Supabase não está configurado neste ambiente.'))
  const [generatedCode, setGeneratedCode] = useState('')
  const [generatedFallbackEmail, setGeneratedFallbackEmail] = useState('')
  const [showGeneratedModal, setShowGeneratedModal] = useState(false)
  const [showEmployeesPanel, setShowEmployeesPanel] = useState(false)

  const syncEmployeeToBackend = async (nextUser) => {
    if (typeof window === 'undefined' || !nextUser?.access_code) return

    const token = session?.access_token || session?.token || ''
    if (!token) return

    try {
      const accessCodePayload = {
        access_code: nextUser.access_code,
        first_name: nextUser.first_name || 'Colaborador',
        last_name: nextUser.last_name || '',
        role: nextUser.role || 'Operador',
        status: nextUser.status || 'active',
      }

      const accessResponse = await fetch(`${backendUrl}/users/access-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(accessCodePayload),
      })

      if (!accessResponse.ok) {
        const accessErrorPayload = await accessResponse.json().catch(() => ({}))
        throw new Error(accessErrorPayload.error || 'Não foi possível salvar o código de acesso do usuário no backend.')
      }

      const employeePayload = {
        name: `${nextUser.first_name || ''} ${nextUser.last_name || ''}`.trim() || nextUser.email,
        role: nextUser.role || 'Operador',
        department: nextUser.department || 'Operações',
        email: nextUser.email,
        phone: '',
        status: nextUser.status === 'inactive' ? 'Afastado' : nextUser.status === 'invited' ? 'Em desligamento' : 'Ativo',
      }

      const response = await fetch(`${backendUrl}/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(employeePayload),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(errorPayload.error || 'Não foi possível salvar o funcionário no backend.')
      }

      const payload = await response.json().catch(() => ({}))
      if (payload.employee) {
        syncEmployeeFromUser({
          ...nextUser,
          id: payload.employee.id,
          status: nextUser.status || 'active',
          department: payload.employee.department || nextUser.department || 'Operações',
        })
      }
    } catch (error) {
      console.warn('Backend de funcionários indisponível; mantemos o fallback local.', error)
    }
  }

  const loadUsers = async () => {
      setIsLoading(true)
      setError('')

      const token = session?.access_token || session?.token || ''
      if (!token) {
        setError('Sessão inválida: não é possível carregar usuários sem autenticação.')
        setUsers([])
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`${backendUrl}/users`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          setError(err.error || 'Não foi possível carregar os usuários.')
          setUsers([])
          setIsLoading(false)
          return
        }

        const payload = await response.json().catch(() => ({ users: [] }))
        const nextUsers = (payload.users || []).map((user) => normalizeUser(user, 'Operador'))
        setUsers(nextUsers)
        setIsLoading(false)
      } catch (error) {
        console.error('Erro ao carregar usuários do backend', error)
        setError('Erro ao carregar usuários. Verifique a conexão.')
        setUsers([])
        setIsLoading(false)
      }
    }

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      setError('O Supabase real não está configurado neste ambiente.')
      setUsers([])
      return undefined
    }

    const timer = window.setTimeout(loadUsers, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

      const firstName = form.first_name.trim()
    const lastName = form.last_name.trim()
      const email = (form.email || '').trim().toLowerCase()

      if (!firstName || !email || !email.includes('@')) {
        window.alert('Por favor informe o nome e um e-mail válido para o colaborador.')
        return
      }

      const token = session?.access_token || session?.token || ''
      if (!token) {
        window.alert('Sessão inválida: não é possível criar colaborador sem autenticação.')
        return
      }

      try {
        const payloadBody = {
          name: `${firstName} ${lastName}`.trim(),
          role: form.role || 'Operador',
          department: 'Operações',
          email,
          status: form.status === 'inactive' ? 'Afastado' : form.status === 'invited' ? 'Em desligamento' : 'Ativo',
        }

        const response = await fetch(`${backendUrl}/employees`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify(payloadBody),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.error || 'Não foi possível criar colaborador no backend.')
        }

        const result = await response.json().catch(() => ({}))

        // reload canonical list from Supabase (real DB) to avoid any local residuals
        await loadUsers()

        // show the generated access code to the owner
        if (result.accessCode) {
          setGeneratedCode(result.accessCode)
          // show possible fallback email returned by backend
          if (result.user && result.user.email) {
            setGeneratedFallbackEmail(String(result.user.email))
          } else {
            setGeneratedFallbackEmail('')
          }
          setShowGeneratedModal(true)
        }

        setForm(emptyForm)
      } catch (error) {
        console.error('Erro criando colaborador no backend', error)
        window.alert(error instanceof Error ? error.message : 'Erro ao criar colaborador')
      }
    }

  return (
    <section className="panel users-page">
      <div className="panel-header users-page-header">
        <div>
          <p className="panel-kicker">Administração</p>
          <h2>Usuários e acessos</h2>
          <p className="users-page-description">Cadastre colaboradores, usuários e permissões do negócio a partir desta aba.</p>
        </div>
        {isOwner ? (
          <button type="button" className="ghost-button" onClick={loadUsers} disabled={isLoading}>
            {isLoading ? 'Atualizando...' : 'Atualizar'}
          </button>
        ) : null}
      </div>

      {isOwner ? (
      <div>
        <form className="users-insert-form" onSubmit={handleSubmit}>
          <div className="users-form-grid">
            <label className="auth-field">
              <span>Nome</span>
              <input value={form.first_name} onChange={(event) => handleChange('first_name', event.target.value)} placeholder="Ex: João" />
            </label>
            <label className="auth-field">
              <span>Sobrenome</span>
              <input value={form.last_name} onChange={(event) => handleChange('last_name', event.target.value)} placeholder="Ex: Silva" />
            </label>
            <label className="auth-field">
              <span>E-mail</span>
              <input value={form.email} onChange={(event) => handleChange('email', event.target.value)} placeholder="ex: colaborador@empresa.com" />
            </label>
            <label className="auth-field full-width">
              <span>Função</span>
              <input value={form.role} onChange={(event) => handleChange('role', event.target.value)} placeholder="Operador" />
            </label>
            <label className="auth-field">
              <span>Status</span>
              <select value={form.status} onChange={(event) => handleChange('status', event.target.value)}>
                <option value="active">Ativo</option>
                <option value="invited">Convidado</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="submit" className="primary-button">Criar acesso do colaborador</button>
            <button type="button" className="secondary-button" onClick={() => setShowEmployeesPanel((s) => !s)}>{showEmployeesPanel ? 'Fechar painel de colaboradores' : 'Abrir painel de colaboradores'}</button>
          </div>

          {generatedCode ? (
            <div className="user-access-message" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span>Código gerado:</span>
              <strong className="user-access-code">{generatedCode}</strong>
            </div>
          ) : null}

          {showGeneratedModal ? (
            <div className="modal">
              <div className="modal-content">
                <h3>Código de acesso gerado</h3>
                <p>Compartilhe este código com o colaborador para que ele realize o login inicial:</p>
                <pre className="access-code">{generatedCode}</pre>
                {generatedFallbackEmail ? (
                  <div style={{ marginTop: '0.75rem' }}>
                    <p><strong>E-mail temporário gerado:</strong> {generatedFallbackEmail}</p>
                    <p style={{ fontSize: '0.9rem', color: '#444' }}>Observação: este e-mail foi criado automaticamente pelo sistema pois nenhum e-mail foi informado. Recomendamos que atualize o perfil do colaborador com um e-mail real para que ele possa recuperar a senha ou receber notificações.</p>
                  </div>
                ) : null}
                <div className="modal-actions">
                  <button type="button" className="primary-button" onClick={() => { navigator.clipboard?.writeText(generatedCode); alert('Código copiado'); }}>Copiar</button>
                  <button type="button" className="secondary-button" onClick={() => { setShowGeneratedModal(false); setGeneratedCode(''); setGeneratedFallbackEmail(''); }}>Fechar</button>
                </div>
              </div>
            </div>
          ) : null}

          {showEmployeesPanel ? (
            <div style={{ marginTop: '1rem' }}>
              <EmployeesPage session={session} />
            </div>
          ) : null}
        </form>
      </div>
      ) : (
        <div className="global-status info">
          <span className="global-status-dot" aria-hidden="true" />
          Apenas o proprietário pode cadastrar novos usuários e gerenciar acessos.
        </div>
      )}

      {isOwner ? generatedCode ? <p className="user-access-message">Último código gerado: <span className="user-access-code">{generatedCode}</span></p> : null : null}
      {error ? <p className="users-page-message error">{error}</p> : null}
      {!error && isLoading ? <p className="users-page-message">Carregando usuários...</p> : null}
      {!error && !isLoading && users.length === 0 ? <p className="users-page-message">Nenhum usuário cadastrado nesta empresa.</p> : null}

      {!error && !isLoading && users.length > 0 ? (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Função</th>
                <th>Status</th>
                <th>Código</th>
                <th>Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const memberRole = user.role || user.memberships?.[0]?.roles?.name || 'Sem função'
                const status = user.status || user.memberships?.[0]?.status || 'active'
                const accessCode = user.access_code || user.accessCode || 'â€”'
                const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || accessCode
                return (
                  <tr key={user.id}>
                    <td><strong>{name}</strong></td>
                    <td>{memberRole}</td>
                    <td><span className={`user-status ${status}`}>{statusLabel[status] || status}</span></td>
                    <td><span className="user-access-code compact">{accessCode}</span></td>
                    <td>{user.created_at ? new Intl.DateTimeFormat('pt-BR').format(new Date(user.created_at)) : 'â€”'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}


