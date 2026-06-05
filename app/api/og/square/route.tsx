/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import { VERDICT_DISPLAY, SITE_URL, type VerdictKey } from '@/lib/brand'

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

interface MethodItem { label: string; fv: number }

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

  let methods: MethodItem[] = []
  try {
    const raw = p.get('methods')
    if (raw) methods = JSON.parse(decodeURIComponent(raw)).slice(0, 3)
  } catch { /* ignore */ }

  const price  = isNaN(priceRaw) ? 0 : priceRaw
  const fv     = fvRaw    != null && !isNaN(fvRaw)    ? fvRaw    : null
  const upside = upsideRaw != null && !isNaN(upsideRaw) ? upsideRaw : null
  const bear   = bearRaw != null && !isNaN(bearRaw) ? bearRaw : null
  const bull   = bullRaw != null && !isNaN(bullRaw) ? bullRaw : null
  const mig    = migRaw != null && !isNaN(migRaw) ? migRaw : null
  const migA   = migAssumed != null && !isNaN(migAssumed) ? migAssumed : null

  const vd       = VERDICT_DISPLAY[verdict] ?? VERDICT_DISPLAY['Insufficient Data']
  const isUp     = (upside ?? 0) >= 0
  const upsideStr = upside != null ? `${isUp ? '+' : ''}${(upside * 100).toFixed(1)}%` : null
  const upsideColor = upside == null ? '#64748B' : isUp ? '#10B981' : '#EF4444'

  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`
  let logoData: string | null = null
  try {
    const res = await fetch(`${baseUrl}/brand/mark-reversed.png`)
    if (res.ok) {
      const buf = await res.arrayBuffer()
      const bytes = new Uint8Array(buf)
      const binary = bytes.reduce((acc, b) => acc + String.fromCharCode(b), '')
      logoData = `data:image/png;base64,${btoa(binary)}`
    }
  } catch { /* fallback to text */ }

  const TRACK_W = 936 // 1080 - 72*2 padding
  const fvRange = bear != null && bull != null && bull > bear ? bull - bear : null
  const basePx  = fvRange && fvRange > 0 && fv != null && fv > 0
    ? Math.max(10, Math.min(TRACK_W - 10, ((fv - bear!) / fvRange) * TRACK_W))
    : null
  const pricePx = fvRange && fvRange > 0 && price > 0
    ? Math.max(10, Math.min(TRACK_W - 10, ((price - bear!) / fvRange) * TRACK_W))
    : null

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const hasModels  = methods.length > 0
  const hasMIG     = mig != null && migA != null
  const hasScenBar = bear != null && bull != null && basePx != null

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: 1080, height: 1080, background: 'linear-gradient(155deg,#050D1F 0%,#0A1628 50%,#091525 100%)', padding: '56px 72px 48px', fontFamily: 'system-ui,-apple-system,sans-serif', position: 'relative', overflow: 'hidden' }}>

        {/* Dot grid */}
        <div style={{ display: 'flex', position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundImage: 'radial-gradient(rgba(37,99,235,0.065) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />

        {/* Glows */}
        <div style={{ display: 'flex', position: 'absolute', top: -160, right: -100, width: 600, height: 600, background: 'radial-gradient(circle,rgba(37,99,235,0.12) 0%,transparent 70%)' }} />
        <div style={{ display: 'flex', position: 'absolute', bottom: -100, left: -60, width: 420, height: 420, background: `radial-gradient(circle,${vd.colorHex}18 0%,transparent 70%)` }} />

        {/* Accent bar */}
        <div style={{ display: 'flex', position: 'absolute', top: 0, left: 72, right: 72, height: 4, borderRadius: 4, background: vd.colorHex, opacity: 0.9 }} />

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 60, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {logoData
              ? <img src={logoData} style={{ width: 32, height: 32, objectFit: 'contain' }} alt="insic" />
              : <div style={{ display: 'flex', width: 32, height: 32, borderRadius: 8, background: '#2563EB', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'white', fontSize: 16, fontWeight: 800 }}>I</span>
                </div>
            }
            <span style={{ color: '#64748B', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>INSIC</span>
          </div>
          {conviction
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.22)', borderRadius: 9999, padding: '6px 16px' }}>
                <div style={{ display: 'flex', width: 6, height: 6, borderRadius: '50%', background: '#3B82F6' }} />
                <span style={{ color: '#93C5FD', fontSize: 12, fontWeight: 600 }}>{conviction}</span>
              </div>
            : <div style={{ display: 'flex' }} />
          }
        </div>

        {/* ── VERDICT HERO ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
          {name
            ? <span style={{ color: '#64748B', fontSize: 17, fontWeight: 500 }}>{name}</span>
            : <div style={{ display: 'flex' }} />
          }
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span style={{ color: 'white', fontSize: 90, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{ticker}</span>
            <span style={{ color: '#475569', fontSize: 56, fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1 }}>looks</span>
          </div>
          <span style={{ color: vd.colorHex, fontSize: 80, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{vd.word}</span>
        </div>

        {/* ── KEY METRICS ── */}
        <div style={{ display: 'flex', gap: 0, marginTop: 68 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, paddingRight: 24, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ color: '#475569', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em' }}>Fair Value</span>
            <span style={{ color: 'white', fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em' }}>{fv != null ? fmt(fv, currency) : '—'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, paddingLeft: 24, paddingRight: 24, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ color: '#475569', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em' }}>Price</span>
            <span style={{ color: '#94A3B8', fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmt(price, currency)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, paddingLeft: 24 }}>
            <span style={{ color: '#475569', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em' }}>{upsideStr != null && !isUp ? 'Downside' : 'Upside'}</span>
            <div style={{ display: 'flex', alignItems: 'center', background: upsideStr == null ? 'rgba(100,116,139,0.15)' : isUp ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', borderRadius: 10, padding: '4px 12px 4px 10px' }}>
              <span style={{ color: upsideColor, fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em' }}>{upsideStr ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* ── MODEL CONSENSUS (if available) ── */}
        {hasModels && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 68 }}>
            <span style={{ color: '#475569', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>Model Consensus</span>
            <div style={{ display: 'flex', gap: 12 }}>
              {methods.map((m, i) => {
                const methodUpside = price > 0 ? (m.fv - price) / price : null
                const mUp = (methodUpside ?? 0) >= 0
                const mColor = methodUpside == null ? '#64748B' : mUp ? '#10B981' : '#EF4444'
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 18px', gap: 6 }}>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 600 }}>{m.label}</span>
                    <span style={{ color: 'white', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmt(m.fv, currency)}</span>
                    {methodUpside != null && (
                      <span style={{ color: mColor, fontSize: 11, fontWeight: 700 }}>{fmtPct(methodUpside)}</span>
                    )}
                  </div>
                )
              })}
              {fv != null && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.20)', borderRadius: 12, padding: '14px 18px', gap: 6 }}>
                  <span style={{ color: '#64748B', fontSize: 11, fontWeight: 600 }}>Blended</span>
                  <span style={{ color: 'white', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmt(fv, currency)}</span>
                  {upside != null && (
                    <span style={{ color: upsideColor, fontSize: 11, fontWeight: 700 }}>{upsideStr}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MIG CALLOUT ── */}
        {hasMIG && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 40, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', width: 4, height: 30, borderRadius: 2, background: '#3B82F6', flexShrink: 0 }} />
            <span style={{ color: '#93C5FD', fontSize: 12, lineHeight: 1.4 }}>
              Market prices in <span style={{ color: 'white', fontWeight: 700 }}>{(mig! * 100).toFixed(1)}% revenue CAGR</span> — model assumes <span style={{ color: vd.colorHex, fontWeight: 700 }}>{(migA! * 100).toFixed(1)}%</span>
            </span>
          </div>
        )}

        {/* ── SCENARIO BAR ── */}
        {hasScenBar && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: TRACK_W }}>
              <span style={{ color: '#EF4444', fontSize: 11, fontWeight: 600 }}>Bear {fmt(bear!, currency)}</span>
              <span style={{ color: '#93C5FD', fontSize: 11, fontWeight: 700 }}>Base {fv != null ? fmt(fv, currency) : '—'}</span>
              <span style={{ color: '#10B981', fontSize: 11, fontWeight: 600 }}>Bull {fmt(bull!, currency)}</span>
            </div>
            <div style={{ display: 'flex', position: 'relative', height: 8, borderRadius: 9999, background: 'linear-gradient(to right,rgba(239,68,68,0.45),rgba(100,116,139,0.25),rgba(16,185,129,0.45))', width: TRACK_W }}>
              {pricePx != null && (
                <div style={{ display: 'flex', position: 'absolute', top: -4, left: pricePx - 5, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '8px solid #94A3B8' }} />
              )}
              <div style={{ display: 'flex', position: 'absolute', top: -5, left: basePx! - 9, width: 18, height: 18, borderRadius: '50%', background: 'white', border: '3px solid #2563EB' }} />
            </div>
            {pricePx != null && (
              <div style={{ display: 'flex', position: 'relative', width: TRACK_W, height: 14 }}>
                <span style={{ position: 'absolute', left: Math.max(0, Math.min(pricePx - 26, TRACK_W - 64)), color: '#64748B', fontSize: 10, fontWeight: 600 }}>Price {fmt(price, currency)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'absolute', bottom: 48, left: 72, right: 72, paddingTop: 16, borderTop: '1px solid rgba(37,99,235,0.10)' }}>
          <span style={{ color: '#334155', fontSize: 11 }}>Not financial advice · model output only</span>
          <span style={{ color: '#334155', fontSize: 11 }}>{SITE_URL} · {dateStr}</span>
        </div>

      </div>
    ),
    { width: 1080, height: 1080 },
  )
}
