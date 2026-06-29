/**
 * Shared type contracts for the Ideas feature.
 * Imported by the route, UI components, and any consumers.
 */

// ─── EvidenceItem ─────────────────────────────────────────────────────────────

export interface EvidenceItem {
  /** Short human-readable label, e.g. "DCF discount" or "EPS revision" */
  label: string
  /** Formatted value string, e.g. "-32%" or "↑14%" */
  value: string
  /**
   * true  = positive signal (bullish evidence)
   * false = negative signal (bearish / cautionary evidence)
   * null  = neutral / informational
   */
  positive: boolean | null
}

// ─── RiskFlag ─────────────────────────────────────────────────────────────────

export type RiskFlagType =
  | 'dcf_unavailable'
  | 'analyst_only'
  | 'very_aggressive'
  | 'expensive_sector'
  | 'near_52w_high'
  | 'insider_selling'
  | 'low_data'
  | 'negative_fcf_proxy'

export interface RiskFlag {
  type: RiskFlagType
  message: string
}

// ─── IdeaStock ────────────────────────────────────────────────────────────────

export interface IdeaStock {
  // ── existing fields ──────────────────────────────────────────────────────
  ticker: string
  name: string
  sector: string | null
  price: number | null
  analystTarget: number | null
  upsidePct: number | null
  insicFairValue: number | null
  insicUpsidePct: number | null
  convictionBand: 'A' | 'B' | 'C' | 'D' | null
  epsRevision: { direction: 'up' | 'flat' | 'down'; magnitude: number } | null
  insiderSentiment: { sentiment: 'net_buyer' | 'net_seller' | 'neutral'; buyCount: number; sellCount: number } | null
  sectorContext: { medianFwdPE: number | null; stockFwdPE: number | null; pctVsMedianFwdPE: number | null } | null
  narrativeHook: string | null
  impliedCAGR: number | null
  historicalCagr3y: number | null
  expectation: 'Conservative' | 'Moderate' | 'Aggressive' | 'Very Aggressive' | null
  marketCap: number | null
  pctFrom52WHigh: number | null
  analystRating: number | null
  // ── new fields ────────────────────────────────────────────────────────────
  /** Composite conviction score clamped to [0, 100]. Null only when price is unavailable. */
  ideaScore: number | null
  /** Up to 5 structured evidence items derived from signal logic. Empty array when none can be derived. */
  evidenceList: EvidenceItem[]
  /** Structured risk flags. Empty array means no flags triggered. */
  riskFlags: RiskFlag[]
  /** Forward P/E promoted from internal _fwdPE scratch value. */
  fwdPE: number | null
  /** Trailing twelve-month P/E from quote batch. */
  trailingPE: number | null
  /** Derived market-cap bucket for client-side filtering. */
  marketCapBucket: 'small' | 'mid' | 'large' | 'mega' | null
}

// ─── SignalId ─────────────────────────────────────────────────────────────────

export type SignalId =
  | 'insic_dcf'
  | 'estimate_upgrades'
  | 'insider_buying'
  | 'undervalued'
  | 'priced_for_perfection'
  | 'contrarian'
  | 'near_52w_low'
  | 'high_conviction'

// ─── DataCoverage ─────────────────────────────────────────────────────────────

export interface DataCoverage {
  /** Total tickers in the universe that were requested. */
  requestedCount: number
  /** Tickers for which a price quote was successfully fetched. */
  quoteSuccessCount: number
  /** Tickers for which a fundamentals summary was successfully fetched. */
  summarySuccessCount: number
  /** Tickers for which insicFairValue is non-null (DCF computed). */
  dcfAvailableCount: number
  /** dcfAvailableCount / requestedCount expressed as 0-1 fraction. */
  dataCoveragePct: number
  /** Tickers that failed silently during batch fetch loops. */
  failedTickers: string[]
}

// ─── IdeasResponse ────────────────────────────────────────────────────────────

export interface IdeasResponse {
  signals: Record<SignalId, IdeaStock[]>
  updatedAt: string
  totalAnalyzed: number
  /** Data quality metrics for admin monitoring and UI coverage indicator. */
  dataCoverage: DataCoverage
}

// ─── IdeaSnapshot (interface only — no implementation) ────────────────────────

