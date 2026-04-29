'use client'

import { useState, useEffect, useMemo } from 'react'
import { ValuationMetrics } from '@/lib/ai-stack/scoring'
import { LAYER_COLORS } from '@/lib/ai-stack/tickers'
import { LAYER_INFO, MOAT_HEX, MARGIN_HEX } from '@/lib/ai-stack/layerInfo'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtNum(v: number | null, d = 1): string {
  if (v === null || !isFinite(v) || v <= 0) return '—'
  return v.toFixed(d) + 'x'
}

function fmtPct(v: number | null, isDecimal = true): string {
  if (v === null || !isFinite(v)) return '—'
  const val = isDecimal ? v * 100 : v
  return (val >= 0 ? '+' : '') + val.toFixed(1) + '%'
}

function fmtPctPlain(v: number | null): string {
  if (v === null || !isFinite(v)) return '—'
  return (v * 100).toFixed(1) + '%'
}

function scoreColor(s: number): string {
  if (s >= 70) return '#15803d'
  if (s >= 55) return '#0369a1'
  if (s >= 40) return '#b45309'
  return '#dc2626'
}

function scoreBg(s: number): string {
  if (s >= 70) return '#dcfce7'
  if (s >= 55) return '#dbeafe'
  if (s >= 40) return '#fef3c7'
  return '#fee2e2'
}

// ─── Cover slide ─────────────────────────────────────────────────────────────

function CoverSlide() {
  const layerColors = Object.values(LAYER_COLORS)
  return (
    <div className="report-slide" style={{
      background: 'linear-gradient(150deg, #060d1a 0%, #0d1f3c 55%, #060d1a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background grid pattern */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* Glow orb */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
        borderRadius: '50%',
      }} />

      {/* Content */}
      <div style={{ position: 'relative', textAlign: 'center', padding: '0 60px' }}>
        {/* Layer color dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '36px', flexWrap: 'wrap', maxWidth: '320px', margin: '0 auto 36px' }}>
          {layerColors.map((c, i) => (
            <div key={i} style={{
              width: '12px', height: '12px', borderRadius: '50%',
              backgroundColor: c, opacity: 0.85,
            }} />
          ))}
        </div>

        <div style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.35em',
          color: '#60a5fa', textTransform: 'uppercase', marginBottom: '16px',
        }}>
          Value Investor&apos;s Guide
        </div>

        <h1 style={{
          fontSize: '52px', fontWeight: 800, color: '#f8fafc',
          lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: '8px',
        }}>
          The AI<br />Infrastructure<br />Stack
        </h1>

        <div style={{
          width: '60px', height: '3px', borderRadius: '2px',
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
          margin: '20px auto',
        }} />

        <p style={{
          fontSize: '15px', color: '#94a3b8', lineHeight: 1.6,
          maxWidth: '360px', margin: '0 auto 40px',
        }}>
          16 infrastructure layers · 125+ public companies · scored by FCF yield, EV/EBITDA, ROE, gross margin &amp; growth
        </p>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '100px', padding: '8px 20px',
        }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80' }} />
          <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 500 }}>Live data · DCF Dashboard · 2025</span>
        </div>
      </div>

      {/* Bottom color strip */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '5px',
        background: `linear-gradient(90deg, ${layerColors.join(', ')})`,
      }} />
    </div>
  )
}

// ─── Scoring legend slide ─────────────────────────────────────────────────────

const SCORE_FACTORS = [
  { label: 'FCF Yield',    weight: '18%', desc: 'Free cash flow / market cap. Cash is king.', color: '#0ea5e9' },
  { label: 'EV/EBITDA',   weight: '15%', desc: 'Enterprise value vs operating earnings.', color: '#8b5cf6' },
  { label: 'PEG Ratio',   weight: '13%', desc: 'P/E adjusted for growth (Lynch).', color: '#6366f1' },
  { label: 'ROE',         weight: '12%', desc: 'Return on equity. Buffett target: >15%.', color: '#ec4899' },
  { label: 'P/FCF',       weight: '10%', desc: 'Price vs free cash flow multiple.', color: '#f59e0b' },
  { label: 'Gross Margin',weight: '10%', desc: 'Pricing power moat. Buffett loves >40%.', color: '#10b981' },
  { label: 'Debt/Equity', weight: '9%',  desc: 'Balance sheet leverage risk.', color: '#ef4444' },
  { label: 'Rev Growth',  weight: '8%',  desc: 'Top-line momentum. Business must grow.', color: '#84cc16' },
  { label: 'Price/Book',  weight: '5%',  desc: 'Asset floor (Graham margin of safety).', color: '#78716c' },
]

