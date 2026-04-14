import type { PhaseDefinition } from './types'

export const PHASES: PhaseDefinition[] = [
  {
    id: 1,
    name: 'Business Quality',
    description: 'Assess the predictability, resilience, and economics of the core business.',
    questions: [
      {
        id: 'bq_revenue_predictability',
        text: 'Does the company generate predictable, recurring revenue (subscriptions, contracts, or repeat purchases)?',
        autoMapKey: 'revenuePredictability',
      },
      {
        id: 'bq_pricing_power',
        text: 'Can the company raise prices without losing customers? (Evidence: gross margin ≥ 40% or stable/rising margins)',
        autoMapKey: 'pricingPower',
      },
      {
        id: 'bq_recession_proof',
        text: 'Has the company demonstrated revenue resilience during downturns? (Beta < 0.8 or essential product)',
        autoMapKey: 'recessionProof',
      },
      {
        id: 'bq_customer_concentration',
        text: 'Is revenue well-diversified with no single customer accounting for more than 20% of revenue?',
        autoMapKey: null,
      },
      {
        id: 'bq_unit_economics',
        text: 'Are unit economics strong? (FCF margin ≥ 15% or gross margin ≥ 50% with clear path to profitability)',
        autoMapKey: 'unitEconomics',
      },
    ],
  },
  {
    id: 2,
    name: 'Competitive Moat',
    description: 'Evaluate the durability of the competitive advantage protecting the business from rivals.',
    questions: [
      {
        id: 'moat_switching_costs',
        text: 'Do customers face significant switching costs (multi-year contracts, data lock-in, deep integrations)?',
        autoMapKey: null,
      },
      {
        id: 'moat_network_effects',
        text: 'Does the product become more valuable as more users join (platform, marketplace, or social dynamics)?',
        autoMapKey: null,
      },
      {
        id: 'moat_intangibles',
        text: 'Does the company own strong intangible assets such as patents, brand equity, or regulatory licenses?',
        autoMapKey: 'moatIntangibles',
      },
      {
        id: 'moat_cost_advantage',
        text: 'Does the company produce at structurally lower cost than competitors? (ROIC spread > 5% above WACC)',
        autoMapKey: 'moatCostAdvantage',
      },
      {
        id: 'moat_efficient_scale',
        text: 'Does the company operate in a niche large enough to be profitable but small enough to deter new entrants?',
        autoMapKey: null,
      },
    ],
  },
  {
    id: 3,
    name: 'Growth',
    description: 'Assess the quality, durability, and reinvestment potential of future growth.',
    questions: [
      {
        id: 'growth_tam_runway',
        text: 'Is there a large, underpenetrated addressable market with significant growth runway remaining?',
        autoMapKey: null,
      },
      {
        id: 'growth_organic_vs_acquisition',
        text: 'Is growth primarily organic rather than dependent on expensive acquisitions to sustain revenue?',
        autoMapKey: 'organicGrowth',
      },
      {
        id: 'growth_margin_expansion',
        text: 'Is there evidence of operating leverage — are operating margins expanding as the company scales?',
        autoMapKey: 'marginExpansion',
      },
      {
        id: 'growth_reinvestment_quality',
        text: 'Does the company reinvest capital at high returns? (ROIC consistently above WACC)',
        autoMapKey: 'reinvestmentQuality',
      },
      {
        id: 'growth_analyst_confidence',
        text: 'Do analyst consensus estimates show sustained revenue or earnings growth of ≥ 10% over the next year?',
        autoMapKey: 'analystConfidence',
      },
    ],
  },
  {
    id: 4,
    name: 'Management',
    description: 'Evaluate capital allocation discipline, alignment, and track record.',
    questions: [
      {
        id: 'mgmt_insider_ownership',
        text: 'Does management have meaningful skin in the game? (Insider ownership ≥ 5%)',
        autoMapKey: 'insiderOwnership',
      },
      {
        id: 'mgmt_capital_allocation',
        text: 'Has management demonstrated disciplined capital allocation (buybacks at value, no dilutive acquisitions)?',
        autoMapKey: 'capitalAllocation',
      },
      {
        id: 'mgmt_compensation_alignment',
        text: 'Is executive compensation tied to per-share value metrics (EPS, ROIC, FCF/share) rather than revenue alone?',
        autoMapKey: null,
      },
      {
        id: 'mgmt_track_record',
        text: 'Has management delivered consistently on past financial guidance and strategic promises?',
        autoMapKey: 'trackRecord',
      },
      {
        id: 'mgmt_transparency',
        text: 'Does management communicate clearly and conservatively with no signs of earnings manipulation?',
        autoMapKey: 'transparency',
      },
    ],
  },
  {
    id: 5,
    name: 'Risk & Valuation',
    description: 'Assess key risks and whether the current price offers a sufficient margin of safety.',
    questions: [
      {
        id: 'risk_regulatory',
        text: 'Is the company insulated from adverse regulatory changes (not in a heavily regulated or politically sensitive industry)?',
        autoMapKey: null,
      },
      {
        id: 'risk_competitive_disruption',
        text: 'Is the competitive position durable against technological disruption or well-funded new entrants?',
        autoMapKey: null,
      },
      {
        id: 'risk_financial_health',
        text: 'Is the balance sheet healthy with no near-term solvency risk? (Altman Z-Score in Safe zone)',
        autoMapKey: 'financialHealth',
      },
      {
        id: 'risk_macro_exposure',
        text: 'Is the business relatively protected from macro headwinds such as FX volatility, rate sensitivity, or commodity cycles?',
        autoMapKey: 'macroExposure',
      },
      {
        id: 'val_price_reasonable',
        text: 'Given this analysis, is the current market price reasonable relative to intrinsic value? (DCF upside > 15%)',
        autoMapKey: 'priceReasonable',
      },
      {
        id: 'val_margin_of_safety',
        text: 'Is there a sufficient margin of safety — does the base-case DCF upside exceed 25%?',
        autoMapKey: 'marginOfSafety',
      },
    ],
  },
]

/** Flat list of all question IDs across all phases */
export const ALL_QUESTION_IDS: string[] = PHASES.flatMap((p) => p.questions.map((q) => q.id))
