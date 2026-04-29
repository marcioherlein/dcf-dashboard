'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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

function scoreColor(s: number) {
  if (s >= 70) return '#15803d'
  if (s >= 55) return '#0369a1'
  if (s >= 40) return '#b45309'
  return '#dc2626'
}
function scoreBg(s: number) {
  if (s >= 70) return '#dcfce7'
  if (s >= 55) return '#dbeafe'
  if (s >= 40) return '#fef3c7'
  return '#fee2e2'
}

// ─── Slide dimensions (pixels at 2× for sharp PDF) ───────────────────────────
// A4 portrait = 210×297mm. At 150dpi → 1240×1754px. We render at 794×1123px (96dpi)
// and scale up via html2canvas scale:2.
const W = 794   // px width (≈ 210mm @ 96dpi)
const H = 1123  // px height (≈ 297mm @ 96dpi)

// ─── Cover slide ─────────────────────────────────────────────────────────────

function CoverSlide() {
  const layerColors = Object.values(LAYER_COLORS)
  return (
    <div className="report-slide" style={{
      background: 'linear-gradient(170deg, #060d1a 0%, #0d1f3c 50%, #060d1a 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />
      <div style={{
        position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '380px', height: '380px',
        background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
        borderRadius: '50%',
      }} />

      <div style={{ position: 'relative', textAlign: 'center', padding: '0 48px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px', maxWidth: '260px', margin: '0 auto 40px' }}>
          {layerColors.map((c, i) => (
            <div key={i} style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: c, opacity: 0.9 }} />
          ))}
        </div>

        <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.35em', color: '#60a5fa', textTransform: 'uppercase', marginBottom: '18px' }}>
          Value Investor&apos;s Guide
        </div>

        <h1 style={{ fontSize: '58px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0 }}>
          The AI<br />Infrastructure<br />Stack
        </h1>

        <div style={{ width: '56px', height: '4px', borderRadius: '2px', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', margin: '28px auto' }} />

        <p style={{ fontSize: '17px', color: '#94a3b8', lineHeight: 1.7, maxWidth: '320px', margin: '0 auto 48px' }}>
          16 infrastructure layers<br />
          125+ public companies<br />
          scored by FCF yield, EV/EBITDA,<br />
          ROE, gross margin &amp; growth
        </p>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '100px', padding: '11px 24px',
        }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#4ade80' }} />
          <span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: 500 }}>Live data · DCF Dashboard · 2025</span>
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '7px',
        background: `linear-gradient(90deg, ${layerColors.join(', ')})`,
      }} />
    </div>
  )
}

// ─── Scoring slide ────────────────────────────────────────────────────────────

const SCORE_FACTORS = [
  { label: 'FCF Yield',    weight: '18%', desc: 'Free cash flow / market cap. Cash is king.', color: '#0ea5e9' },
  { label: 'EV/EBITDA',   weight: '15%', desc: 'Enterprise value vs operating earnings.', color: '#8b5cf6' },
  { label: 'PEG Ratio',   weight: '13%', desc: 'P/E adjusted for growth (Peter Lynch).', color: '#6366f1' },
  { label: 'ROE',         weight: '12%', desc: 'Return on equity. Buffett target: >15%.', color: '#ec4899' },
  { label: 'P/FCF',       weight: '10%', desc: 'Price vs free cash flow multiple.', color: '#f59e0b' },
  { label: 'Gross Margin',weight: '10%', desc: 'Pricing power moat. Buffett loves >40%.', color: '#10b981' },
  { label: 'Debt/Equity', weight: '9%',  desc: 'Balance sheet leverage risk.', color: '#ef4444' },
  { label: 'Rev Growth',  weight: '8%',  desc: 'Top-line momentum. Business must grow.', color: '#84cc16' },
  { label: 'Price/Book',  weight: '5%',  desc: 'Asset floor (Graham margin of safety).', color: '#78716c' },
]

