/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import { VERDICT_DISPLAY, SITE_URL, BRAND, type VerdictKey } from '@/lib/brand'

export const runtime = 'edge'

function fmt(v: number, currency: string) {
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : currency + ' '
  if (v >= 1_000_000) return sym + (v / 1_000_000).toFixed(2) + 'M'
  if (v >= 1_000)     return sym + (v / 1_000).toFixed(1) + 'k'
  return sym + v.toFixed(2)
}

function fmtPct(v: number) {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`
}

function migLabel(mig: number | null, migA: number | null): { label: string; color: string; bg: string } | null {
  if (!mig || !migA) return null
  const r = mig / migA
  if (r < 0.8) return { label: 'Conservative', color: '#047857', bg: '#ECFDF3' }
  if (r < 1.2) return { label: 'Reasonable',   color: '#2563EB', bg: '#EFF6FF' }
  if (r < 1.6) return { label: 'Aggressive',   color: '#D97706', bg: '#FFF7ED' }
  return           { label: 'Very Aggressive', color: '#DC2626', bg: '#FEF2F2' }
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams

  const ticker   = (p.get('ticker') ?? 'TICKER').toUpperCase()
  const name     = p.get('name') ?? ''
  const verdict  = (p.get('verdict') ?? 'Insufficient Data') as VerdictKey
  const _conv    = p.get('conviction') ?? ''
  const currency = p.get('currency') ?? 'USD'

  const priceRaw  = parseFloat(p.get('price')  ?? '0')
  const fvRaw     = parseFloat(p.get('fv')      ?? '')
  const upRaw     = parseFloat(p.get('upside')  ?? '')
  const bearRaw   = parseFloat(p.get('bear')    ?? '')
  const bullRaw   = parseFloat(p.get('bull')    ?? '')
  const migRaw    = parseFloat(p.get('mig')     ?? '')
  const migARaw   = parseFloat(p.get('migAssumed') ?? '')
  const peRaw     = parseFloat(p.get('pe')      ?? '')
  const peHistRaw = p.get('peHist') ?? '' // pipe-separated: "2020:22.1|2021:28.4|..."

  const price = isNaN(priceRaw) ? 0    : priceRaw
  const fv    = isNaN(fvRaw)    ? null : fvRaw
  const up    = isNaN(upRaw)    ? null : upRaw
  const bear  = isNaN(bearRaw)  ? null : bearRaw
  const bull  = isNaN(bullRaw)  ? null : bullRaw
  const mig   = isNaN(migRaw)   ? null : migRaw
  const migA  = isNaN(migARaw)  ? null : migARaw
  const pe    = isNaN(peRaw)    ? null : peRaw

  // Parse pipe-separated PE history: "2020:22.1|2021:28.4|2022:18.0|2023:24.5|2024:28.1"
  const peHistory: Array<{ year: string; pe: number }> = peHistRaw
    ? peHistRaw.split('|').map(s => { const [y, v] = s.split(':'); return { year: y, pe: parseFloat(v) } }).filter(x => !isNaN(x.pe))
    : []

  const chkP = parseInt(p.get('checkPassed') ?? '') || null
  const chkT = parseInt(p.get('checkTotal')  ?? '') || null
  const chkL = p.get('checkLabel') ?? ''

  const passBullets = (p.get('passBullets') ?? '').split('|').filter(Boolean).slice(0, 3)
  const failBullets = (p.get('failBullets') ?? '').split('|').filter(Boolean).slice(0, 1)

  let methods: Array<{ label: string; fv: number }> = []
  try {
    const raw = p.get('methods')
    if (raw) methods = JSON.parse(decodeURIComponent(raw)).filter((x: { fv: number }) => x.fv > 0).slice(0, 3)
  } catch { /* ignore */ }

  const vd      = VERDICT_DISPLAY[verdict] ?? VERDICT_DISPLAY['Insufficient Data']
  const isUp    = (up ?? 0) >= 0
  const upStr   = up != null ? fmtPct(up) : null
  const upColor = up == null ? '#64748B' : isUp ? BRAND.positive : BRAND.negative
  const upBg    = up == null ? '#F1F5F9' : isUp ? BRAND.positiveSoft : BRAND.negativeSoft
  const migInfo = migLabel(mig, migA)
  const hasScenar = bear != null && bull != null && !isNaN(bear) && !isNaN(bull) && bull > bear

  const descLine = (() => {
    if (up == null) return 'Insufficient data to form a reliable estimate.'
    const pct = Math.abs(up * 100).toFixed(0)
    if (up > 0.10)   return `Our models estimate ${pct}% upside to fair value.`
    if (up > 0.05)   return `Models suggest ${pct}% potential upside from here.`
    if (up >= -0.10) return 'Trading close to intrinsic value — limited upside or downside.'
    return `The stock trades ${pct}% above our intrinsic value estimate.`
  })()

  const chkColor = chkL === 'Strong' ? BRAND.positive : chkL === 'Mixed' ? BRAND.warn : BRAND.negative
  const chkBg    = chkL === 'Strong' ? BRAND.positiveSoft : chkL === 'Mixed' ? BRAND.warnSoft : BRAND.negativeSoft

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // Scenario bar pixel math
  const TRACK_W = 800
  const scenarRange = hasScenar && bear != null && bull != null ? bull - bear : 1
  const basePx  = hasScenar && fv    != null && bear != null ? Math.max(4, Math.min(TRACK_W - 4, ((fv    - bear!) / scenarRange) * TRACK_W)) : TRACK_W / 2
  const pricePx = hasScenar && price  > 0   && bear != null ? Math.max(4, Math.min(TRACK_W - 4, ((price - bear!) / scenarRange) * TRACK_W)) : null

  // Conviction score
  const convPct = chkP != null && chkT != null && chkT > 0 ? chkP / chkT : null

  // Company logo (Clearbit) — edge runtime will render or show olive bg fallback
  const logoUrl = `https://logo.clearbit.com/${ticker.toLowerCase()}.com`

  // PE mini-bar chart
  const showPeChart = peHistory.length >= 2
  const PE_BAR_W = 776
  const PE_BAR_MAX_H = 48
  const peMax = Math.max(...peHistory.map(x => x.pe), 1)
  const peBarW = peHistory.length > 0 ? Math.floor((PE_BAR_W - (peHistory.length - 1) * 6) / peHistory.length) : 40

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: 1080, height: 1350, background: '#FFFFFF', fontFamily: 'system-ui,-apple-system,sans-serif', padding: '48px 60px 40px' }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          {/* insic logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', width: 30, height: 30, borderRadius: 8, background: BRAND.olive700, alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ display: 'flex', width: 10, height: 10, borderRadius: 5, background: '#fff' }} />
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: BRAND.ink900, letterSpacing: '-0.03em' }}>insic</span>
          </div>
          <span style={{ fontSize: 13, color: '#9B9B9B' }}>{dateStr}</span>
        </div>

        {/* ── STOCK IDENTITY ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Company logo — Clearbit with letter fallback */}
            <div style={{ display: 'flex', width: 56, height: 56, borderRadius: 14, overflow: 'hidden', border: '1.5px solid #E5E5E5', background: BRAND.olive700, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} width={56} height={56} style={{ objectFit: 'cover' }} alt="" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 42, fontWeight: 800, color: BRAND.ink900, letterSpacing: '-0.03em', lineHeight: 1 }}>${ticker}</span>
              {name && <span style={{ fontSize: 15, color: '#6B6B6B', fontWeight: 400 }}>{name.length > 40 ? name.slice(0, 38) + '…' : name}</span>}
            </div>
          </div>
          {/* Verdict badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: vd.bgHex, border: `2px solid ${vd.borderHex}`, borderRadius: 14, padding: '10px 22px', flexShrink: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: vd.colorHex, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{vd.word}</span>
          </div>
        </div>

        {/* ── DESCRIPTION STRIP ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24, background: '#F9F8F6', borderRadius: 12, padding: '14px 18px' }}>
          <span style={{ fontSize: 16, color: vd.colorHex, fontWeight: 700 }}>${ticker} looks {vd.word.toLowerCase()}.</span>
          <span style={{ fontSize: 14, color: '#444444', lineHeight: 1.5 }}>{descLine}</span>
        </div>

        {/* ── FAIR VALUE ROW ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {fv != null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, background: '#F9F8F6', borderRadius: 12, padding: '12px 16px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Fair Value</span>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#111111', fontFamily: 'monospace' }}>{fmt(fv, currency)}</span>
            </div>
          )}
          {price > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, background: '#F9F8F6', borderRadius: 12, padding: '12px 16px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Price</span>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#111111', fontFamily: 'monospace' }}>{fmt(price, currency)}</span>
            </div>
          )}
          {upStr && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, background: upBg, borderRadius: 12, padding: '12px 16px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Upside</span>
              <span style={{ fontSize: 26, fontWeight: 800, color: upColor, fontFamily: 'monospace' }}>{upStr}</span>
            </div>
          )}
        </div>

        {/* ── SCENARIO BAR ── */}
        {hasScenar && bear != null && bull != null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            <div style={{ display: 'flex', position: 'relative', height: 10, borderRadius: 9999, background: '#E5E5E5', width: TRACK_W }}>
              {pricePx != null && (
                <div style={{ display: 'flex', position: 'absolute', top: -2, left: pricePx - 1, width: 2, height: 14, background: '#566174', borderRadius: 2 }} />
              )}
              <div style={{ display: 'flex', position: 'absolute', top: -3, left: basePx - 8, width: 16, height: 16, borderRadius: 8, background: BRAND.olive700, border: '3px solid #fff' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: TRACK_W }}>
              <span style={{ fontSize: 12, color: BRAND.negative, fontFamily: 'monospace', fontWeight: 600 }}>Bear {fmt(bear, currency)}</span>
              <span style={{ fontSize: 12, color: BRAND.olive700, fontFamily: 'monospace', fontWeight: 600 }}>Bull {fmt(bull, currency)}</span>
            </div>
          </div>
        )}

        {/* ── CONVICTION SCORE ── */}
        {chkP != null && chkT != null && chkT > 0 && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, background: '#F9F8F6', borderRadius: 14, padding: '16px 20px', alignItems: 'center' }}>
            {/* Score ring */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0 }}>
              <div style={{ display: 'flex', width: 64, height: 64, borderRadius: 32, background: chkBg, alignItems: 'center', justifyContent: 'center', border: `4px solid ${chkColor}` }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: chkColor }}>{Math.round(convPct! * 100)}</span>
              </div>
              <span style={{ fontSize: 10, color: '#9B9B9B', fontWeight: 600, marginTop: 4 }}>/ 100</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Conviction Score</span>
                <div style={{ display: 'flex', background: chkBg, borderRadius: 9999, padding: '4px 12px' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: chkColor }}>{chkL} · {chkP}/{chkT} signals</span>
                </div>
              </div>
              {/* Signal bullets — use + / - text to avoid unicode rendering issues */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {passBullets.slice(0, 2).map((b) => (
                  <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 9, background: BRAND.positiveSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: BRAND.positive, lineHeight: 1 }}>+</span>
                    </div>
                    <span style={{ fontSize: 13, color: '#111111', fontWeight: 500 }}>{b}</span>
                  </div>
                ))}
                {failBullets.slice(0, 1).map((b) => (
                  <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 9, background: BRAND.negativeSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: BRAND.negative, lineHeight: 1 }}>-</span>
                    </div>
                    <span style={{ fontSize: 13, color: '#6B6B6B' }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── VALUATION MODELS ── */}
        {methods.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, background: '#F9F8F6', borderRadius: 14, padding: '16px 20px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>What {methods.length} models say</span>
            <div style={{ display: 'flex', gap: 10 }}>
              {methods.map((m) => (
                <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, background: '#FFFFFF', borderRadius: 10, padding: '10px 12px', border: '1px solid #E5E5E5' }}>
                  <span style={{ fontSize: 10, color: '#9B9B9B', fontWeight: 600 }}>{m.label.replace('Forward ', '').replace(' Multiple', '')}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#111111', fontFamily: 'monospace' }}>{fmt(m.fv, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── P/E HISTORY CHART ── */}
        {(showPeChart || pe != null) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, background: '#F9F8F6', borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>P/E Ratio History</span>
              {pe != null && <span style={{ fontSize: 13, fontWeight: 700, color: '#111111', fontFamily: 'monospace' }}>Current: {pe.toFixed(1)}×</span>}
            </div>
            {showPeChart ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: PE_BAR_MAX_H + 20 }}>
                {peHistory.map(({ year, pe: v }) => {
                  const barH = Math.max(6, Math.round((v / peMax) * PE_BAR_MAX_H))
                  const isCurrent = pe != null && Math.abs(v - pe) < 0.5
                  return (
                    <div key={year} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: peBarW }}>
                      <span style={{ fontSize: 10, color: isCurrent ? BRAND.olive700 : '#9B9B9B', fontWeight: isCurrent ? 700 : 400 }}>{v.toFixed(0)}×</span>
                      <div style={{ display: 'flex', width: peBarW, height: barH, background: isCurrent ? BRAND.olive700 : '#D1D5DB', borderRadius: 3 }} />
                      <span style={{ fontSize: 9, color: '#9B9B9B' }}>{year}</span>
                    </div>
                  )
                })}
              </div>
            ) : pe != null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', height: 8, flex: 1, background: '#E5E5E5', borderRadius: 9999 }}>
                  <div style={{ display: 'flex', height: 8, width: `${Math.min(100, (pe / 50) * 100)}%`, background: BRAND.olive700, borderRadius: 9999 }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111111', fontFamily: 'monospace' }}>{pe.toFixed(1)}×</span>
              </div>
            ) : null}
          </div>
        )}

        {/* ── MARKET IMPLIED ── */}
        {migInfo && mig != null && migA != null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20, background: migInfo.bg, borderRadius: 14, padding: '14px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>What the price implies</span>
              <div style={{ display: 'flex', borderRadius: 9999, padding: '3px 10px', background: 'rgba(255,255,255,0.5)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: migInfo.color }}>{migInfo.label}</span>
              </div>
            </div>
            <span style={{ fontSize: 13, color: '#111111', lineHeight: 1.5 }}>
              {`At ${fmt(price, currency)}, the market expects ${(mig * 100).toFixed(1)}% annual growth over 5 years. Our model assumes ${(migA * 100).toFixed(1)}%.`}
            </span>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #E5E5E5' }}>
          <span style={{ fontSize: 11, color: '#9B9B9B' }}>Not financial advice · model output only</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.olive700 }}>{SITE_URL}</span>
        </div>

      </div>
    ),
    { width: 1080, height: 1350 }
  )
}
