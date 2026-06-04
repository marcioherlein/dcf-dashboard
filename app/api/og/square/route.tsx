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
  const p          = req.nextUrl.searchParams
  const ticker     = (p.get('ticker') ?? 'TICKER').toUpperCase()
  const name       = p.get('name') ?? ''
  const price      = parseFloat(p.get('price')    ?? '0')
  const fv         = parseFloat(p.get('fv')        ?? '0')
  const upside     = parseFloat(p.get('upside')    ?? '0')
  const bear       = p.get('bear') ? parseFloat(p.get('bear')!) : null
  const bull       = p.get('bull') ? parseFloat(p.get('bull')!) : null
  const currency   = p.get('currency') ?? 'USD'
  const verdict    = (p.get('verdict') ?? 'Insufficient Data') as VerdictKey
  const conviction = p.get('conviction') ?? ''

  const vd         = VERDICT_DISPLAY[verdict] ?? VERDICT_DISPLAY['Insufficient Data']
  const isUp       = upside >= 0
  const upsideStr  = `${isUp ? '+' : ''}${(upside * 100).toFixed(1)}%`

  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const logoUrl = `${baseUrl}/brand/mark-reversed.png`

  let logoData: string | null = null
  try {
    const res = await fetch(logoUrl)
    if (res.ok) {
      const buf = await res.arrayBuffer()
      logoData = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`
    }
  } catch { /* render without logo */ }

  const TRACK_W = 420
  const fvRange = (bear != null && bull != null && bull > bear) ? bull - bear : null
  const basePx = fvRange && fvRange > 0 && fv > 0
    ? Math.max(8, Math.min(TRACK_W - 8, ((fv - bear!) / fvRange) * TRACK_W))
    : null

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080, height: 1080,
          background: 'linear-gradient(155deg, #050D1F 0%, #0A1628 50%, #091525 100%)',
          display: 'flex', flexDirection: 'column',
          padding: '64px 72px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Dot grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(37,99,235,0.07) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        {/* Blue glow top-right */}
        <div style={{
          position: 'absolute', top: -160, right: -100,
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(37,99,235,0.13) 0%, transparent 70%)',
        }} />

        {/* Verdict color accent bar */}
        <div style={{
          position: 'absolute', top: 0, left: 72, right: 72,
          height: 3, borderRadius: '0 0 4px 4px',
          background: vd.colorHex, opacity: 0.8,
        }} />

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 56, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- handled by file-level disable */}
            {logoData
              ? <img src={logoData} style={{ width: 36, height: 36, objectFit: 'contain' }} alt="Intrinsico" />
              : <div style={{ width: 36, height: 36, borderRadius: 8, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'white', fontSize: 18, fontWeight: 800 }}>I</span>
                </div>
            }
            <span style={{ color: '#475569', fontSize: 14, fontWeight: 600, letterSpacing: '0.04em' }}>INTRINSICO</span>
          </div>
          {conviction && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)',
              borderRadius: 9999, padding: '6px 16px',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6' }} />
              <span style={{ color: '#93C5FD', fontSize: 13, fontWeight: 600 }}>{conviction}</span>
            </div>
          )}
        </div>

        {/* ── Verdict ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, justifyContent: 'center', position: 'relative' }}>
          {name && (
            <span style={{ color: '#475569', fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{name}</span>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0 12px' }}>
            <span style={{ color: 'white', fontSize: 80, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {ticker}
            </span>
            <span style={{ color: '#64748B', fontSize: 48, fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              looks
            </span>
          </div>
          <span style={{ color: vd.colorHex, fontSize: 72, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 4 }}>
            {vd.word}
          </span>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginTop: 40, marginBottom: 40, width: '100%' }} />

          {/* Three numbers in a column */}
          <div style={{ display: 'flex', gap: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, paddingRight: 24, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ color: '#475569', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Fair Value</span>
              <span style={{ color: 'white', fontSize: 40, fontWeight: 750, letterSpacing: '-0.02em' }}>{fmt(fv, currency)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, paddingLeft: 24, paddingRight: 24, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ color: '#475569', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Price</span>
              <span style={{ color: '#94A3B8', fontSize: 40, fontWeight: 750, letterSpacing: '-0.02em' }}>{fmt(price, currency)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, paddingLeft: 24 }}>
              <span style={{ color: '#475569', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{isUp ? 'Upside' : 'Downside'}</span>
              <span style={{ color: isUp ? '#10B981' : '#EF4444', fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em' }}>{upsideStr}</span>
            </div>
          </div>

          {/* Scenario bar */}
          {bear != null && bull != null && basePx != null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 36 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#EF4444', fontSize: 12, fontWeight: 600 }}>Bear {fmt(bear, currency)}</span>
                <span style={{ color: '#93C5FD', fontSize: 12, fontWeight: 700 }}>Base {fmt(fv, currency)}</span>
                <span style={{ color: '#10B981', fontSize: 12, fontWeight: 600 }}>Bull {fmt(bull, currency)}</span>
              </div>
              <div style={{ position: 'relative', height: 7, borderRadius: 9999, background: 'linear-gradient(to right, rgba(239,68,68,0.4), rgba(100,116,139,0.3), rgba(16,185,129,0.4))', width: TRACK_W }}>
                <div style={{
                  position: 'absolute', top: '50%', width: 16, height: 16,
                  borderRadius: '50%', background: 'white', border: '2.5px solid #2563EB',
                  transform: 'translate(-50%, -50%)', left: basePx,
                }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: 20, marginTop: 16,
          borderTop: '1px solid rgba(37,99,235,0.12)',
          position: 'relative',
        }}>
          <span style={{ color: '#334155', fontSize: 12 }}>Not financial advice</span>
          <span style={{ color: '#334155', fontSize: 12 }}>{SITE_URL} · {dateStr}</span>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  )
}
