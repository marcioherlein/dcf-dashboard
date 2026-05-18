'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import LoginModal from './LoginModal'

interface LoginGateContextValue {
  /** Call this to require sign-in before proceeding. Returns true if already signed in. */
  requireAuth: (headline?: string) => boolean
}

const LoginGateContext = createContext<LoginGateContextValue>({ requireAuth: () => true })

export function useLoginGate() {
  return useContext(LoginGateContext)
}

export function LoginGateProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [headline, setHeadline] = useState<string | undefined>()

  const requireAuth = useCallback((hl?: string): boolean => {
    if (session?.user) return true
    setHeadline(hl)
    setOpen(true)
    return false
  }, [session])

  return (
    <LoginGateContext.Provider value={{ requireAuth }}>
      {children}
      {open && <LoginModal headline={headline} onClose={() => setOpen(false)} />}
    </LoginGateContext.Provider>
  )
}
