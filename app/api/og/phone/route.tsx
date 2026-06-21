/* eslint-disable @next/next/no-img-element */
/**
 * /api/og/phone — iPhone 15 Pro frame wrapping the portrait valuation card.
 *
 * Output: 1206×2622px  (phone frame is 1206px wide, scales the portrait card inside)
 *
 * Params — same as /api/og/portrait, plus:
 *   (none new) — all portrait params pass through via the inner img src
 *
 * Usage from tweet script:
 *   https://insic.app/api/og/phone?ticker=MSFT&price=379&fv=462&upside=0.218&verdict=Undervalued&conviction=67&...
 */
import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import { BRAND, SITE_URL } from '@/lib/brand'

export const runtime = 'edge'

// iPhone 15 Pro dimensions (logical, 3× scale feels right for social)
// Frame: 1206 × 2622
// Screen inset: 66px left/right, 130px top, 100px bottom
const FRAME_W  = 1206
const FRAME_H  = 2622
const SCRNX    = 66   // screen left offset inside frame
const SCRNY    = 130  // screen top offset inside frame
const SCRN_W   = FRAME_W - SCRNX * 2   // 1074
const SCRN_H   = FRAME_H - SCRNY - 100 // 2392

export async function GET(req: NextRequest) {
  // Forward all params to the portrait route to render the card inside the phone
  const params = req.nextUrl.searchParams.toString()
  const baseUrl = req.nextUrl.origin
  const portraitUrl = `${baseUrl}/api/og/portrait${params ? `?${params}` : ''}`

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: FRAME_W,
          height: FRAME_H,
          background: 'linear-gradient(160deg, #0F1923 0%, #1B2E4B 50%, #0F1923 100%)',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* ── Subtle background glow ── */}
        <div style={{
          display: 'flex',
          position: 'absolute',
          top: FRAME_H * 0.15,
          left: FRAME_W * 0.1,
          width: FRAME_W * 0.8,
          height: FRAME_H * 0.5,
          background: `radial-gradient(ellipse, ${BRAND.olive700}22 0%, transparent 70%)`,
          borderRadius: '50%',
        }} />

        {/* ── Phone body ── */}
        <div style={{
          display: 'flex',
          position: 'relative',
          width: FRAME_W,
          height: FRAME_H,
        }}>
          {/* Phone outer shell */}
          <div style={{
            display: 'flex',
            position: 'absolute',
            top: 0, left: 0,
            width: FRAME_W,
            height: FRAME_H,
            borderRadius: 120,
            background: 'linear-gradient(145deg, #2A2A2A 0%, #1A1A1A 40%, #222222 100%)',
            border: '3px solid #3A3A3A',
            boxShadow: '0 0 0 1px #111, inset 0 1px 0 #4A4A4A',
          }} />

          {/* Side buttons — volume up */}
          <div style={{ display: 'flex', position: 'absolute', top: 380, left: -8, width: 8, height: 80, background: '#2A2A2A', borderRadius: '4px 0 0 4px' }} />
          {/* Side buttons — volume down */}
          <div style={{ display: 'flex', position: 'absolute', top: 490, left: -8, width: 8, height: 80, background: '#2A2A2A', borderRadius: '4px 0 0 4px' }} />
          {/* Side buttons — silent */}
          <div style={{ display: 'flex', position: 'absolute', top: 270, left: -8, width: 8, height: 50, background: '#2A2A2A', borderRadius: '4px 0 0 4px' }} />
          {/* Power button */}
          <div style={{ display: 'flex', position: 'absolute', top: 420, right: -8, width: 8, height: 110, background: '#2A2A2A', borderRadius: '0 4px 4px 0' }} />

          {/* Screen bezel (dark inner) */}
          <div style={{
            display: 'flex',
            position: 'absolute',
            top: SCRNY - 10,
            left: SCRNX - 6,
            width: SCRN_W + 12,
            height: SCRN_H + 20,
            borderRadius: 56,
            background: '#080808',
          }} />

          {/* Screen area — renders the portrait card */}
          <div style={{
            display: 'flex',
            position: 'absolute',
            top: SCRNY,
            left: SCRNX,
            width: SCRN_W,
            height: SCRN_H,
            borderRadius: 50,
            overflow: 'hidden',
            background: '#FFFFFF',
          }}>
            {/* Portrait card fills the screen */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={portraitUrl}
              width={SCRN_W}
              height={SCRN_H}
              style={{ objectFit: 'cover', objectPosition: 'top' }}
              alt=""
            />
          </div>

          {/* Dynamic Island */}
          <div style={{
            display: 'flex',
            position: 'absolute',
            top: SCRNY + 18,
            left: FRAME_W / 2 - 80,
            width: 160,
            height: 42,
            background: '#000000',
            borderRadius: 24,
          }} />

          {/* Status bar — time left, icons right */}
          <div style={{
            display: 'flex',
            position: 'absolute',
            top: SCRNY + 6,
            left: SCRNX + 18,
            width: SCRN_W - 36,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#111111', letterSpacing: '-0.02em', fontFamily: 'system-ui' }}>9:41</span>
            {/* Status icons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Signal bars */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                {[10, 14, 18, 22].map((h, i) => (
                  <div key={i} style={{ display: 'flex', width: 6, height: h, background: '#111111', borderRadius: 2 }} />
                ))}
              </div>
              {/* WiFi */}
              <div style={{ display: 'flex', width: 26, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                <svg width="26" height="20" viewBox="0 0 26 20">
                  <path d="M13 16a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill="#111"/>
                  <path d="M7 12c1.6-1.6 3.8-2.6 6-2.6s4.4 1 6 2.6" stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
                  <path d="M3 8C6.3 4.7 9.6 3 13 3s6.7 1.7 10 5" stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
                </svg>
              </div>
              {/* Battery */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <div style={{ display: 'flex', width: 38, height: 20, border: '2px solid #111', borderRadius: 5, padding: 2, position: 'relative' }}>
                  <div style={{ display: 'flex', width: '85%', height: '100%', background: '#111', borderRadius: 2 }} />
                </div>
                <div style={{ display: 'flex', width: 3, height: 8, background: '#111', borderRadius: 1 }} />
              </div>
            </div>
          </div>

          {/* Home indicator */}
          <div style={{
            display: 'flex',
            position: 'absolute',
            bottom: 28,
            left: FRAME_W / 2 - 66,
            width: 132,
            height: 6,
            background: '#AAAAAA',
            borderRadius: 3,
          }} />
        </div>

        {/* ── insic branding below phone ── */}
        <div style={{
          display: 'flex',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 0, // phone fills full frame — branding is on screen itself
        }} />
      </div>
    ),
    { width: FRAME_W, height: FRAME_H }
  )
}
