'use client'

import { useState, useEffect, useMemo } from 'react'
import { ValuationMetrics } from '@/lib/ai-stack/scoring'
import { LAYER_COLORS } from '@/lib/ai-stack/tickers'
import { LAYER_INFO, MOAT_HEX, MARGIN_HEX } from '@/lib/ai-stack/layerInfo'

function fmtNum(v: number | null): string {
  if (v === null || !isFinite(v) || v <= 0) return '—'
  return v.toFixed(1) + 'x'
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
function scoreColor(s: number) {
  if (s >= 70) return '#15803d'
  if (s >= 55) return '#1d4ed8'
  if (s >= 40) return '#b45309'
  return '#dc2626'
}
function scoreBg(s: number) {
  if (s >= 70) return '#dcfce7'
  if (s >= 55) return '#dbeafe'
  if (s >= 40) return '#fef3c7'
  return '#fee2e2'
}

// ─── Layer section ────────────────────────────────────────────────────────────

function LayerSection({ layer, rows }: { layer: number; rows: ValuationMetrics[] }) {
  const info   = LAYER_INFO[layer]
  const color  = LAYER_COLORS[layer] ?? '#6b7280'
  if (!info) return null

  const moat   = MOAT_HEX[info.moatRating]    ?? MOAT_HEX['Moderate']
  const margin = MARGIN_HEX[info.marginRating] ?? MARGIN_HEX['Moderate']

  const top = rows
    .filter(r => !r.error)
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, 5)

  return (
    <div style={{ marginBottom: '28px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
      {/* Header bar */}
      <div style={{
        background: color, borderRadius: '8px 8px 0 0',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '6px', padding: '3px 9px', fontSize: '11px', fontWeight: 800, color: 'white' }}>L{layer}</span>
          <span style={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>{info.title}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span style={{ background: moat.bg, color: moat.text, border: `1px solid ${moat.border}`, borderRadius: '5px', padding: '2px 8px', fontSize: '10px', fontWeight: 700 }}>{info.moatRating} Moat</span>
          <span style={{ background: margin.bg, color: margin.text, border: `1px solid ${margin.border}`, borderRadius: '5px', padding: '2px 8px', fontSize: '10px', fontWeight: 700 }}>{info.marginRating} Margins</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ border: `1px solid ${color}40`, borderTop: 'none', borderRadius: '0 0 8px 8px', background: 'white' }}>
        {/* 4 info fields in 2x2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid #f1f5f9` }}>
          {[
            { label: 'What They Do', text: info.what },
            { label: 'Revenue Model', text: info.revenue },
            { label: 'Competitive Moat', text: info.moat },
            { label: 'Profitability', text: info.profitability },
          ].map(({ label, text }, i) => (
            <div key={label} style={{
              padding: '10px 14px',
              borderRight: i % 2 === 0 ? '1px solid #f1f5f9' : 'none',
              borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none',
            }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
              <p style={{ fontSize: '11px', color: '#374151', lineHeight: 1.5, margin: 0 }}>{text}</p>
            </div>
          ))}
        </div>

        {/* Company table */}
        {top.length > 0 && (
          <div style={{ padding: '8px 12px 10px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '6px' }}>Top Companies by Value Score</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${color}30` }}>
                  {['Ticker', 'Company', 'Score', 'P/E', 'FCF Yield', 'Gross Mgn', 'Rev Growth'].map(h => (
                    <th key={h} style={{ padding: '4px 8px', textAlign: h === 'Ticker' || h === 'Company' ? 'left' : 'right', fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {top.map((r, i) => (
                  <tr key={r.ticker} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                    <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 700, color: color, fontSize: '12px' }}>{r.ticker}</td>
                    <td style={{ padding: '5px 8px', color: '#1e293b', maxWidth: '140px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {r.name.replace(' Technologies', ' Tech').replace(' Corporation', ' Corp').replace(' Holdings', '').replace(' Platforms', '')}
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                      <span style={{ display: 'inline-block', background: scoreBg(r.valueScore), color: scoreColor(r.valueScore), border: `1px solid ${scoreColor(r.valueScore)}40`, borderRadius: '4px', padding: '1px 7px', fontFamily: 'monospace', fontWeight: 700, fontSize: '11px' }}>
                        {r.valueScore}
                      </span>
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: r.pe && r.pe > 0 ? '#1e293b' : '#94a3b8' }}>{fmtNum(r.pe)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: r.fcfYield !== null ? (r.fcfYield >= 0.04 ? '#15803d' : r.fcfYield >= 0 ? '#b45309' : '#dc2626') : '#94a3b8' }}>{fmtPct(r.fcfYield)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: r.grossMargin !== null ? (r.grossMargin >= 0.4 ? '#15803d' : r.grossMargin >= 0.2 ? '#1e293b' : '#b45309') : '#94a3b8' }}>{fmtPctPlain(r.grossMargin)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: r.revenueGrowth !== null ? (r.revenueGrowth >= 0.1 ? '#15803d' : r.revenueGrowth >= 0 ? '#1e293b' : '#dc2626') : '#94a3b8' }}>{fmtPct(r.revenueGrowth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
  const layerColors = Object.values(LAYER_COLORS)

  return (
    <>
      <style>{`
        .report-no-print { display: block; }
        @media print {
          .report-no-print { display: none !important; }
          body { margin: 0; }
        }
        * { box-sizing: border-box; }
      `}</style>

      {/* Top bar */}
      <div className="report-no-print" style={{
        position: 'sticky', top: 0, zIndex: 50, background: '#0f172a',
        borderBottom: '1px solid #1e293b', padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href="/ai-stack" style={{ color: '#60a5fa', fontSize: '12px', fontWeight: 500, textDecoration: 'none' }}>← Back to AI Stack</a>
          <span style={{ color: '#334155' }}>|</span>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>Run <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', color: '#7dd3fc' }}>npm run export-pdf</code> to save to Desktop</span>
        </div>
        {loading && <span style={{ color: '#60a5fa', fontSize: '12px' }}>⟳ Loading…</span>}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
          <p style={{ fontSize: '16px', fontWeight: 600 }}>Loading data…</p>
        </div>
      )}
      {error && <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>Error: {error}</div>}

      {/* Document */}
      {!loading && (
        <div id="pdf-document" style={{ maxWidth: '794px', margin: '0 auto', padding: '0', background: 'white', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

          {/* Cover */}
          <div style={{
            background: 'linear-gradient(150deg, #060d1a 0%, #0d1f3c 55%, #060d1a 100%)',
            padding: '80px 48px',
            textAlign: 'center',
            pageBreakAfter: 'always',
            breakAfter: 'page',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px', maxWidth: '280px', margin: '0 auto 44px' }}>
              {layerColors.map((c, i) => <div key={i} style={{ width: '14px', height: '14px', borderRadius: '50%', background: c }} />)}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.35em', color: '#60a5fa', textTransform: 'uppercase', marginBottom: '18px' }}>Value Investor&apos;s Guide</div>
            <h1 style={{ fontSize: '56px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.05, letterSpacing: '-0.02em', margin: '0 0 28px' }}>
              The AI<br />Infrastructure<br />Stack
            </h1>
            <div style={{ width: '56px', height: '4px', borderRadius: '2px', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', margin: '0 auto 28px' }} />
            <p style={{ fontSize: '17px', color: '#94a3b8', lineHeight: 1.7, maxWidth: '340px', margin: '0 auto 48px' }}>
              16 infrastructure layers · 125+ public companies<br />
              scored by FCF yield, EV/EBITDA, ROE,<br />gross margin &amp; growth
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '100px', padding: '11px 24px' }}>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#4ade80' }} />
              <span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: 500 }}>Live data · DCF Dashboard · 2025</span>
            </div>
            <div style={{ marginTop: '60px', height: '5px', background: `linear-gradient(90deg, ${layerColors.join(', ')})`, borderRadius: '3px' }} />
          </div>

          {/* Scoring key */}
          <div style={{ padding: '32px 32px 24px', pageBreakAfter: 'always', breakAfter: 'page' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.3em', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Methodology</div>
            <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '0 0 12px' }}>How Every Company Is Scored</h2>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.55, margin: '0 0 20px' }}>
              Composite 0–100 score from 9 value metrics weighted by their reliability as long-term signals (Buffett, Lynch &amp; Graham).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
              {[
                { label: 'FCF Yield 18%', desc: 'Free cash flow / market cap. Cash is king.', color: '#0ea5e9' },
                { label: 'EV/EBITDA 15%', desc: 'Enterprise value vs operating earnings.', color: '#8b5cf6' },
                { label: 'PEG Ratio 13%', desc: 'P/E adjusted for growth (Peter Lynch).', color: '#6366f1' },
                { label: 'ROE 12%', desc: 'Return on equity. Buffett target: >15%.', color: '#ec4899' },
                { label: 'P/FCF 10%', desc: 'Price vs free cash flow multiple.', color: '#f59e0b' },
                { label: 'Gross Margin 10%', desc: 'Pricing power moat. Buffett loves >40%.', color: '#10b981' },
                { label: 'Debt/Equity 9%', desc: 'Balance sheet leverage risk.', color: '#ef4444' },
                { label: 'Rev Growth 8%', desc: 'Top-line momentum. Business must grow.', color: '#84cc16' },
                { label: 'Price/Book 5%', desc: 'Asset floor — Graham margin of safety.', color: '#78716c' },
              ].map(f => (
                <div key={f.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', borderLeft: `4px solid ${f.color}` }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>{f.label}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { range: '70–100', label: 'UNDERVALUED', color: '#15803d', bg: '#dcfce7' },
                { range: '55–69', label: 'FAIR VALUE', color: '#1d4ed8', bg: '#dbeafe' },
                { range: '40–54', label: 'FAIRLY PRICED', color: '#b45309', bg: '#fef3c7' },
                { range: '0–39', label: 'EXPENSIVE', color: '#dc2626', bg: '#fee2e2' },
              ].map(r => (
                <div key={r.label} style={{ background: r.bg, borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: r.color }}>{r.range}</div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: r.color, letterSpacing: '0.08em', marginTop: '3px' }}>{r.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Layer sections */}
          <div style={{ padding: '24px 32px' }}>
            {LAYERS.map(layer => (
              <LayerSection key={layer} layer={layer} rows={byLayer[layer] ?? []} />
            ))}
          </div>

          {/* Closing */}
          <div style={{
            background: 'linear-gradient(150deg, #060d1a 0%, #0d1f3c 55%, #060d1a 100%)',
            padding: '72px 48px', textAlign: 'center',
          }}>
            <h2 style={{ fontSize: '38px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.1, margin: '0 0 16px' }}>
              Explore the full<br />live dashboard
            </h2>
            <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: 1.65, marginBottom: '28px' }}>
              Real-time value scores, fair value models, and layer analysis.
            </p>
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '14px 28px', marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', color: '#60a5fa', letterSpacing: '0.15em', fontWeight: 600, marginBottom: '6px' }}>LIVE AT</div>
              <div style={{ fontSize: '17px', color: 'white', fontWeight: 700, fontFamily: 'monospace' }}>DCF Dashboard · /ai-stack</div>
            </div>
            <p style={{ fontSize: '10px', color: '#475569' }}>Not investment advice. For educational purposes only. Always do your own research.</p>
          </div>

        </div>
      )}
    </>
  )
}