export interface IdeaSnapshot {
  /** Monotonic integer; increment when shape changes to guard deserialisation. */
  schemaVersion: 1
  /** Primary key for the snapshots table: ISO date string "YYYY-MM-DD". */
  snapshotDate: string
  /** ISO 8601 timestamp of when buildIdeas() completed for this snapshot. */
  capturedAt: string
  /** Full ticker universe attempted for this snapshot. */
  universe: string[]
  totalRequested: number
  totalAnalyzed: number
  dataCoverage: DataCoverage
  /** Signal buckets identical to IdeasResponse.signals. */
  signals: Record<SignalId, IdeaStock[]>
}

// ─── Table column definitions ─────────────────────────────────────────────────

export type TableFormatType =
  | 'text'       // plain string, no transformation
  | 'currency'   // "$1,234.56"
  | 'pct'        // "32.4%"
  | 'pct_delta'  // "+12.3%" / "-4.1%" with sign and colour
  | 'multiple'   // "18.2x"
  | 'badge'      // rendered as a ConvictionBadge chip
  | 'score'      // numeric pill 0-100
  | 'market_cap' // "$4.2B" / "$980M" abbreviated
  | 'link'       // ticker text that navigates to /stock/[ticker]

export interface TableColumnDef {
  id: string
  label: string
  accessor: (stock: IdeaStock) => string | number | null
  format: TableFormatType
  /** Whether the column is sortable in the table view. */
  sortable: boolean
  /** Default pixel width hint for column sizing. */
  defaultWidth?: number
}

export const IDEAS_TABLE_COLUMNS: TableColumnDef[] = [
  {
    id: 'ticker',
    label: 'Ticker',
    accessor: (s) => s.ticker,
    format: 'link',
    sortable: true,
    defaultWidth: 72,
  },
  {
    id: 'name',
    label: 'Company',
    accessor: (s) => s.name,
    format: 'text',
    sortable: false,
    defaultWidth: 160,
  },
  {
    id: 'sector',
    label: 'Sector',
    accessor: (s) => s.sector,
    format: 'text',
    sortable: true,
    defaultWidth: 120,
  },
  {
    id: 'price',
    label: 'Price',
    accessor: (s) => s.price,
    format: 'currency',
    sortable: true,
    defaultWidth: 80,
  },
  {
    id: 'insicFairValue',
    label: 'DCF Fair Value',
    accessor: (s) => s.insicFairValue,
    format: 'currency',
    sortable: true,
    defaultWidth: 96,
  },
  {
    id: 'insicUpsidePct',
    label: 'DCF Upside',
    accessor: (s) => s.insicUpsidePct != null ? s.insicUpsidePct * 100 : null,
    format: 'pct_delta',
    sortable: true,
    defaultWidth: 88,
  },
  {
    id: 'analystTarget',
    label: 'Analyst Target',
    accessor: (s) => s.analystTarget,
    format: 'currency',
    sortable: true,
    defaultWidth: 96,
  },
  {
    id: 'upsidePct',
    label: 'Analyst Upside',
    accessor: (s) => s.upsidePct != null ? s.upsidePct * 100 : null,
    format: 'pct_delta',
    sortable: true,
    defaultWidth: 96,
  },
  {
    id: 'fwdPE',
    label: 'Fwd P/E',
    accessor: (s) => s.fwdPE,
    format: 'multiple',
    sortable: true,
    defaultWidth: 72,
  },
  {
    id: 'epsRevision',
    label: 'EPS Rev.',
    accessor: (s) => s.epsRevision != null ? s.epsRevision.magnitude * 100 : null,
    format: 'pct_delta',
    sortable: true,
    defaultWidth: 80,
  },
  {
    id: 'convictionBand',
    label: 'Band',
    accessor: (s) => s.convictionBand,
    format: 'badge',
    sortable: true,
    defaultWidth: 56,
  },
  {
    id: 'ideaScore',
    label: 'Score',
    accessor: (s) => s.ideaScore,
    format: 'score',
    sortable: true,
    defaultWidth: 56,
  },
  {
    id: 'marketCap',
    label: 'Mkt Cap',
    accessor: (s) => s.marketCap,
    format: 'market_cap',
    sortable: true,
    defaultWidth: 80,
  },
]
