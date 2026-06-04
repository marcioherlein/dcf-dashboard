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

  // Logo — resolved to absolute URL for edge runtime fetch
  const baseUrl  = `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const logoUrl  = `${baseUrl}/brand/logo-horizontal-reversed.png`

  let logoData: string | null = null
  try {
    const res = await fetch(logoUrl)
    if (res.ok) {
      const buf = await res.arrayBuffer()
      logoData = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`
    }
  } catch { /* render without logo */ }

  // Scenario bar geometry (landscape: 520px wide track)
  const TRACK_W = 520
  const bearPx = bear != null && bull != null && bull > bear
    ? 0
    : null
  const _bullPx = bearPx != null ? TRACK_W : null
  const fvRange = (bear != null && bull != null && bull > bear) ? bull - bear : null
  const basePx = fvRange && fvRange > 0 && fv > 0
    ? Math.max(8, Math.min(TRACK_W - 8, ((fv - bear!) / fvRange) * TRACK_W))
    : null

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630,
          background: 'linear-gradient(145deg, #050D1F 0%, #0A1628 55%, #091525 100%)',
          display: 'flex', flexDirection: 'column',
          padding: '52px 64px 44px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Subtle dot grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(37,99,235,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

        {/* Blue glow top-right */}
        <div style={{
          position: 'absolute', top: -120, right: -80,
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)',
        }} />

        {/* ── Header: logo + conviction ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36, position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoData
            ? <img src={logoData} style={{ height: 28, objectFit: 'contain' }} alt="Intrinsico" />
            : <span style={{ color: '#2563EB', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Intrinsico</span>
          }
          {conviction && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)',
              borderRadius: 9999, padding: '5px 14px',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6' }} />
              <span style={{ color: '#93C5FD', fontSize: 12, fontWeight: 600 }}>{conviction}</span>
            </div>
          )}
        </div>

        {/* ── Main area ── */}
        <div style={{ display: 'flex', flex: 1, gap: 0, position: 'relative' }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>

            {/* Verdict headline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {name && (
                <span style={{ color: '#475569', fontSize: 15, fontWeight: 500 }}>
                  {name}
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 0, flexWrap: 'wrap' }}>
                <span style={{ color: 'white', fontSize: 60, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
                  {ticker}{' '}
                </span>
                <span style={{ color: '#94A3B8', fontSize: 60, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1.05, marginLeft: 12 }}>
                  looks
                </span>
              </div>
              <span style={{ color: vd.colorHex, fontSize: 56, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {vd.word}
              </span>
            </div>

            {/* Three numbers */}
            <div style={{ display: 'flex', gap: 0, marginTop: 28 }}>
              {/* Fair Value */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingRight: 28, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: '#475569', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Fair Value</span>
                <span style={{ color: 'white', fontSize: 34, fontWeight: 750, letterSpacing: '-0.02em' }}>{fmt(fv, currency)}</span>
              </div>
              {/* Current Price */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 28, paddingRight: 28, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: '#475569', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Current Price</span>
                <span style={{ color: '#94A3B8', fontSize: 34, fontWeight: 750, letterSpacing: '-0.02em' }}>{fmt(price, currency)}</span>
              </div>
              {/* Upside */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 28 }}>
                <span style={{ color: '#475569', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{isUp ? 'Upside' : 'Downside'}</span>
                <span style={{ color: isUp ? '#10B981' : '#EF4444', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>{upsideStr}</span>
              </div>
            </div>

            {/* Scenario bar */}
            {bear != null && bull != null && basePx != null && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#EF4444', fontSize: 11, fontWeight: 600 }}>Bear {fmt(bear, currency)}</span>
                  <span style={{ color: '#93C5FD', fontSize: 11, fontWeight: 700 }}>Base {fmt(fv, currency)}</span>
                  <span style={{ color: '#10B981', fontSize: 11, fontWeight: 600 }}>Bull {fmt(bull, currency)}</span>
                </div>
                {/* Track */}
                <div style={{ position: 'relative', height: 6, borderRadius: 9999, background: 'linear-gradient(to right, rgba(239,68,68,0.4), rgba(100,116,139,0.3), rgba(16,185,129,0.4))', width: TRACK_W }}>
                  {/* Base dot */}
                  <div style={{
                    position: 'absolute', top: '50%', width: 14, height: 14,
                    borderRadius: '50%', background: 'white', border: '2.5px solid #2563EB',
                    transform: 'translate(-50%, -50%)',
                    left: basePx,
                  }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: 18, marginTop: 12,
          borderTop: '1px solid rgba(37,99,235,0.12)',
          position: 'relative',
        }}>
          <span style={{ color: '#334155', fontSize: 11 }}>Not financial advice · model output only</span>
          <span style={{ color: '#334155', fontSize: 11 }}>{SITE_URL} · {dateStr}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
