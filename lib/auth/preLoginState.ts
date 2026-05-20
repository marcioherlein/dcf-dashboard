const PRE_LOGIN_KEY = 'rationale_prelogin_state'

export interface PreLoginState {
  returnUrl: string
  intent: string
  ticker?: string
  tab?: string
  cagr?: number
  wacc?: number
  terminalG?: number
  scenario?: string
  thesisDraft?: string
}

export function savePreLoginState(s: PreLoginState): void {
  try { sessionStorage.setItem(PRE_LOGIN_KEY, JSON.stringify(s)) } catch { /* unavailable */ }
}

export function loadPreLoginState(): PreLoginState | null {
  try {
    const raw = sessionStorage.getItem(PRE_LOGIN_KEY)
    return raw ? (JSON.parse(raw) as PreLoginState) : null
  } catch { return null }
}

export function clearPreLoginState(): void {
  try { sessionStorage.removeItem(PRE_LOGIN_KEY) } catch { /* unavailable */ }
}