const SCORE_RANGES = [
  { min: 70, label: 'UNDERVALUED',   color: '#15803d', bg: '#dcfce7', desc: 'Strong value across multiple metrics' },
  { min: 55, label: 'FAIR VALUE',    color: '#0369a1', bg: '#dbeafe', desc: 'Reasonably priced quality business' },
  { min: 40, label: 'FAIRLY PRICED', color: '#b45309', bg: '#fef3c7', desc: 'Price reflects fundamentals fairly' },
  { min: 0,  label: 'EXPENSIVE',     color: '#dc2626', bg: '#fee2e2', desc: 'Premium — limited margin of safety' },
]

function ScoringSlide() {
  return (
    <div className="report-slide" style={{ background: '#f8fafc', display: 'flex', flexDirection: 'column', padding: '32px 32px 28px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.3em', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
          Methodology
        </div>
        <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 8px' }}>
          How Every Company<br />Is Scored
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.55, margin: 0 }}>
          Composite 0–100 score from 9 value metrics. Weights follow Buffett, Lynch &amp; Graham frameworks.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        {SCORE_FACTORS.map(f => (
          <div key={f.label} style={{
            background: 'white', borderRadius: '9px', padding: '10px 12px',
            border: '1px solid #e2e8f0', borderLeft: `4px solid ${f.color}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{f.label}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: f.color, background: f.color + '15', borderRadius: '4px', padding: '1px 6px' }}>{f.weight}</span>
            </div>
            <p style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.35, margin: 0 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {SCORE_RANGES.map(r => (
          <div key={r.label} style={{
            background: r.bg, borderRadius: '9px', padding: '12px 14px',
            border: `1px solid ${r.color}30`,
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: r.color, lineHeight: 1, flexShrink: 0 }}>{r.min}+</div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: r.color, letterSpacing: '0.08em' }}>{r.label}</div>
              <div style={{ fontSize: '10px', color: r.color + 'bb', lineHeight: 1.3, marginTop: '2px' }}>{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Company table ────────────────────────────────────────────────────────────

function CompanyTable({ rows, accentColor }: { rows: ValuationMetrics[]; accentColor: string }) {
  const top = rows.filter(r => !r.error).sort((a, b) => b.valueScore - a.valueScore).slice(0, 5)
  if (!top.length) return <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '12px' }}>No data available</div>

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
      <thead>
        <tr style={{ borderBottom: `2px solid ${accentColor}30` }}>
          {['Ticker', 'Company', 'Score', 'P/E', 'FCF Yield', 'Gross Mgn'].map(h => (
            <th key={h} style={{
              padding: '5px 8px', textAlign: h === 'Ticker' || h === 'Company' ? 'left' : 'right',
              fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {top.map((r, i) => (
          <tr key={r.ticker} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
            <td style={{ padding: '7px 8px', fontFamily: 'monospace', fontWeight: 700, color: accentColor }}>{r.ticker}</td>
            <td style={{ padding: '7px 8px', color: '#1e293b', maxWidth: '130px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: '12px' }}>
              {r.name.replace(' Technologies', ' Tech').replace(' Corporation', ' Corp').replace(' Holdings', '').replace(' Platforms', '')}
            </td>
            <td style={{ padding: '7px 8px', textAlign: 'right' }}>
              <span style={{ display: 'inline-block', background: scoreBg(r.valueScore), color: scoreColor(r.valueScore), border: `1px solid ${scoreColor(r.valueScore)}40`, borderRadius: '5px', padding: '2px 8px', fontFamily: 'monospace', fontWeight: 700, fontSize: '12px' }}>
                {r.valueScore}
              </span>
            </td>
            <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace', color: r.pe && r.pe > 0 ? '#1e293b' : '#94a3b8' }}>{fmtNum(r.pe)}</td>
            <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace', color: r.fcfYield !== null ? (r.fcfYield >= 0.04 ? '#15803d' : r.fcfYield >= 0 ? '#b45309' : '#dc2626') : '#94a3b8' }}>{fmtPct(r.fcfYield)}</td>
            <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace', color: r.grossMargin !== null ? (r.grossMargin >= 0.4 ? '#15803d' : r.grossMargin >= 0.2 ? '#1e293b' : '#b45309') : '#94a3b8' }}>{fmtPctPlain(r.grossMargin)}</td>
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
  const moatStyle   = MOAT_HEX[info.moatRating]   ?? MOAT_HEX['Moderate']
  const marginStyle = MARGIN_HEX[info.marginRating] ?? MARGIN_HEX['Moderate']

  return (
    <div className="report-slide" style={{ background: '#fff', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(110deg, ${color} 0%, ${color}cc 100%)`, padding: '14px 22px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '9px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(255,255,255,0.2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', color: 'white' }}>
            L{layer}
          </div>
          <div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              Layer {layer} · AI Infrastructure Stack
            </div>
            <div style={{ fontSize: '21px', fontWeight: 800, color: 'white', lineHeight: 1.1 }}>{info.title}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '7px' }}>
          {[`Moat: ${info.moatRating}`, `Margins: ${info.marginRating}`].map(b => (
            <span key={b} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', padding: '3px 11px', fontSize: '11px', fontWeight: 700, color: 'white' }}>{b}</span>
          ))}
        </div>
      </div>

      {/* What They Do */}
      <div style={{ padding: '11px 22px 9px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
        <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '4px' }}>What They Do</div>
        <p style={{ fontSize: '12.5px', color: '#374151', lineHeight: 1.5, margin: 0 }}>{info.what}</p>
      </div>

      {/* Revenue | Moat */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
        <div style={{ padding: '10px 14px 9px 22px', borderRight: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '4px' }}>Revenue Model</div>
          <p style={{ fontSize: '12px', color: '#374151', lineHeight: 1.45, margin: 0 }}>{info.revenue}</p>
        </div>
        <div style={{ padding: '10px 22px 9px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.18em', textTransform: 'uppercase' }}>Moat</div>
            <span style={{ background: moatStyle.bg, color: moatStyle.text, border: `1px solid ${moatStyle.border}`, borderRadius: '4px', padding: '1px 6px', fontSize: '9px', fontWeight: 700 }}>{info.moatRating}</span>
          </div>
          <p style={{ fontSize: '12px', color: '#374151', lineHeight: 1.45, margin: 0 }}>{info.moat}</p>
        </div>
      </div>

      {/* Profitability */}
      <div style={{ padding: '9px 22px 8px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.18em', textTransform: 'uppercase' }}>Profitability</div>
          <span style={{ background: marginStyle.bg, color: marginStyle.text, border: `1px solid ${marginStyle.border}`, borderRadius: '4px', padding: '1px 6px', fontSize: '9px', fontWeight: 700 }}>{info.marginRating}</span>
        </div>
        <p style={{ fontSize: '12px', color: '#374151', lineHeight: 1.45, margin: 0 }}>{info.profitability}</p>
      </div>

      {/* Company table */}
      <div style={{ flex: 1, padding: '0 6px 4px' }}>
        <div style={{ padding: '7px 16px 2px', fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.18em', textTransform: 'uppercase' }}>Top Companies by Value Score</div>
        <CompanyTable rows={rows} accentColor={color} />
      </div>

      {/* Footer */}
      <div style={{ padding: '5px 22px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '9px', color: '#cbd5e1', fontWeight: 500 }}>Score: FCF Yield (18%) · EV/EBITDA (15%) · PEG (13%) · ROE (12%) · 5 more</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
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
      background: 'linear-gradient(170deg, #060d1a 0%, #0d1f3c 50%, #060d1a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', textAlign: 'center',
    }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <div style={{ position: 'relative', maxWidth: '380px', padding: '0 36px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '22px' }}>
          All 16 layers · 125+ companies · Live data
        </div>
        <h2 style={{ fontSize: '42px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '18px' }}>
          Explore the full<br />live dashboard
        </h2>
        <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: 1.65, marginBottom: '36px' }}>
          Real-time value scores, fair value models, and layer analysis — sourced from Yahoo Finance.
        </p>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '18px 32px', marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', color: '#60a5fa', letterSpacing: '0.15em', fontWeight: 600, marginBottom: '8px' }}>LIVE AT</div>
          <div style={{ fontSize: '19px', color: 'white', fontWeight: 700, fontFamily: 'monospace' }}>DCF Dashboard · /ai-stack</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '28px' }}>
          {['Value Scoring', 'Fair Value Models', 'Layer Intelligence', 'Risk-Averse Filter'].map(f => (
            <span key={f} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '100px', padding: '6px 14px', fontSize: '12px', color: '#cbd5e1', fontWeight: 500 }}>{f}</span>
          ))}
        </div>
        <p style={{ fontSize: '11px', color: '#475569', lineHeight: 1.6 }}>
          Not investment advice. For educational purposes only.<br />Always do your own research.
        </p>
      </div>

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: `linear-gradient(90deg, ${layerColors.join(', ')})` }} />
    </div>
  )
}

// ─── PDF download ─────────────────────────────────────────────────────────────

async function downloadPDF(container: HTMLDivElement) {
  const { default: jsPDF } = await import('jspdf')
  const { default: html2canvas } = await import('html2canvas')

  const slides = Array.from(container.querySelectorAll<HTMLElement>('.report-slide'))
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const canvas = await html2canvas(slide, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      width: W,
      height: H,
    })
    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    if (i > 0) pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297)
  }

  pdf.save('AI-Infrastructure-Stack.pdf')
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AIStackReport() {
  const [data, setData]         = useState<ValuationMetrics[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [exporting, setExport]  = useState(false)
  const slidesRef               = useRef<HTMLDivElement>(null)

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

  async function handleDownload() {
    if (!slidesRef.current) return
    setExport(true)
    try {
      await downloadPDF(slidesRef.current)
    } finally {
      setExport(false)
    }
  }

  return (
    <>
      <style>{`
        .report-slide {
          width: ${W}px;
          height: ${H}px;
          overflow: hidden;
          position: relative;
          background: white;
          margin: 0 auto 16px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.15);
          box-sizing: border-box;
          flex-shrink: 0;
        }
        .report-no-print { display: block; }
      `}</style>

      {/* Top bar */}
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
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>AI Infrastructure Stack · PDF Report · A4 Portrait</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {loading && <span style={{ color: '#60a5fa', fontSize: '12px' }}>⟳ Loading live data…</span>}
          {exporting && <span style={{ color: '#facc15', fontSize: '12px' }}>⟳ Generating PDF… ({LAYERS.length + 2} slides)</span>}
          <button
            onClick={handleDownload}
            disabled={loading || exporting}
            style={{
              background: loading || exporting ? '#334155' : '#3b82f6',
              color: 'white', border: 'none', borderRadius: '8px',
              padding: '8px 20px', fontSize: '13px', fontWeight: 600,
              cursor: loading || exporting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <span>⬇</span> {exporting ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="report-no-print" style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>⟳</div>
          <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Loading ~125 tickers from Yahoo Finance…</p>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>First load takes ~15 seconds. The PDF button will activate when ready.</p>
        </div>
      )}

      {error && (
        <div className="report-no-print" style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>Error: {error}</div>
      )}

      {/* Slides container */}
      <div style={{ overflowX: 'auto', padding: loading ? '0' : '24px 0', background: '#e2e8f0' }}>
        <div ref={slidesRef}>
          {!loading && (
            <>
              <CoverSlide />
              <ScoringSlide />
              {LAYERS.map(layer => (
                <LayerSlide key={layer} layer={layer} rows={byLayer[layer] ?? []} />
              ))}
              <ClosingSlide />
            </>
          )}
        </div>
      </div>
    </>
  )
}
