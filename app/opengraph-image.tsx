import { ImageResponse } from '@vercel/og'

export const runtime = 'edge'
export const alt = 'insic — Invest with a process, not a story'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(160deg, #1e293b 0%, #334155 50%, #475569 100%)',
          padding: '60px 72px',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Olive glow */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '600px',
            height: '400px',
            background: 'radial-gradient(ellipse at 80% 80%, rgba(95,121,11,0.18) 0%, transparent 65%)',
          }}
        />

        {/* Top: wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#5F790B',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ display: 'flex', color: 'white', fontSize: '22px', fontWeight: 800 }}>i</div>
          </div>
          <div style={{ display: 'flex', color: 'white', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em' }}>
            insic
          </div>
        </div>

        {/* Middle: headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              fontSize: '64px',
              fontWeight: 800,
              color: 'rgba(255,255,255,0.93)',
              letterSpacing: '-0.035em',
              lineHeight: 1.05,
            }}
          >
            Invest with a process,
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: '64px',
              fontWeight: 800,
              color: '#7C9A19',
              letterSpacing: '-0.035em',
              lineHeight: 1.05,
            }}
          >
            not a story.
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: '22px',
              color: 'rgba(255,255,255,0.60)',
              marginTop: '8px',
              maxWidth: '640px',
            }}
          >
            DCF valuation, reverse DCF, and conviction scores for any NYSE or NASDAQ stock. Free.
          </div>
        </div>

        {/* Bottom: stat pills */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {[
            { label: '5 valuation models', sub: 'per analysis' },
            { label: '10 stocks / month', sub: 'always free' },
            { label: 'Reverse DCF', sub: 'market-implied growth' },
          ].map(({ label, sub }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: '12px',
                padding: '14px 22px',
              }}
            >
              <div style={{ display: 'flex', color: 'white', fontSize: '16px', fontWeight: 700 }}>{label}</div>
              <div style={{ display: 'flex', color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