const SCORE_RANGES = [
  { min: 70, label: 'UNDERVALUED',    color: '#15803d', bg: '#dcfce7', desc: 'Strong value across multiple metrics' },
  { min: 55, label: 'FAIR VALUE',     color: '#0369a1', bg: '#dbeafe', desc: 'Reasonably priced quality business' },
  { min: 40, label: 'FAIRLY PRICED',  color: '#b45309', bg: '#fef3c7', desc: 'Price reflects fundamentals fairly' },
  { min: 0,  label: 'EXPENSIVE',      color: '#dc2626', bg: '#fee2e2', desc: 'Premium pricing, limited margin of safety' },
]

function ScoringSlide() {
  return (
    <div className="report-slide" style={{ background: '#f8fafc', display: 'flex', flexDirection: 'column', padding: '48px 56px' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.3em', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
          Methodology
        </div>
        <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
          How Every Company Is Scored
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', lineHeight: 1.5 }}>
          Each company receives a composite 0–100 score based on 9 value metrics. Weights reflect the importance of each signal for long-term capital appreciation, following Buffett, Lynch, and Graham frameworks.
        </p>
      </div>

      {/* Factor grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '28px' }}>
        {SCORE_FACTORS.map(f => (
          <div key={f.label} style={{
            background: 'white', borderRadius: '10px', padding: '12px 14px',
            border: '1px solid #e2e8f0',
            borderLeft: `4px solid ${f.color}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{f.label}</span>
              <span style={{
                fontSize: '11px', fontWeight: 700, color: f.color,
                background: f.color + '15', borderRadius: '4px', padding: '1px 6px',
              }}>{f.weight}</span>
            </div>
            <p style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4, margin: 0 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Score ranges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        {SCORE_RANGES.map(r => (
          <div key={r.label} style={{
            background: r.bg, borderRadius: '10px', padding: '12px 14px',
            border: `1px solid ${r.color}30`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: r.color, lineHeight: 1 }}>
              {r.min}+
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: r.color, letterSpacing: '0.1em', marginTop: '4px' }}>
              {r.label}
            </div>
            <div style={{ fontSize: '10px', color: r.color + 'cc', marginTop: '4px', lineHeight: 1.3 }}>
              {r.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Company table ────────────────────────────────────────────────────────────

function CompanyTable({ rows, accentColor }: { rows: ValuationMetrics[]; accentColor: string }) {
  const top = rows
    .filter(r => !r.error)
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, 5)

  if (!top.length) return (
    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '20px' }}>
      No data available
    </div>
  )

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
      <thead>
        <tr style={{ borderBottom: `2px solid ${accentColor}30` }}>
          {['Ticker', 'Company', 'Score', 'P/E', 'FCF Yield', 'Gross Mgn', 'Rev Growth'].map(h => (
            <th key={h} style={{
              padding: '6px 8px', textAlign: h === 'Ticker' || h === 'Company' ? 'left' : 'right',
              fontSize: '10px', fontWeight: 700, color: '#64748b',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {top.map((r, i) => (
          <tr key={r.ticker} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
            <td style={{ padding: '7px 8px', fontFamily: 'monospace', fontWeight: 700, color: accentColor, fontSize: '12px' }}>
              {r.ticker}
            </td>
            <td style={{ padding: '7px 8px', color: '#1e293b', maxWidth: '160px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {r.name.replace(' Technologies', ' Tech').replace(' Corporation', ' Corp').replace(' Holdings', '').replace(' Platforms', '')}
            </td>
            <td style={{ padding: '7px 8px', textAlign: 'right' }}>
              <span style={{
                display: 'inline-block',
                background: scoreBg(r.valueScore),
                color: scoreColor(r.valueScore),
                border: `1px solid ${scoreColor(r.valueScore)}40`,
                borderRadius: '5px', padding: '1px 7px',
                fontFamily: 'monospace', fontWeight: 700, fontSize: '11px',
              }}>
                {r.valueScore}
              </span>
            </td>
            <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace', color: r.pe && r.pe > 0 ? '#1e293b' : '#94a3b8' }}>
              {fmtNum(r.pe)}
            </td>
            <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace', color: r.fcfYield !== null ? (r.fcfYield >= 0.04 ? '#15803d' : r.fcfYield >= 0 ? '#b45309' : '#dc2626') : '#94a3b8' }}>
              {fmtPct(r.fcfYield)}
            </td>
            <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace', color: r.grossMargin !== null ? (r.grossMargin >= 0.4 ? '#15803d' : r.grossMargin >= 0.2 ? '#1e293b' : '#b45309') : '#94a3b8' }}>
              {fmtPctPlain(r.grossMargin)}
            </td>
            <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace', color: r.revenueGrowth !== null ? (r.revenueGrowth >= 0.1 ? '#15803d' : r.revenueGrowth >= 0 ? '#1e293b' : '#dc2626') : '#94a3b8' }}>
              {fmtPct(r.revenueGrowth)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Layer slide ──────────────────────────────────────────────────────────────

function LayerSlide({ layer, rows }: { layer: number; rows: ValuationMetrics[] }) {
  const info = LAYER_INFO[layer]
  const color = LAYER_COLORS[layer] ?? '#6b7280'
  if (!info) return null

  const moatStyle = MOAT_HEX[info.moatRating] ?? MOAT_HEX['Moderate']
  const marginStyle = MARGIN_HEX[info.marginRating] ?? MARGIN_HEX['Moderate']

  return (
    <div className="report-slide" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(90deg, ${color} 0%, ${color}cc 60%, ${color}99 100%)`,
        padding: '14px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '14px', color: 'white', flexShrink: 0,
          }}>
            L{layer}
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Layer {layer} · AI Infrastructure Stack
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'white', lineHeight: 1.1 }}>
              {info.title}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <span style={{
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '6px', padding: '4px 10px',
            fontSize: '10px', fontWeight: 700, color: 'white', whiteSpace: 'nowrap',
          }}>
            Moat: {info.moatRating}
          </span>
          <span style={{
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '6px', padding: '4px 10px',
            fontSize: '10px', fontWeight: 700, color: 'white', whiteSpace: 'nowrap',
          }}>
            Margins: {info.marginRating}
          </span>
        </div>
      </div>

      {/* Description grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '0', borderBottom: '1px solid #f1f5f9',
        flexShrink: 0,
      }}>
        {[
          { label: 'What They Do', text: info.what },
          { label: 'Revenue Model', text: info.revenue },
        ].map(({ label, text }) => (
          <div key={label} style={{
            padding: '14px 20px',
            borderRight: label === 'What They Do' ? '1px solid #f1f5f9' : 'none',
          }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '5px' }}>
              {label}
            </div>
            <p style={{ fontSize: '11.5px', color: '#374151', lineHeight: 1.55, margin: 0 }}>{text}</p>
          </div>
        ))}
      </div>

      {/* Moat + profitability row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '0', borderBottom: '1px solid #f1f5f9',
        flexShrink: 0,
      }}>
        {[
          { label: 'Competitive Moat', text: info.moat, badge: moatStyle, rating: info.moatRating },
          { label: 'Profitability', text: info.profitability, badge: marginStyle, rating: info.marginRating },
        ].map(({ label, text, badge, rating }) => (
          <div key={label} style={{
            padding: '12px 20px',
            borderRight: label === 'Competitive Moat' ? '1px solid #f1f5f9' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                {label}
              </div>
              <span style={{
                background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`,
                borderRadius: '4px', padding: '1px 6px', fontSize: '9px', fontWeight: 700,
              }}>
                {rating}
              </span>
            </div>
            <p style={{ fontSize: '11px', color: '#374151', lineHeight: 1.5, margin: 0 }}>{text}</p>
          </div>
        ))}
      </div>

      {/* Company table */}
      <div style={{ padding: '0 8px 8px', flex: 1 }}>
        <div style={{ padding: '8px 12px 4px', fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Top Companies by Value Score
        </div>
        <CompanyTable rows={rows} accentColor={color} />
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '9px', color: '#cbd5e1', fontWeight: 500 }}>
          Score: FCF Yield (18%) · EV/EBITDA (15%) · PEG (13%) · ROE (12%) · 5 more factors
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
          <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>DCF Dashboard</span>
        </div>
      </div>
    </div>
  )
}

// ─── Closing slide ────────────────────────────────────────────────────────────

function ClosingSlide() {
  const layerColors = Object.values(LAYER_COLORS)
  return (
    <div className="report-slide" style={{
      background: 'linear-gradient(150deg, #060d1a 0%, #0d1f3c 55%, #060d1a 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', textAlign: 'center',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div style={{ position: 'relative', maxWidth: '480px', padding: '40px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#3b82f6', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '20px' }}>
          All 16 layers · 125+ companies · Live data
        </div>

        <h2 style={{
          fontSize: '38px', fontWeight: 800, color: '#f8fafc',
          lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '16px',
        }}>
          Explore the full<br />live dashboard
        </h2>

        <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '32px' }}>
          Real-time value scores, fair value models, and layer analysis — all sourced from Yahoo Finance and updated every 30 minutes.
        </p>

        <div style={{
          display: 'inline-block',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '12px', padding: '16px 28px', marginBottom: '28px',
        }}>
          <div style={{ fontSize: '11px', color: '#60a5fa', letterSpacing: '0.15em', fontWeight: 600, marginBottom: '6px' }}>LIVE AT</div>
          <div style={{ fontSize: '18px', color: 'white', fontWeight: 700, fontFamily: 'monospace' }}>
            DCF Dashboard · /ai-stack
          </div>
        </div>

        <div style={{
          display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '20px',
        }}>
          {['Value Scoring', 'Fair Value Models', 'Layer Intelligence', 'Risk-Averse Filter'].map(f => (
            <span key={f} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '100px', padding: '5px 12px',
              fontSize: '11px', color: '#cbd5e1', fontWeight: 500,
            }}>{f}</span>
          ))}
        </div>

        <p style={{ fontSize: '10px', color: '#475569', lineHeight: 1.5 }}>
          Not investment advice. For educational and informational purposes only.<br />
          Always do your own research. Past performance does not guarantee future results.
        </p>
      </div>

      {/* Top color strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '5px',
        background: `linear-gradient(90deg, ${layerColors.join(', ')})`,
      }} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AIStackReport() {
  const [data, setData]       = useState<ValuationMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ai-stack')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const byLayer = useMemo(() => {
    const map: Record<number, ValuationMetrics[]> = {}
    for (const row of data) {
      if (!map[row.layer]) map[row.layer] = []
      map[row.layer].push(row)
    }
    return map
  }, [data])

  const LAYERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

  return (
    <>
      {/* Scoped CSS — no global resets, no body overrides */}
      <style>{`
        .report-slide {
          width: 297mm;
          min-height: 210mm;
          height: 210mm;
          overflow: hidden;
          position: relative;
          background: white;
          margin: 0 auto 24px;
          box-shadow: 0 4px 32px rgba(0,0,0,0.18);
          flex-shrink: 0;
          break-after: page;
          page-break-after: always;
          box-sizing: border-box;
        }
        .report-slide:last-child { break-after: auto; page-break-after: auto; }
        .report-no-print { display: block; }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          .report-no-print { display: none !important; }
          .report-slide {
            box-shadow: none;
            margin: 0;
            width: 297mm;
            height: 210mm;
          }
          .report-slides-wrap { padding: 0 !important; background: white; }
        }
      `}</style>

      {/* Top bar — hidden in print */}
      <div className="report-no-print" style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: '#0f172a', borderBottom: '1px solid #1e293b',
        padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href="/ai-stack" style={{ color: '#60a5fa', fontSize: '12px', fontWeight: 500, textDecoration: 'none' }}>
            ← Back to AI Stack
          </a>
          <span style={{ color: '#334155', fontSize: '12px' }}>|</span>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>
            AI Infrastructure Stack · PDF Report · A4 Landscape
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {loading && (
            <span style={{ color: '#60a5fa', fontSize: '12px' }}>
              ⟳ Loading live data…
            </span>
          )}
          <button
            onClick={() => window.print()}
            disabled={loading}
            style={{
              background: loading ? '#334155' : '#3b82f6',
              color: 'white', border: 'none', borderRadius: '8px',
              padding: '8px 20px', fontSize: '13px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <span>⬇</span> Export PDF
          </button>
        </div>
      </div>

      {/* Loading / error states */}
      {loading && (
        <div className="report-no-print" style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>⟳</div>
          <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Loading ~125 tickers from Yahoo Finance…</p>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>First load takes ~15 seconds. Sit tight — the report will populate with live data.</p>
        </div>
      )}

      {error && (
        <div className="report-no-print" style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>
          Error: {error}
        </div>
      )}

      {/* Slides — horizontally scrollable so 297mm slides don't clip on narrow screens */}
      <div className="report-slides-wrap" style={{
        overflowX: 'auto',
        padding: loading ? '0' : '24px 0',
        background: '#e2e8f0',
        minWidth: 0,
      }}>
        {!loading && (
          <>
            <CoverSlide />
            <ScoringSlide />
            {LAYERS.map(layer => (
              <LayerSlide
                key={layer}
                layer={layer}
                rows={byLayer[layer] ?? []}
              />
            ))}
            <ClosingSlide />
          </>
        )}
      </div>
    </>
  )
}
