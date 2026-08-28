import { useEffect, useMemo, useState } from 'react'
import { getDefaultModulesForRole } from '../config/navigation'
import { getApiBaseUrl } from '../lib/api.js'
import { supabase, syncTenantProfile } from '../lib/supabase'

const backendUrl = getApiBaseUrl() + '/api'

const defaultForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  companyName: '',
  segment: '',
  employees: '',
  objectives: '',
  setup: '',
  accessCode: '',
}

const segmentOptions = ['Industrial', 'Serviços', 'Comercial', 'Logística', 'Tecnologia', 'Distribuição']
const employeeOptions = ['1-20', '21-50', '51-100', '101-250', '251-500', '500+']
const onboardingSteps = [
  { id: 'company', label: 'Empresa' },
  { id: 'segment', label: 'Segmento' },
  { id: 'employees', label: 'Painel do colaborador' },
  { id: 'objectives', label: 'Objetivos' },
  { id: 'setup', label: 'Configuração' },
  { id: 'plan', label: 'Plano' },
]

const subscriptionPlans = [
  { name: 'Starter', monthly: 79, annual: 790, description: 'Dashboard, clientes e estoque com relatórios essenciais.', highlight: false },
  { name: 'Growth', monthly: 149, annual: 1490, description: 'Clientes, estoque, produção e automação operacional.', highlight: false },
  { name: 'Pro', monthly: 249, annual: 2490, description: 'Tudo do Growth com usuários, IA operacional e suporte prioritário.', highlight: true },
  { name: 'Enterprise', monthly: 0, annual: 0, description: 'Governança completa, SLA e apoio estratégico.', highlight: false },
]

const paymentOptions = [
  { id: 'card', label: 'Cartão de crédito', description: 'Pagamento instantâneo e seguro', icon: 'card' },
  { id: 'pix', label: 'Pix', description: 'Confirmação imediata', icon: 'pix' },
  { id: 'boleto', label: 'Boleto', description: 'Pagamento por vencimento', icon: 'boleto' },
]

const getFriendlyAuthError = (error) => {
  const message = typeof error === 'string' ? error : error?.message || ''

  if (!message) {
    return 'Não foi possível concluir a operação. Tente novamente em alguns minutos.'
  }

  const normalized = message.toLowerCase()

  if (normalized.includes('email rate limit exceeded') || normalized.includes('rate limit exceeded') || normalized.includes('too many requests')) {
    return 'Muitas tentativas de criação de conta. Aguarde alguns minutos e tente novamente.'
  }

  if (normalized.includes('already registered') || normalized.includes('user already registered')) {
    return 'Este e-mail já está em uso. Faça login ou recupere sua senha.'
  }

  return message
}

function PaymentIcon({ type }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }

  if (type === 'pix') {
    return (
      <svg {...commonProps}>
        <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
        <path d="M8 10.5h8M8 13.5h5.5" />
        <path d="M15.5 8.5V7.2a1.7 1.7 0 0 1 1.7-1.7h.3" />
      </svg>
    )
  }

  if (type === 'boleto') {
    return (
      <svg {...commonProps}>
        <path d="M7 7.5h10M7 11.5h10M7 15.5h7" />
        <path d="M5.5 18.5h13a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5h-13A1.5 1.5 0 0 0 4 7v10a1.5 1.5 0 0 0 1.5 1.5Z" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <rect x="3.5" y="6.5" width="17" height="11" rx="2.5" />
      <path d="M3.5 10.5h17" />
      <path d="M7.5 14.5h3" />
    </svg>
  )
}

