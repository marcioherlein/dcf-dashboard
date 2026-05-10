/**
 * Strict null guards for the modelling workspace.
 * Null is never silently coerced to 0 — callers receive a structured error.
 */

export class GuardError extends Error {
  constructor(
    public readonly field: string,
    public readonly rule: string,
    message: string,
  ) {
    super(message)
    this.name = 'GuardError'
  }
}

export function assertNotNull<T>(
  value: T | null | undefined,
  fieldName: string,
): T {
  if (value == null) {
    throw new GuardError(fieldName, 'NOT_NULL', `${fieldName} is required but was null or undefined`)
  }
  return value
}

export function assertPositive(
  value: number | null | undefined,
  fieldName: string,
): number {
  const v = assertNotNull(value, fieldName)
  if (v <= 0) {
    throw new GuardError(fieldName, 'POSITIVE', `${fieldName} must be positive, got ${v}`)
  }
  return v
}

export function assertTerminalGrowth(terminalG: number, wacc: number): void {
  if (terminalG >= wacc) {
    throw new GuardError(
      'terminalG',
      'TERMINAL_G_LT_WACC',
      `Terminal growth rate (${(terminalG * 100).toFixed(2)}%) must be less than WACC (${(wacc * 100).toFixed(2)}%). Gordon Growth model diverges when g ≥ WACC.`,
    )
  }
}

/** Returns the value if present, or null (never throws). Use when optional. */
export function nullable<T>(value: T | null | undefined): T | null {
  return value ?? null
}

/** Clamp terminal g to stay below wacc with a minimum safety margin. */
export function clampTerminalG(terminalG: number, wacc: number, margin = 0.005): number {
  return Math.max(0, Math.min(terminalG, wacc - margin))
}
