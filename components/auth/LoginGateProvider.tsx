'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import LoginModal from './LoginModal'
import { track } from '@/lib/analytics/events'
import { savePreLoginState, type PreLoginState } from '@/lib/auth/preLoginState'

export type LoginIntent =
  | 'save_valuation'
  | 'export_report'
  | 'portfolio_tracking'
  | 'compare_models'
  | 'save_thesis'
  | 'create_alert'

interface RequireAuthOptions {
  intent: LoginIntent
  headline?: string
  state?: Partial<Omit<PreLoginState, 'returnUrl' | 'intent'>>
}

interface LoginGateContextValue {
  requireAuth: (opts: RequireAuthOptions) => boolean
}

const LoginGateContext = createContext<LoginGateContextValue>({ requireAuth: () => true })

export function useLoginGate() {
  return useContext(LoginGateContext)
}

export function LoginGateProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [pendingIntent, setPendingIntent] = useState<LoginIntent | undefined>()
  const [pendingHeadline, setPendingHeadline] = useState<string | undefined>()

  const requireAuth = useCallback((opts: RequireAuthOptions): boolean => {
    if (session?.user) return true
    track('gated_action_clicked', { intent: opts.intent })
    savePreLoginState({
      returnUrl: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/',
      intent: opts.intent,
      ...(opts.state ?? {}),
    })
    setPendingIntent(opts.intent)
    setPendingHeadline(opts.headline)
    setOpen(true)
    track('login_modal_seen', { intent: opts.intent })
    return false
  }, [session])

  const handleClose = useCallback(() => {
    setOpen(false)
    track('login_dismissed', { intent: pendingIntent })
  }, [pendingIntent])

  return (
    <LoginGateContext.Provider value={{ requireAuth }}>
      {children}
      {open && (
        <LoginModal
          intent={pendingIntent}
          headline={pendingHeadline}
          onClose={handleClose}
        />
      )}
    </LoginGateContext.Provider>
  )
}
