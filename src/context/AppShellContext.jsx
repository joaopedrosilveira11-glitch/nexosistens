import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getEffectiveRoleValue, getVisibleNavigationForUser } from '../config/navigation'
import { supabase } from '../lib/supabase'

const AppShellContext = createContext(null)

const companyStorageKeys = ['nexo-customers', 'nexo-inventory-items', 'nexo-invoices', 'nexo.tenant_id']

const clearStoredCompanyData = () => {
  if (typeof window === 'undefined') return

  companyStorageKeys.forEach((key) => window.localStorage.removeItem(key))
}

export function AppShellProvider({ children }) {
  const [session, setSession] = useState(null)
  const [showLanding, setShowLanding] = useState(true)
  const [activeModule, setActiveModule] = useState('dashboard')
  const [selectedPlan, setSelectedPlan] = useState('Pro')
  const [theme, setTheme] = useState('dark')
  const [hasHydratedSession, setHasHydratedSession] = useState(false)

  const sessionStorageKey = 'nexo.auth.session'

  const visibleNavigation = useMemo(() => {
    const userRole = getEffectiveRoleValue(session?.user)
    const effectivePlan = userRole === 'owner' ? 'Enterprise' : selectedPlan
    return getVisibleNavigationForUser({
      role: userRole,
      plan: effectivePlan,
      modules: Array.isArray(session?.user?.modules) ? session.user.modules : [],
    })
  }, [selectedPlan, session])

  useEffect(() => {
    if (session?.user && getEffectiveRoleValue(session.user) === 'owner' && selectedPlan !== 'Enterprise') {
      setSelectedPlan('Enterprise')
    }
  }, [selectedPlan, session])

  useEffect(() => {
    if (!visibleNavigation.some((item) => item.id === activeModule)) {
      setActiveModule(visibleNavigation[0]?.id ?? 'dashboard')
    }
  }, [activeModule, visibleNavigation])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const savedSession = window.localStorage.getItem(sessionStorageKey)
      if (savedSession) {
        const parsed = JSON.parse(savedSession)
        if (parsed?.user) {
          setSession(parsed)
          setShowLanding(false)
          setHasHydratedSession(true)
          return
        }
      }
    } catch (error) {
      console.warn('Failed to hydrate stored auth session', error)
    }

    setSession(null)
    setShowLanding(true)
    setHasHydratedSession(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !hasHydratedSession) return

    if (session?.user) {
      window.localStorage.setItem(sessionStorageKey, JSON.stringify(session))
    } else {
      window.localStorage.removeItem(sessionStorageKey)
    }
  }, [session, hasHydratedSession])

  useEffect(() => {
    if (!supabase || typeof window === 'undefined') return

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => {
          try {
            reg.unregister()
            if (typeof caches !== 'undefined') {
              caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
            }
            // eslint-disable-next-line no-console
            console.log('Unregistered service worker and cleared caches')
          } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('Failed to unregister service worker', error)
          }
        })
      }).catch((error) => console.warn('Error reading service worker registrations', error))
    }
  }, [])

  const enterApp = (nextSession) => {
    clearStoredCompanyData()
    setSession(nextSession)
    if (nextSession?.user) {
      const effectiveRole = getEffectiveRoleValue(nextSession.user)
      const effectivePlan = nextSession.user.plan || (effectiveRole === 'owner' ? 'Enterprise' : 'Pro')
      setSelectedPlan(effectivePlan)
    }
    setShowLanding(false)
  }

  const goToLanding = () => {
    clearStoredCompanyData()
    setSession(null)
    setShowLanding(true)
    setActiveModule('dashboard')
  }

  const handleLogout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut()
      } catch (_error) {
        // Ignore sign-out errors in demo mode and continue to landing.
      }
    }

    goToLanding()
  }

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  const value = {
    session,
    showLanding,
    activeModule,
    selectedPlan,
    theme,
    visibleNavigation,
    setSession,
    setShowLanding,
    setActiveModule,
    setSelectedPlan,
    setTheme,
    enterApp,
    goToLanding,
    handleLogout,
    toggleTheme,
  }

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
}

export function useAppShell() {
  const context = useContext(AppShellContext)

  if (!context) {
    throw new Error('useAppShell must be used within AppShellProvider')
  }

  return context
}
