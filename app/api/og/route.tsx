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

  const price  = isNaN(priceRaw) ? 0 : priceRaw
  const fv     = fvRaw    != null && !isNaN(fvRaw)    ? fvRaw    : null
  const upside = upsideRaw != null && !isNaN(upsideRaw) ? upsideRaw : null
  const bear   = bearRaw != null && !isNaN(bearRaw) ? bearRaw : null
  const bull   = bullRaw != null && !isNaN(bullRaw) ? bullRaw : null

  const vd       = VERDICT_DISPLAY[verdict] ?? VERDICT_DISPLAY['Insufficient Data']
  const isUp     = (upside ?? 0) >= 0
  const upsideStr = upside != null ? `${isUp ? '+' : ''}${(upside * 100).toFixed(1)}%` : null

  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`
  let logoData: string | null = null
  try {
    const res = await fetch(`${baseUrl}/brand/insic-logo-horizontal-on-dark.png`)
    if (res.ok) {
      const buf = await res.arrayBuffer()
      const bytes = new Uint8Array(buf)
      const binary = bytes.reduce((acc, b) => acc + String.fromCharCode(b), '')
      logoData = `data:image/png;base64,${btoa(binary)}`
    }
  } catch { /* fallback to text */ }

  const TRACK_W = 520
  const fvRange = bear != null && bull != null && bull > bear ? bull - bear : null
  const basePx  = fvRange && fvRange > 0 && fv != null && fv > 0
    ? Math.max(8, Math.min(TRACK_W - 8, ((fv - bear!) / fvRange) * TRACK_W))
    : null

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: 1200, height: 630, background: 'linear-gradient(145deg,#050D1F 0%,#0A1628 55%,#091525 100%)', padding: '52px 64px 44px', fontFamily: 'system-ui,-apple-system,sans-serif', position: 'relative', overflow: 'hidden' }}>

        {/* Dot grid */}
        <div style={{ display: 'flex', position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundImage: 'radial-gradient(rgba(37,99,235,0.07) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Glow */}
        <div style={{ display: 'flex', position: 'absolute', top: -120, right: -80, width: 500, height: 500, background: 'radial-gradient(circle,rgba(37,99,235,0.12) 0%,transparent 70%)' }} />

        {/* Accent bar */}
        <div style={{ display: 'flex', position: 'absolute', top: 0, left: 64, right: 64, height: 3, borderRadius: 4, background: vd.colorHex, opacity: 0.9 }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36, position: 'relative' }}>
          {logoData
            ? <img src={logoData} style={{ height: 26, objectFit: 'contain' }} alt="insic" />
            : <span style={{ color: '#2563EB', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>insic</span>
          }
          {conviction
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: 9999, padding: '5px 14px' }}>
                <div style={{ display: 'flex', width: 6, height: 6, borderRadius: '50%', background: '#3B82F6' }} />
                <span style={{ color: '#93C5FD', fontSize: 12, fontWeight: 600 }}>{conviction}</span>
              </div>
            : <div style={{ display: 'flex' }} />
          }
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>

            {/* Verdict */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {name
                ? <span style={{ color: '#64748B', fontSize: 15, fontWeight: 500 }}>{name}</span>
                : <div style={{ display: 'flex' }} />
              }
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ color: 'white', fontSize: 64, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{ticker}</span>
                <span style={{ color: '#64748B', fontSize: 52, fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1 }}>looks</span>
              </div>
              <span style={{ color: vd.colorHex, fontSize: 60, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{vd.word}</span>
            </div>

            {/* Numbers row */}
            <div style={{ display: 'flex', gap: 0, marginTop: 28 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingRight: 28, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: '#475569', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fair Value</span>
                <span style={{ color: 'white', fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>{fv != null ? fmt(fv, currency) : '—'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 28, paddingRight: 28, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: '#475569', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Price</span>
                <span style={{ color: '#94A3B8', fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmt(price, currency)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 28 }}>
                <span style={{ color: '#475569', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{upsideStr != null && !isUp ? 'Downside' : 'Upside'}</span>
                <span style={{ color: upsideStr == null ? '#64748B' : isUp ? '#10B981' : '#EF4444', fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>{upsideStr ?? '—'}</span>
              </div>
            </div>

            {/* Scenario bar */}
            {bear != null && bull != null && basePx != null
              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 28 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#EF4444', fontSize: 11, fontWeight: 600 }}>Bear {fmt(bear, currency)}</span>
                    <span style={{ color: '#93C5FD', fontSize: 11, fontWeight: 700 }}>Base {fv != null ? fmt(fv, currency) : '—'}</span>
                    <span style={{ color: '#10B981', fontSize: 11, fontWeight: 600 }}>Bull {fmt(bull, currency)}</span>
                  </div>
                  <div style={{ display: 'flex', position: 'relative', height: 6, borderRadius: 9999, background: 'linear-gradient(to right,rgba(239,68,68,0.4),rgba(100,116,139,0.3),rgba(16,185,129,0.4))', width: TRACK_W }}>
                    <div style={{ display: 'flex', position: 'absolute', top: -4, left: basePx - 7, width: 14, height: 14, borderRadius: '50%', background: 'white', border: '2.5px solid #2563EB' }} />
                  </div>
                </div>
              : <div style={{ display: 'flex' }} />
            }

          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 18, marginTop: 12, borderTop: '1px solid rgba(37,99,235,0.12)' }}>
          <span style={{ color: '#475569', fontSize: 11 }}>Not financial advice · model output only</span>
          <span style={{ color: '#475569', fontSize: 11 }}>{SITE_URL} · {dateStr}</span>
        </div>

      </div>
    ),
    { width: 1200, height: 630 },
  )
}