function AuthFlow({ initialPlan = 'Pro', onAuthenticated, onBackToLanding, onPlanSelected }) {
  const [view, setView] = useState('login')
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(defaultForm)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(initialPlan)

  useEffect(() => {
    setSelectedPlan(initialPlan)
  }, [initialPlan])
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [cardForm, setCardForm] = useState({
    name: '',
    number: '',
    expiry: '',
    cvv: '',
  })
  const [twoFactorFactorId, setTwoFactorFactorId] = useState('')
  const [twoFactorSecret, setTwoFactorSecret] = useState('')
  const [twoFactorQrCode, setTwoFactorQrCode] = useState('')
  const [twoFactorInput, setTwoFactorInput] = useState('')
  const [mfaPendingSession, setMfaPendingSession] = useState(null)

  const progress = useMemo(() => ((step + 1) / onboardingSteps.length) * 100, [step])

  useEffect(() => {
    setMessage('')
    setForm(defaultForm)
  }, [view])

  const handleFieldChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const prepareTwoFactorFlow = async (forceEnrollment = false) => {
    if (!supabase) {
      setMessage('O 2FA real exige a configuração do Supabase neste ambiente.')
      return null
    }

    try {
      const { data: factorsData, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) {
        throw listError
      }

      const totpFactors = factorsData?.totp ?? []
      if (totpFactors.length > 0 && !forceEnrollment) {
        setTwoFactorFactorId(totpFactors[0].id)
        setTwoFactorSecret(totpFactors[0].secret || '')
        setTwoFactorQrCode('')
        setMessage('Autenticador já configurado. Use o código do app para continuar.')
        return totpFactors[0].id
      }

      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'NEXO Authenticator',
        issuer: 'NEXO',
      })

      if (enrollError) {
        throw enrollError
      }

      const nextFactorId = enrollData?.id ?? ''
      const nextSecret = enrollData?.totp?.secret ?? ''
      const nextQrCode = enrollData?.totp?.qr_code ?? ''

      setTwoFactorFactorId(nextFactorId)
      setTwoFactorSecret(nextSecret)
      setTwoFactorQrCode(nextQrCode)
      setMessage('Escaneie o QR code com seu autenticador ou use a chave secreta para confirmar o 2FA.')
      return nextFactorId
    } catch (error) {
      const errorMessage = error?.message || 'Não foi possível configurar o 2FA com o Supabase.'
      setMessage(errorMessage)
      return null
    }
  }

  const handleTwoFactorValidation = async () => {
    if (!supabase) {
      setMessage('O 2FA real exige a configuração do Supabase neste ambiente.')
      return
    }

    const cleanedCode = twoFactorInput.trim()
    if (!/^[0-9]{6}$/.test(cleanedCode)) {
      setMessage('Digite um código de 6 dígitos para validar o 2FA.')
      return
    }

    let factorId = twoFactorFactorId
    if (!factorId) {
      factorId = await prepareTwoFactorFlow(Boolean(mfaPendingSession))
    }

    if (!factorId) {
      return
    }

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError) {
        throw challengeError
      }

      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: cleanedCode,
      })

      if (error) {
        throw error
      }

      if (data?.access_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
      }

      setMessage('2FA validado com sucesso.')
      setTwoFactorInput('')
      setTwoFactorFactorId('')
      setTwoFactorSecret('')
      setTwoFactorQrCode('')
      const nextUser = await supabase.auth.getUser()
      const payload = mfaPendingSession || {
        user: {
          id: nextUser?.data?.user?.id || 'supabase-mfa-user',
          email: nextUser?.data?.user?.email || form.email.trim() || 'usuario@nexo.com',
          name: form.name || 'Usuário NEXO',
          role: 'owner',
          company: form.companyName || 'Empresa NEXO',
          emailVerified: true,
          twoFactorEnabled: true,
          devices: ['Supabase · Web'],
        },
        token: (await supabase.auth.getSession())?.data?.session?.access_token || 'supabase-mfa-session',
      }

      setMfaPendingSession(null)
      setView('login')
      onAuthenticated(payload)
    } catch (error) {
      const errorMessage = error?.message || 'Código 2FA inválido ou expirado.'
      setMessage(errorMessage)
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(`${backendUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.token) {
        setForm((current) => ({ ...current, email: '', password: '' }))
        setMessage(payload?.error || 'Credenciais inválidas.')
        setIsLoading(false)
        return
      }

      const user = payload.user || {}
      const normalizedRole = String(user.role || 'owner').trim().toLowerCase() === 'proprietario' ? 'owner' : String(user.role || 'owner').trim().toLowerCase()
      const resolvedModules = Array.isArray(user.modules) && user.modules.length > 0
        ? user.modules
        : getDefaultModulesForRole(normalizedRole)
      const sessionPayload = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name || user.email?.split('@')[0] || 'Usuário',
          role: normalizedRole,
          company: user.company || 'Empresa NEXO',
          companyId: user.companyId,
          emailVerified: Boolean(user.emailVerified),
          twoFactorEnabled: Boolean(user.twoFactorEnabled),
          devices: ['Supabase · Web'],
          plan: user.plan || selectedPlan,
          modules: resolvedModules,
        },
        token: payload.token,
      }

      setIsLoading(false)
      onAuthenticated?.(sessionPayload)
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível entrar no sistema.'
      setMessage(message)
      setIsLoading(false)
    }

    setIsLoading(false)
  }

  const handleAccessCodeLogin = async (event) => {
    event.preventDefault()
    const accessCode = form.accessCode.trim().toUpperCase()

    if (!accessCode) {
      setMessage('Digite o código de acesso do colaborador.')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(`${backendUrl}/users/mobile/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_code: accessCode }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.token) {
        throw new Error(payload?.message || payload?.error || 'Código de acesso inválido ou não encontrado.')
      }

      const userData = payload.user || {}
      const fullName = [userData.first_name, userData.last_name].filter(Boolean).join(' ').trim() || 'Colaborador NEXO'
      const sessionPayload = {
        user: {
          id: userData.id || `mobile-${accessCode}`,
          email: userData.email || `${accessCode.toLowerCase()}@nexo.local`,
          name: fullName,
          role: userData.role || 'employee',
          company: userData.company || 'Empresa NEXO',
          emailVerified: true,
          twoFactorEnabled: false,
          devices: ['App Mobile'],
          plan: userData.plan || 'Enterprise',
          accessCode,
        },
        token: payload.token,
      }

      setForm((current) => ({ ...current, accessCode: '' }))
      setIsLoading(false)
      onAuthenticated?.(sessionPayload)
    } catch (error) {
      setMessage(error.message || 'Não foi possível entrar com o código de acesso.')
      setIsLoading(false)
    }
  }

  const handleSignup = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setMessage('')

    if (form.password.length < 8) {
      setMessage('A senha precisa ter pelo menos 8 caracteres.')
      setIsLoading(false)
      return
    }

    if (form.password !== form.confirmPassword) {
      setMessage('As senhas não conferem.')
      setIsLoading(false)
      return
    }

    if (supabase) {
      const defaultOwnerModules = getDefaultModulesForRole('owner')
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            full_name: form.name,
            company: form.companyName,
            role: 'owner',
            modules: defaultOwnerModules,
          },
        },
      })

      if (error) {
        setMessage(getFriendlyAuthError(error))
        setIsLoading(false)
        return
      }

      const createdUser = data?.user ?? data?.session?.user

      if (createdUser) {
        try {
          await syncTenantProfile({
            companyName: form.companyName,
            fullName: form.name,
            email: form.email.trim(),
            authUserId: createdUser.id,
            plan: selectedPlan,
            role: 'owner',
            modules: getDefaultModulesForRole('owner'),
          })
        } catch (syncError) {
          setMessage(syncError.message || 'Conta criada, mas houve erro ao registrar a empresa no banco.')
          setIsLoading(false)
          return
        }
      }

      const successMessage = data?.session
        ? 'Cadastro realizado. Verifique seu e-mail para confirmar sua conta.'
        : 'Conta criada com sucesso. Continue pelo e-mail de confirmação para concluir o acesso.'

      setMessage(successMessage)
      setIsLoading(false)
      setView('onboarding')
      setStep(0)
      return
    }

    setMessage('O cadastro exige a configuração do Supabase neste ambiente.')
    setIsLoading(false)
  }

  const getPlanPrice = (planName) => {
    const selected = subscriptionPlans.find((plan) => plan.name === planName)
    if (!selected) return 'R$ 0'
    if (selected.name === 'Enterprise') return 'Personalizado'
    return billingCycle === 'annual' ? `R$ ${selected.annual.toLocaleString('pt-BR')}` : `R$ ${selected.monthly.toLocaleString('pt-BR')}`
  }

  const getPlanPriceNumber = (planName) => {
    const selected = subscriptionPlans.find((plan) => plan.name === planName)
    if (!selected || selected.name === 'Enterprise') return 0
    return billingCycle === 'annual' ? selected.annual : selected.monthly
  }

  const selectedPlanDetails = subscriptionPlans.find((plan) => plan.name === selectedPlan) || subscriptionPlans[0]
  const annualSavings = selectedPlanDetails.name !== 'Enterprise' && billingCycle === 'annual'
    ? (selectedPlanDetails.monthly * 12) - selectedPlanDetails.annual
    : 0

  const handleFinalSubmit = () => {
    if (paymentMethod === 'card') {
      const missingFields = [
        !cardForm.name?.trim(),
        !cardForm.number?.trim(),
        !cardForm.expiry?.trim(),
        !cardForm.cvv?.trim(),
      ].some(Boolean)

      if (missingFields) {
        setMessage('Preencha os dados do cartão para confirmar a assinatura.')
        return
      }
    }

    onPlanSelected?.(selectedPlan)
    setView('login')
    setMessage(`Assinatura ${selectedPlan} confirmada no ciclo ${billingCycle === 'annual' ? 'anual' : 'mensal'}. Acesso liberado após validação do pagamento.`)
  }

  const goToNextStep = () => {
    if (step < onboardingSteps.length - 1) {
      setStep((current) => current + 1)
      return
    }

    handleFinalSubmit()
  }

  const renderField = (label, value, onChange, placeholder, type = 'text', autoComplete = 'off') => {
    // Use a randomized name for the input to reduce chances of browser autofill matching saved credentials.
    const randomName = `${label.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 8)}`
    return (
      <label className="auth-field">
        <span>{label}</span>
        <input
          name={randomName}
          type={type}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck={false}
        />
      </label>
    )
  }

  if (view === 'login') {
    return (
      <div className="auth-shell">
        <div className="auth-panel">
          <div className="auth-visual">
            <div className="auth-brand auth-brand-large">
              <div className="brand-mark">N</div>
              <div>
                <p>NEXO</p>
                <span>operational intelligence</span>
              </div>
            </div>

            <div className="auth-visual-copy">
              <p className="eyebrow eyebrow-light">A inteligência que conecta sua empresa</p>
              <h1>Controle operacional em tempo real.</h1>
              <p className="auth-visual-text">
                Centralize pessoas, vendas, estoque, produção e decisões em uma plataforma feita para operar com clareza.
              </p>
            </div>

          </div>

          <div className="auth-card auth-card-small">
            <div className="auth-header-stack">
              <p className="auth-kicker">Acesso seguro</p>
              <h2>Entrar no NEXO</h2>
            </div>

            <form onSubmit={handleLogin} className="auth-form">
              {renderField('E-mail', form.email, (value) => handleFieldChange('email', value), 'seu@email.com', 'email', 'username')}
              {renderField('Senha', form.password, (value) => handleFieldChange('password', value), '••••••••', 'password', 'new-password')}
              {renderField('Código de acesso', form.accessCode, (value) => handleFieldChange('accessCode', value), 'NEXO-XXXXXX', 'text', 'off')}

              <div className="auth-actions-row auth-actions-row-split">
                <button type="submit" className="primary-button" disabled={isLoading}>
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </button>
                <button type="button" className="ghost-button" onClick={handleAccessCodeLogin} disabled={isLoading}>
                  Código mobile
                </button>
              </div>

              <button type="button" className="ghost-button full-width-button" onClick={() => setView('recover')}>
                Recuperar senha
              </button>

              {message ? <p className="auth-message">{message}</p> : null}
            </form>

            <div className="auth-footer-links">
              <button type="button" className="link-button" onClick={() => onBackToLanding?.()}>Voltar ao início</button>
              <button type="button" className="link-button" onClick={() => setView('signup')}>Criar conta</button>
              <button type="button" className="link-button" onClick={() => setView('2fa')}>2FA</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'signup') {
    return (
      <div className="auth-shell">
        <div className="auth-panel auth-panel-signup">
          <div className="auth-visual">
            <div className="auth-brand auth-brand-large">
              <div className="brand-mark">N</div>
              <div>
                <p>NEXO</p>
                <span>crie sua conta</span>
              </div>
            </div>

            <div className="auth-visual-copy">
              <p className="eyebrow eyebrow-light">Comece com clareza</p>
              <h1>Construa sua operação com inteligência.</h1>
              <p className="auth-visual-text">
                Configure sua empresa, conecte os principais processos e acelere a operação com visibilidade em tempo real.
              </p>
            </div>

            <div className="auth-metrics">
              <div>
                <strong>1 min</strong>
                <span>setup</span>
              </div>
              <div>
                <strong>3x</strong>
                <span>agilidade</span>
              </div>
              <div>
                <strong>100%</strong>
                <span>visibilidade</span>
              </div>
            </div>
          </div>

          <div className="auth-card auth-card-signup">
            <div className="auth-header-stack">
              <p className="auth-kicker">Cadastre-se</p>
              <h2>Criar conta</h2>
            </div>

            <form onSubmit={handleSignup} className="auth-form">
              {renderField('Nome', form.name, (value) => handleFieldChange('name', value), 'Seu nome completo')}
              {renderField('E-mail', form.email, (value) => handleFieldChange('email', value), 'nome@empresa.com', 'email', 'username')}
              {renderField('Senha', form.password, (value) => handleFieldChange('password', value), 'Mínimo 8 caracteres', 'password', 'new-password')}
              {renderField('Confirmar senha', form.confirmPassword, (value) => handleFieldChange('confirmPassword', value), 'Repita a senha', 'password', 'new-password')}

              <div className="auth-actions-row">
                <button type="submit" className="primary-button" disabled={isLoading}>
                  {isLoading ? 'Criando conta...' : 'Criar conta'}
                </button>
                <button type="button" className="ghost-button" onClick={() => setView('login')}>Voltar</button>
              </div>

              {message ? <p className="auth-message">{message}</p> : null}
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'recover') {
    return (
      <div className="auth-shell">
        <div className="auth-card auth-card-small">
          <div className="auth-brand">
            <div className="brand-mark">N</div>
            <div>
              <p>NEXO</p>
              <span>Recuperar senha</span>
            </div>
          </div>

          <h1>Recuperar acesso</h1>
          <div className="auth-form">
            {renderField('E-mail', form.email, (value) => handleFieldChange('email', value), 'seu@email.com', 'email', 'username')}
            <button type="button" className="primary-button" onClick={() => {
              setForm((current) => ({ ...current, email: '', password: '' }))
              setMessage('Link de recuperação enviado para o seu e-mail.')
            }}>Enviar link</button>
            {message ? <p className="auth-message">{message}</p> : null}
            <button type="button" className="ghost-button" onClick={() => setView('login')}>Voltar</button>
          </div>
        </div>
      </div>
    )
  }

  if (view === '2fa') {
    return (
      <div className="auth-shell">
        <div className="auth-card auth-card-small">
          <div className="auth-brand">
            <div className="brand-mark">N</div>
            <div>
              <p>NEXO</p>
              <span>2FA</span>
            </div>
          </div>

          <h1>Autenticação de dois fatores</h1>
          <p className="auth-subtitle">Use o código do seu autenticador para validar a sessão.</p>

          {twoFactorQrCode ? (
            <div className="two-factor-box">
              <img src={twoFactorQrCode} alt="QR code do autenticador" className="two-factor-qr" />
              <small>Escaneie o QR code ou use a chave secreta abaixo.</small>
            </div>
          ) : null}

          {twoFactorSecret ? (
            <div className="two-factor-secret-box">
              <span>Chave secreta</span>
              <strong>{twoFactorSecret}</strong>
            </div>
          ) : null}

          <label className="auth-field">
            <span>Código de 6 dígitos</span>
            <input
              type="text"
              className="code-input"
              placeholder="123456"
              maxLength={6}
              inputMode="numeric"
              value={twoFactorInput}
              onChange={(event) => setTwoFactorInput(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </label>

          <div className="auth-actions-row">
            <button type="button" className="primary-button" onClick={handleTwoFactorValidation}>
              Validar
            </button>
            <button type="button" className="ghost-button" onClick={() => { setTwoFactorInput(''); setView('login') }}>Cancelar</button>
          </div>

          {message ? <p className="auth-message">{message}</p> : null}
        </div>
      </div>
    )
  }

  if (view === 'onboarding') {
    return (
      <div className="auth-shell onboarding-shell">
        <div className="auth-card wide-card">
          <div className="steps-header">
            <div>
              <p className="eyebrow">Onboarding</p>
              <h1>Configure sua empresa</h1>
            </div>
            <div className="stepper">
              {onboardingSteps.map((stepItem, index) => (
                <span key={stepItem.id} className={index === step ? 'step active' : 'step'}>{index + 1}</span>
              ))}
            </div>
          </div>

          <div className="progress-bar">
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="onboarding-panel">
            {step === 0 && (
              <>
                <h2>Etapa 1 · Nome da empresa</h2>
                {renderField('Nome da empresa', form.companyName, (value) => handleFieldChange('companyName', value), 'Ex: NEXO Industrial')}
              </>
            )}

            {step === 1 && (
              <>
                <h2>Etapa 2 · Segmento</h2>
                <div className="choice-grid">
                  {segmentOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={form.segment === option ? 'choice selected' : 'choice'}
                      onClick={() => handleFieldChange('segment', option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2>Etapa 3 · Quantidade aproximada de colaboradores</h2>
                <div className="choice-grid">
                  {employeeOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={form.employees === option ? 'choice selected' : 'choice'}
                      onClick={() => handleFieldChange('employees', option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2>Etapa 4 · Objetivos principais</h2>
                <label className="auth-field">
                  <span>Descreva seus principais objetivos</span>
                  <textarea
                    value={form.objectives}
                    onChange={(event) => handleFieldChange('objectives', event.target.value)}
                    placeholder="Ex: reduzir atrasos de entrega, melhorar controle de estoque e aumentar previsibilidade financeira."
                  />
                </label>
              </>
            )}

            {step === 4 && (
              <>
                <h2>Etapa 5 · Configuração inicial</h2>
                <label className="auth-field">
                  <span>Configuração inicial</span>
                  <textarea
                    value={form.setup}
                    onChange={(event) => handleFieldChange('setup', event.target.value)}
                  />
                </label>
              </>
            )}

            {step === 5 && (
              <>
                <h2>Etapa 6 · Assinatura e pagamento</h2>

                <div className="billing-toggle" aria-label="Ciclo de cobrança">
                  <button
                    type="button"
                    className={billingCycle === 'monthly' ? 'billing-pill active' : 'billing-pill'}
                    onClick={() => setBillingCycle('monthly')}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    className={billingCycle === 'annual' ? 'billing-pill active' : 'billing-pill'}
                    onClick={() => setBillingCycle('annual')}
                  >
                    Anual
                  </button>
                </div>

                <div className="choice-grid plan-grid">
                  {subscriptionPlans.map((plan) => (
                    <button
                      key={plan.name}
                      type="button"
                     className={(selectedPlan === plan.name ? 'choice selected' : 'choice') + ' plan-option'}
                      onClick={() => setSelectedPlan(plan.name)}
                    >
                      <strong>{plan.name}</strong>
                      <span>{plan.name === 'Enterprise' ? 'Personalizado' : billingCycle === 'annual' ? `R$ ${plan.annual.toLocaleString('pt-BR')}` : `R$ ${plan.monthly.toLocaleString('pt-BR')}`}</span>
                      <small>{plan.description}</small>
                    </button>
                  ))}
                </div>

                <div className="payment-box">
                 <div className="payment-box-header">
                   <p className="auth-subtitle">Forma de pagamento</p>
                   <span className="checkout-chip">Pagamento seguro</span>
                 </div>

                 <div className="payment-layout">
                   <div className="payment-methods-area">
                     <div className="choice-grid payment-grid">
                       {paymentOptions.map((option) => (
                         <button
                           key={option.id}
                           type="button"
                           className={paymentMethod === option.id ? 'choice payment-choice selected' : 'choice payment-choice'}
                           onClick={() => setPaymentMethod(option.id)}
                         >
                           <span className="payment-icon-wrap"><PaymentIcon type={option.icon} /></span>
                           <span className="payment-choice-copy">
                             <span>{option.label}</span>
                             <small>{option.description}</small>
                           </span>
                         </button>
                       ))}
                     </div>

                     {paymentMethod === 'card' && (
                       <div className="payment-form">
                         <label className="auth-field">
                           <span>Nome no cartão</span>
                           <input
                             type="text"
                             value={cardForm.name}
                             onChange={(event) => setCardForm((current) => ({ ...current, name: event.target.value }))}
                             placeholder="Seu nome"
                           />
                         </label>
                         <label className="auth-field">
                           <span>Número do cartão</span>
                           <input
                             type="text"
                             inputMode="numeric"
                             value={cardForm.number}
                             onChange={(event) => setCardForm((current) => ({ ...current, number: event.target.value }))}
                             placeholder="1234 5678 9012 3456"
                           />
                         </label>
                         <div className="payment-form-row">
                           <label className="auth-field">
                             <span>Validade</span>
                             <input
                               type="text"
                               inputMode="numeric"
                               value={cardForm.expiry}
                               onChange={(event) => setCardForm((current) => ({ ...current, expiry: event.target.value }))}
                               placeholder="MM/AA"
                             />
                           </label>
                           <label className="auth-field">
                             <span>CVV</span>
                             <input
                               type="text"
                               inputMode="numeric"
                               value={cardForm.cvv}
                               onChange={(event) => setCardForm((current) => ({ ...current, cvv: event.target.value }))}
                               placeholder="123"
                             />
                           </label>
                         </div>
                       </div>
                     )}
                   </div>

                   <aside className="checkout-summary">
                     <div className="checkout-summary-header">
                       <span>Resumo do pedido</span>
                       <strong>{selectedPlan}</strong>
                     </div>

                     <div className="checkout-line">
                       <span>Plano</span>
                       <strong>{selectedPlan}</strong>
                     </div>
                     <div className="checkout-line">
                       <span>Ciclo</span>
                       <strong>{billingCycle === 'annual' ? 'Anual' : 'Mensal'}</strong>
                     </div>
                     <div className="checkout-line">
                       <span>Pagamento</span>
                       <strong>{paymentOptions.find((option) => option.id === paymentMethod)?.label}</strong>
                     </div>

                     <div className="checkout-total-box">
                       <div className="checkout-line total-line">
                         <span>Total</span>
                         <strong>{selectedPlan === 'Enterprise' ? 'Personalizado' : getPlanPrice(selectedPlan)}</strong>
                       </div>
                       {billingCycle === 'annual' && selectedPlan !== 'Enterprise' && (
                         <div className="checkout-savings">Economize R$ {annualSavings.toLocaleString('pt-BR')} no ciclo anual</div>
                       )}
                     </div>
                   </aside>
                 </div>
                </div>
              </>
            )}
          </div>

          <div className="auth-actions-row onboarding-actions">
            <button type="button" className="ghost-button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
              Voltar
            </button>
            <button type="button" className="primary-button" onClick={goToNextStep}>
              {step === onboardingSteps.length - 1 ? 'Confirmar assinatura' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default AuthFlow
