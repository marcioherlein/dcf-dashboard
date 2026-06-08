'use client'

import { useSession } from 'next-auth/react'

export type PlanTier = 'free' | 'pro'

export type FeatureGate =
  | 'sensitivity_table'
  | 'thesis_builder'
  | 'pdf_export'
  | 'unlimited_saves'
  | 'price_alerts'
  | 'portfolio_tracker'
  | 'scenario_builder'
  | 'compare_tool'
  | 'macro_brief'

interface GateConfig {
  label: string
  description: string
  tier: PlanTier
}

export const GATE_CONFIG: Record<FeatureGate, GateConfig> = {
  sensitivity_table: {
    label: 'Sensitivity Analysis',
    description: 'See fair value at every CAGR × WACC combination',
    tier: 'pro',
  },
  thesis_builder: {
    label: 'Thesis Builder',
    description: 'Structured investment questionnaire to stress-test your conviction',
    tier: 'pro',
  },
  pdf_export: {
    label: 'PDF Export',
    description: 'Download a full investment brief as a PDF',
    tier: 'pro',
  },
  unlimited_saves: {
    label: 'Unlimited Saves',
    description: 'Save unlimited analyses to My Valuations',
    tier: 'pro',
  },
  price_alerts: {
    label: 'Price Alerts',
    description: 'Get notified when a stock enters your fair value range',
    tier: 'pro',
  },
  portfolio_tracker: {
    label: 'Portfolio Tracker',
    description: 'Track your holdings vs. fair value in one view',
    tier: 'pro',
  },
  scenario_builder: {
    label: 'Scenario Builder',
    description: 'Custom Bull / Base / Bear with named assumption sets',
    tier: 'pro',
  },
  compare_tool: {
    label: 'Compare Stocks',
    description: 'Side-by-side valuation comparison for two tickers',
    tier: 'pro',
  },
  macro_brief: {
    label: 'AI Macro Brief',
    description: 'Claude-generated market regime analysis and investment implications',
    tier: 'pro',
  },
}

export function getGateConfig(gate: FeatureGate): GateConfig {
  return GATE_CONFIG[gate]
}

// Returns {allowed, tier} based on the user's plan from their session.
// This is for UI gating only — server routes must independently enforce plan checks.
export function useFeatureGate(gate: FeatureGate): { allowed: boolean; tier: PlanTier } {
  const { data: session } = useSession()
  const required = GATE_CONFIG[gate].tier
  const userPlan = (session?.user as { plan?: string } | undefined)?.plan ?? 'free'
  const allowed = required === 'free' || userPlan === 'pro'
  return { allowed, tier: required }
}
