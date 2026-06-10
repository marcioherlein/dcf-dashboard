/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import { VERDICT_DISPLAY, SITE_URL, BRAND, type VerdictKey } from '@/lib/brand'

export const runtime = 'edge'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number, currency: string) {
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : currency + ' '
  if (v >= 1_000_000) return sym + (v / 1_000_000).toFixed(2) + 'M'
  if (v >= 1_000)     return sym + (v / 1_000).toFixed(1) + 'k'
  return sym + v.toFixed(2)
}

function fmtPct(v: number) {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`
}

function migInterp(mig: number | null, migA: number | null) {
  if (!mig || !migA) return null
  const ratio = mig / migA
  if (ratio < 0.8) return { label: 'Conservative', color: '#047857', bg: '#ECFDF3', border: '#BBF7D0' }
  if (ratio < 1.2) return { label: 'Reasonable',   color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' }
  if (ratio < 1.6) return { label: 'Aggressive',   color: '#D97706', bg: '#FFF7ED', border: '#FED7AA' }
  return             { label: 'Very Aggressive', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' }
}

// Plain-English translation of criterion labels
const CRITERION_PLAIN: Record<string, string> = {
  'DCF upside ≥ 15%':           'Trading below DCF estimate',
  'Fair valuation (PEG)':        'Reasonably valued on growth',
  'P/FCF vs sector':             'FCF yield is healthy',
  'Positive cash flow':          'Generating free cash flow',
  'High ROIC (> WACC)':          'Earning above cost of capital',
  'Competitive moat (F-score)':  'Strong financial health',
  'Consistent margins':          'Margins stable or growing',
  'Strong balance sheet':        'Low insolvency risk',
  'Management quality':          'No accounting red flags',
  'Revenue growth (3Y CAGR)':    'Revenue growing +5% annually',
  'EPS growth outlook':          'Earnings growth expected',
  'Analyst consensus':           'Analysts recommend buying',
  'Analyst target upside >10%':  'Analyst target implies upside',
  'Price within 52W range':      'Price not overstretched',
  'Insider ownership >5%':       'Insiders own meaningful stake',
  'Short interest low (<5%)':    'Low short-seller pressure',
}

function toPlain(label: string): string {
  return CRITERION_PLAIN[label] ?? label
}

// ── route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const p           = req.nextUrl.searchParams
  const ticker      = (p.get('ticker') ?? 'TICKER').toUpperCase()
  const name        = p.get('name') ?? ''
  const priceRaw    = parseFloat(p.get('price') ?? '0')
  const fvParam     = p.get('fv')
  const fvRaw       = fvParam && fvParam !== 'none' ? parseFloat(fvParam) : null
  const upsideParam = p.get('upside')
  const upsideRaw   = upsideParam && upsideParam !== 'none' ? parseFloat(upsideParam) : null
  const bearRaw     = p.get('bear') ? parseFloat(p.get('bear')!) : null
  const bullRaw     = p.get('bull') ? parseFloat(p.get('bull')!) : null
  const currency    = p.get('currency') ?? 'USD'
  const verdict     = (p.get('verdict') ?? 'Insufficient Data') as VerdictKey
  const conviction  = p.get('conviction') ?? ''
  const migRaw      = p.get('mig') ? parseFloat(p.get('mig')!) : null
  const migAssumed  = p.get('migAssumed') ? parseFloat(p.get('migAssumed')!) : null
  const dateStr     = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // Conviction / checklist
  const checkPassed = p.get('checkPassed') ? parseInt(p.get('checkPassed')!) : null
  const checkTotal  = p.get('checkTotal')  ? parseInt(p.get('checkTotal')!)  : null
  const checkLabel  = p.get('checkLabel')  ?? ''

  // Passing + failing bullets (pipe-separated, comma-split per group)
  const passBulletsRaw  = p.get('passBullets')  ?? ''
  const failBulletsRaw  = p.get('failBullets')  ?? ''
  const passBullets = passBulletsRaw ? passBulletsRaw.split('|').slice(0, 3) : []
  const failBullets = failBulletsRaw ? failBulletsRaw.split('|').slice(0, 1) : []

  // Valuation methods (JSON array: [{label, fv}])
  let methods: Array<{ label: string; fv: number }> = []
  try {
    const m = p.get('methods')
    if (m) methods = JSON.parse(decodeURIComponent(m)).slice(0, 3)
  } catch { /* ignore */ }

  const vd         = VERDICT_DISPLAY[verdict] ?? VERDICT_DISPLAY['Insufficient Data']
  const price       = priceRaw
  const fv          = fvRaw
  const upside      = upsideRaw
  const isUp        = (upside ?? 0) >= 0
  const upsideStr   = upside != null ? fmtPct(upside) : null
  const upsideColor = upside == null ? '#64748B' : isUp ? BRAND.positive : BRAND.negative
  const upBg        = upside == null ? '#F1F5F9' : isUp ? BRAND.positiveSoft : BRAND.negativeSoft

  // Description sentence
  let descLine = 'Insufficient data to form a reliable estimate.'
  if (upside != null) {
    const absPct = Math.abs(upside * 100).toFixed(0)
    if (upside > 0.10)    descLine = `Our models estimate ${absPct}% upside to fair value.`
    else if (upside > 0.05)  descLine = `Models suggest ${absPct}% potential upside from here.`
    else if (upside >= -0.10) descLine = 'Trading close to intrinsic value — limited upside or downside.'
    else descLine = `The stock trades ${absPct}% above our intrinsic value estimate.`
  }

  const interp = migInterp(migRaw, migAssumed)

  // Scenario bar
  const bear = bearRaw, bull = bullRaw
  const hasScenar = bear != null && bull != null && bull > bear
  let basePx: number | null = null, pricePx: number | null = null
  const TRACK_W = 720
  if (hasScenar && bear != null && bull != null) {
    const range = bull - bear
    basePx  = fv != null  ? Math.max(0, Math.min(TRACK_W, ((fv    - bear) / range) * TRACK_W)) : TRACK_W / 2
    pricePx = price > 0   ? Math.max(0, Math.min(TRACK_W, ((price - bear) / range) * TRACK_W)) : null
  }

  // Conviction score label
  const convictionColor = checkLabel === 'Strong'
    ? BRAND.positive
    : checkLabel === 'Mixed' ? BRAND.warn : BRAND.negative
  const convictionBg = checkLabel === 'Strong'
    ? BRAND.positiveSoft
    : checkLabel === 'Mixed' ? BRAND.warnSoft : BRAND.negativeSoft

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex', flexDirection: 'column',
          width: 1080, height: 1350,
          background: '#FFFFFF',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '52px 64px 44px',
          gap: 0,
        }}
      >

        {/* ── HEADER ─────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: BRAND.olive700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: '#fff' }} />
            </div>
            <span style={{ fontSize: 22, fontWeight: 700, color: BRAND.ink900, letterSpacing: '-0.02em' }}>insic</span>
          </div>
          <span style={{ fontSize: 13, color: '#9B9B9B', fontWeight: 400 }}>{dateStr}</span>
        </div>

        {/* ── HERO: TICKER + VERDICT ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 40 }}>
          {/* Ticker row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 72, fontWeight: 800, color: BRAND.ink900, letterSpacing: '-0.04em', lineHeight: 1 }}>
                ${ticker}
              </span>
              {name && (
                <span style={{ fontSize: 18, color: '#6B6B6B', fontWeight: 400, letterSpacing: '-0.01em', marginTop: 4 }}>
                  {name.length > 36 ? name.slice(0, 34) + '…' : name}
                </span>
              )}
              {conviction && (
                <span style={{ fontSize: 14, color: '#9B9B9B', fontWeight: 400, marginTop: 2 }}>
                  {conviction}
                </span>
              )}
            </div>
            {/* Verdict chip */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: vd.bgHex, border: `2px solid ${vd.borderHex}`, borderRadius: 16,
              padding: '12px 24px', marginTop: 8, flexShrink: 0,
            }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: vd.colorHex, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {vd.word}
              </span>
            </div>
          </div>

          {/* Description */}
          <div style={{
            marginTop: 20,
            background: '#F9F8F6', borderRadius: 12,
            padding: '16px 20px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <span style={{ fontSize: 16, color: '#111111', fontWeight: 500, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: vd.colorHex }}>${ticker} looks {vd.word.toLowerCase()}.</span>
              {' '}{descLine}
            </span>
          </div>
        </div>

        {/* ── FAIR VALUE ROW ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
          {fv != null && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', gap: 4,
              background: '#F9F8F6', borderRadius: 12, padding: '16px 20px',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Fair Value</span>
              <span style={{ fontSize: 30, fontWeight: 800, color: '#111111', fontFamily: 'DM Mono, monospace', letterSpacing: '-0.02em' }}>
                {fmt(fv, currency)}
              </span>
            </div>
          )}
          {price > 0 && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', gap: 4,
              background: '#F9F8F6', borderRadius: 12, padding: '16px 20px',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Price</span>
              <span style={{ fontSize: 30, fontWeight: 800, color: '#111111', fontFamily: 'DM Mono, monospace', letterSpacing: '-0.02em' }}>
                {fmt(price, currency)}
              </span>
            </div>
          )}
          {upsideStr && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', gap: 4,
              background: upBg, borderRadius: 12, padding: '16px 20px',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Upside</span>
              <span style={{ fontSize: 30, fontWeight: 800, color: upsideColor, fontFamily: 'DM Mono, monospace', letterSpacing: '-0.02em' }}>
                {upsideStr}
              </span>
            </div>
          )}
        </div>

        {/* ── SCENARIO BAR ─────────────────────────────────────────────────────── */}
        {hasScenar && bear != null && bull != null && (
          <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: 'relative', height: 10, borderRadius: 9999, background: '#E5E5E5', width: TRACK_W }}>
              {pricePx != null && (
                <div style={{ position: 'absolute', top: -3, left: pricePx - 1, width: 2, height: 16, background: '#566174', borderRadius: 2 }} />
              )}
              {basePx != null && (
                <div style={{ position: 'absolute', top: '50%', left: basePx - 7, marginTop: -7, width: 14, height: 14, borderRadius: 7, background: BRAND.olive700, border: '3px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: TRACK_W }}>
              <span style={{ fontSize: 13, color: BRAND.negative, fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>↓ Bear {fmt(bear, currency)}</span>
              <span style={{ fontSize: 13, color: BRAND.olive700, fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>↑ Bull {fmt(bull, currency)}</span>
            </div>
          </div>
        )}

        {/* ── VALUATION MODELS ─────────────────────────────────────────────────── */}
        {methods.length > 0 && (
          <div style={{
            marginBottom: 28,
            background: '#F9F8F6', borderRadius: 14,
            padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              What {methods.length} models say
            </span>
            <div style={{ display: 'flex', gap: 12 }}>
              {methods.map((m) => (
                <div key={m.label} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', gap: 4,
                  background: '#FFFFFF', borderRadius: 10, padding: '12px 14px',
                  border: '1px solid #E5E5E5',
                }}>
                  <span style={{ fontSize: 11, color: '#9B9B9B', fontWeight: 600, letterSpacing: '0.03em' }}>
                    {m.label.replace('Forward ', '').replace(' Multiple', '')}
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#111111', fontFamily: 'DM Mono, monospace' }}>
                    {fmt(m.fv, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CONVICTION ───────────────────────────────────────────────────────── */}
        {(checkPassed != null || passBullets.length > 0) && (
          <div style={{
            marginBottom: 28,
            background: '#F9F8F6', borderRadius: 14,
            padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Conviction
              </span>
              {checkPassed != null && checkTotal != null && checkLabel && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: convictionBg, borderRadius: 9999,
                  padding: '5px 14px',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: convictionColor }}>
                    {checkLabel}
                  </span>
                  <span style={{ fontSize: 12, color: convictionColor, opacity: 0.75 }}>
                    {checkPassed}/{checkTotal} signals
                  </span>
                </div>
              )}
            </div>

            {/* Pass bullets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {passBullets.map((b) => (
                <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 10, background: BRAND.positiveSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: BRAND.positive }}>✓</span>
                  </div>
                  <span style={{ fontSize: 15, color: '#111111', fontWeight: 500 }}>{b}</span>
                </div>
              ))}
              {failBullets.map((b) => (
                <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 10, background: BRAND.negativeSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: BRAND.negative }}>✗</span>
                  </div>
                  <span style={{ fontSize: 15, color: '#6B6B6B', fontWeight: 400 }}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── WHAT THE PRICE IMPLIES ───────────────────────────────────────────── */}
        {interp && migRaw != null && migAssumed != null && (
          <div style={{
            marginBottom: 28,
            background: interp.bg, borderRadius: 14,
            border: `1px solid ${interp.border}`,
            padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                What the price implies
              </span>
              <div style={{
                background: interp.bg, border: `1.5px solid ${interp.border}`,
                borderRadius: 9999, padding: '4px 12px',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: interp.color }}>{interp.label}</span>
              </div>
            </div>
            <span style={{ fontSize: 15, color: '#111111', fontWeight: 500, lineHeight: 1.5 }}>
              At {fmt(price, currency)}, the market expects{' '}
              <span style={{ fontWeight: 700 }}>{(migRaw * 100).toFixed(1)}% annual growth</span>
              {' '}over 5 years. Our model assumes {(migAssumed * 100).toFixed(1)}%.
            </span>
          </div>
        )}

        {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #E5E5E5' }}>
          <span style={{ fontSize: 12, color: '#9B9B9B', fontWeight: 400 }}>
            Not financial advice · model output only
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.olive700 }}>
            {SITE_URL}
          </span>
        </div>

      </div>
    ),
    {
      width: 1080,
      height: 1350,
    }
  )
}
