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
  const conv     = p.get('conviction') ?? ''
  const currency = p.get('currency') ?? 'USD'

  const priceRaw  = parseFloat(p.get('price')  ?? '0')
  const fvRaw     = parseFloat(p.get('fv')      ?? '')
  const upRaw     = parseFloat(p.get('upside')  ?? '')
  const bearRaw   = parseFloat(p.get('bear')    ?? '')
  const bullRaw   = parseFloat(p.get('bull')    ?? '')
  const migRaw    = parseFloat(p.get('mig')     ?? '')
  const migARaw   = parseFloat(p.get('migAssumed') ?? '')

  const price = isNaN(priceRaw)  ? 0    : priceRaw
  const fv    = isNaN(fvRaw)     ? null : fvRaw
  const up    = isNaN(upRaw)     ? null : upRaw
  const bear  = isNaN(bearRaw)   ? null : bearRaw
  const bull  = isNaN(bullRaw)   ? null : bullRaw
  const mig   = isNaN(migRaw)    ? null : migRaw
  const migA  = isNaN(migARaw)   ? null : migARaw

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

  const vd        = VERDICT_DISPLAY[verdict] ?? VERDICT_DISPLAY['Insufficient Data']
  const isUp      = (up ?? 0) >= 0
  const upStr     = up != null ? fmtPct(up) : null
  const upColor   = up == null ? '#64748B' : isUp ? BRAND.positive : BRAND.negative
  const upBg      = up == null ? '#F1F5F9' : isUp ? BRAND.positiveSoft : BRAND.negativeSoft
  const migInfo   = migLabel(mig, migA)
  const hasScenar = bear != null && bull != null && !isNaN(bear) && !isNaN(bull) && bull > bear

  const descLine = (() => {
    if (up == null) return 'Insufficient data to form a reliable estimate.'
    const pct = Math.abs(up * 100).toFixed(0)
    if (up > 0.10)    return `Our models estimate ${pct}% upside to fair value.`
    if (up > 0.05)    return `Models suggest ${pct}% potential upside from here.`
    if (up >= -0.10)  return 'Trading close to intrinsic value — limited upside or downside.'
    return `The stock trades ${pct}% above our intrinsic value estimate.`
  })()

  const chkColor = chkL === 'Strong' ? BRAND.positive : chkL === 'Mixed' ? BRAND.warn : BRAND.negative
  const chkBg    = chkL === 'Strong' ? BRAND.positiveSoft : chkL === 'Mixed' ? BRAND.warnSoft : BRAND.negativeSoft

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // Scenario bar pixel math
  const TRACK_W = 800
  const scenarRange = hasScenar && bear != null && bull != null ? bull - bear : 1
  const basePx  = hasScenar && fv  != null && bear != null ? Math.max(4, Math.min(TRACK_W - 4, ((fv    - bear!) / scenarRange) * TRACK_W)) : TRACK_W / 2
  const pricePx = hasScenar && price > 0  && bear != null ? Math.max(4, Math.min(TRACK_W - 4, ((price - bear!) / scenarRange) * TRACK_W)) : null

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: 1080, height: 1350, background: '#FFFFFF', fontFamily: 'system-ui,-apple-system,sans-serif', padding: '52px 64px 44px' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', width: 28, height: 28, borderRadius: 7, background: BRAND.olive700, alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 4, background: '#fff' }} />
            </div>
            <span style={{ fontSize: 22, fontWeight: 700, color: BRAND.ink900, letterSpacing: '-0.02em' }}>insic</span>
          </div>
          <span style={{ fontSize: 13, color: '#9B9B9B' }}>{dateStr}</span>
        </div>

        {/* HERO */}
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 72, fontWeight: 800, color: BRAND.ink900, letterSpacing: '-0.04em', lineHeight: 1 }}>${ticker}</span>
              {name
                ? <span style={{ fontSize: 18, color: '#6B6B6B', fontWeight: 400 }}>{name.length > 36 ? name.slice(0, 34) + '…' : name}</span>
                : <span style={{ fontSize: 18, color: '#6B6B6B' }}> </span>
              }
              {conv
                ? <span style={{ fontSize: 14, color: '#9B9B9B' }}>{conv}</span>
                : null
              }
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: vd.bgHex, border: `2px solid ${vd.borderHex}`, borderRadius: 16, padding: '12px 24px', marginTop: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: vd.colorHex, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{vd.word}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 20, background: '#F9F8F6', borderRadius: 12, padding: '16px 20px' }}>
            <span style={{ fontSize: 17, color: vd.colorHex, fontWeight: 700 }}>${ticker} looks {vd.word.toLowerCase()}.</span>
            <span style={{ fontSize: 15, color: '#444444', fontWeight: 400, lineHeight: 1.5 }}>{descLine}</span>
          </div>
        </div>

        {/* FAIR VALUE ROW */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {fv != null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, background: '#F9F8F6', borderRadius: 12, padding: '14px 18px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Fair Value</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#111111', fontFamily: 'monospace' }}>{fmt(fv, currency)}</span>
            </div>
          )}
          {price > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, background: '#F9F8F6', borderRadius: 12, padding: '14px 18px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Price</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#111111', fontFamily: 'monospace' }}>{fmt(price, currency)}</span>
            </div>
          )}
          {upStr && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, background: upBg, borderRadius: 12, padding: '14px 18px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Upside</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: upColor, fontFamily: 'monospace' }}>{upStr}</span>
            </div>
          )}
        </div>

        {/* SCENARIO BAR */}
        {hasScenar && bear != null && bull != null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative', height: 12, borderRadius: 9999, background: '#E5E5E5', width: TRACK_W }}>
              {pricePx != null && (
                <div style={{ display: 'flex', position: 'absolute', top: -2, left: pricePx - 1, width: 2, height: 16, background: '#566174', borderRadius: 2 }} />
              )}
              <div style={{ display: 'flex', position: 'absolute', top: -2, left: basePx - 8, width: 16, height: 16, borderRadius: 8, background: BRAND.olive700, border: '3px solid #fff' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: TRACK_W }}>
              <span style={{ fontSize: 13, color: BRAND.negative, fontFamily: 'monospace', fontWeight: 600 }}>Bear {fmt(bear, currency)}</span>
              <span style={{ fontSize: 13, color: BRAND.olive700, fontFamily: 'monospace', fontWeight: 600 }}>Bull {fmt(bull, currency)}</span>
            </div>
          </div>
        )}

        {/* VALUATION MODELS */}
        {methods.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, background: '#F9F8F6', borderRadius: 14, padding: '18px 22px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>What {methods.length} models say</span>
            <div style={{ display: 'flex', gap: 12 }}>
              {methods.map((m) => (
                <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, background: '#FFFFFF', borderRadius: 10, padding: '12px 14px', border: '1px solid #E5E5E5' }}>
                  <span style={{ fontSize: 11, color: '#9B9B9B', fontWeight: 600 }}>{m.label.replace('Forward ', '').replace(' Multiple', '')}</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#111111', fontFamily: 'monospace' }}>{fmt(m.fv, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONVICTION */}
        {(chkP != null || passBullets.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, background: '#F9F8F6', borderRadius: 14, padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Conviction</span>
              {chkP != null && chkT != null && chkL
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: chkBg, borderRadius: 9999, padding: '5px 14px' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: chkColor }}>{chkL}</span>
                    <span style={{ fontSize: 12, color: chkColor }}>{chkP}/{chkT} signals</span>
                  </div>
                : null
              }
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {passBullets.map((b) => (
                <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', width: 20, height: 20, borderRadius: 10, background: BRAND.positiveSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: BRAND.positive }}>✓</span>
                  </div>
                  <span style={{ fontSize: 15, color: '#111111', fontWeight: 500 }}>{b}</span>
                </div>
              ))}
              {failBullets.map((b) => (
                <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', width: 20, height: 20, borderRadius: 10, background: BRAND.negativeSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: BRAND.negative }}>✗</span>
                  </div>
                  <span style={{ fontSize: 15, color: '#6B6B6B', fontWeight: 400 }}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MARKET IMPLIED */}
        {migInfo && mig != null && migA != null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24, background: migInfo.bg, borderRadius: 14, padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.07em', textTransform: 'uppercase' }}>What the price implies</span>
              <div style={{ display: 'flex', borderRadius: 9999, padding: '4px 12px', background: migInfo.bg }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: migInfo.color }}>{migInfo.label}</span>
              </div>
            </div>
            <span style={{ fontSize: 15, color: '#111111', fontWeight: 500, lineHeight: 1.5 }}>
              {`At ${fmt(price, currency)}, the market expects ${(mig * 100).toFixed(1)}% annual growth over 5 years. Our model assumes ${(migA * 100).toFixed(1)}%.`}
            </span>
          </div>
        )}

        {/* FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #E5E5E5' }}>
          <span style={{ fontSize: 12, color: '#9B9B9B' }}>Not financial advice · model output only</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.olive700 }}>{SITE_URL}</span>
        </div>

      </div>
    ),
    { width: 1080, height: 1350 }
  )
}
