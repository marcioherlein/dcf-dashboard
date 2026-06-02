import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const ticker   = (searchParams.get('ticker')  ?? 'TICKER').toUpperCase()
  const price    = parseFloat(searchParams.get('price')   ?? '0')
  const fv       = parseFloat(searchParams.get('fv')      ?? '0')
  const upside   = parseFloat(searchParams.get('upside')  ?? '0')
  const currency = searchParams.get('currency') ?? 'USD'
  const name     = searchParams.get('name') ?? ''

  const upsidePct  = (upside * 100).toFixed(1)
  const isPositive = upside >= 0
  const fmtPrice   = (v: number) => `${currency === 'USD' ? '$' : currency + ' '}${v.toFixed(2)}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #050D1F 0%, #0A1628 60%, #0F2A5E 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '56px 64px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Subtle grid pattern overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(59,130,246,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: '#3B82F6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', color: 'white', fontWeight: 700,
          }}>R</div>
          <span style={{ color: '#94A3B8', fontSize: '15px', fontWeight: 600, letterSpacing: '0.04em' }}>RATIONALE</span>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', gap: '20px' }}>
          {/* Ticker + company name */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
            <span style={{ color: 'white', fontSize: '72px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {ticker}
            </span>
            {name && (
              <span style={{ color: '#64748B', fontSize: '22px', fontWeight: 500, marginBottom: '6px' }}>
                {name}
              </span>
            )}
          </div>

          {/* Price row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: '#64748B', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current Price</span>
              <span style={{ color: '#CBD5E1', fontSize: '32px', fontWeight: 700 }}>{fmtPrice(price)}</span>
            </div>
            <div style={{ width: '1px', height: '52px', background: 'rgba(59,130,246,0.2)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: '#64748B', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fair Value (DCF)</span>
              <span style={{ color: 'white', fontSize: '32px', fontWeight: 700 }}>{fmtPrice(fv)}</span>
            </div>
            {upside !== 0 && (
              <>
                <div style={{ width: '1px', height: '52px', background: 'rgba(59,130,246,0.2)' }} />
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: isPositive ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                  border: `1px solid ${isPositive ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                  borderRadius: '12px', padding: '10px 20px',
                }}>
                  <span style={{
                    fontSize: '36px', fontWeight: 800,
                    color: isPositive ? '#34D399' : '#F87171',
                  }}>
                    {isPositive ? '+' : ''}{upsidePct}%
                  </span>
                  <span style={{ color: '#64748B', fontSize: '14px', fontWeight: 600 }}>
                    {isPositive ? 'upside' : 'downside'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '24px', borderTop: '1px solid rgba(59,130,246,0.15)' }}>
          <span style={{ color: '#334155', fontSize: '12px' }}>
            Not financial advice · model output · insic.app
          </span>
          <span style={{ color: '#334155', fontSize: '12px' }}>
            DCF + multiples consensus · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
