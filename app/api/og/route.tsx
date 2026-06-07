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

interface MethodItem { label: string; fv: number }

// Sample an array to at most maxLen evenly-spaced items
function sample<T>(arr: T[], maxLen: number): T[] {
  if (arr.length <= maxLen) return arr
  const step = arr.length / maxLen
  return Array.from({ length: maxLen }, (_, i) => arr[Math.floor(i * step)])
}

function buildChartPoints(
  closes: number[],
  fvValue: number,
  w: number,
  h: number,
  pad = 10,
): { pricePoints: string; fvPoints: string; areaPoints: string } {
  const all = [...closes, fvValue]
  const minV = Math.min(...all) * 0.98
  const maxV = Math.max(...all) * 1.02
  const scaleY = (v: number) => pad + ((maxV - v) / (maxV - minV)) * (h - pad * 2)
  const scaleX = (i: number) => (i / (closes.length - 1)) * w

  const pricePts = closes.map((c, i) => `${scaleX(i).toFixed(1)},${scaleY(c).toFixed(1)}`).join(' ')
  const fvY = scaleY(fvValue).toFixed(1)
  const fvPts = `0,${fvY} ${w},${fvY}`
  const areaPts = closes
    .map((c, i) => `${scaleX(i).toFixed(1)},${scaleY(c).toFixed(1)}`)
    .concat([`${w},${h}`, `0,${h}`])
    .join(' ')

  return { pricePoints: pricePts, fvPoints: fvPts, areaPoints: areaPts }
}

const BLURB: Record<VerdictKey, string> = {
  'Undervalued':       'At current price, the stock trades below our intrinsic value estimate.',
  'Fairly Valued':     'The stock appears fairly priced relative to our intrinsic value estimate.',
  'Overvalued':        'The stock trades above our intrinsic value estimate at current price.',
  'Insufficient Data': 'Insufficient data to form a reliable intrinsic value estimate.',
}

function migInterpretation(mig: number | null, migA: number | null, verdictColor: string) {
  if (!mig || !migA) return null
  const ratio = mig / migA
  if (ratio < 0.8)  return { icon: '↗', title: 'Growth assumptions are conservative', body: 'Market expects less than the model assumes. Upside could be underestimated.', color: BRAND.positive }
  if (ratio < 1.2)  return { icon: '↗', title: 'Growth assumptions are reasonable',  body: 'Implied growth expectations are supported by fundamentals and risk profile. Value remains attractive.', color: verdictColor }
  return             { icon: '⚠', title: 'Market pricing in aggressive growth',      body: 'Market expects more than the model assumes. Risk of disappointment is elevated.', color: BRAND.negative }
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

  let _methods: MethodItem[] = []
  try {
    const raw = p.get('methods')
    if (raw) _methods = JSON.parse(decodeURIComponent(raw)).slice(0, 3)
  } catch { /* ignore */ }

  const price  = isNaN(priceRaw) ? 0 : priceRaw
  const fv     = fvRaw    != null && !isNaN(fvRaw)    ? fvRaw    : null
  const upside = upsideRaw != null && !isNaN(upsideRaw) ? upsideRaw : null
  const bear   = bearRaw != null && !isNaN(bearRaw) ? bearRaw : null
  const bull   = bullRaw != null && !isNaN(bullRaw) ? bullRaw : null
  const mig    = migRaw != null && !isNaN(migRaw) ? migRaw : null
  const migA   = migAssumed != null && !isNaN(migAssumed) ? migAssumed : null

  const vd          = VERDICT_DISPLAY[verdict] ?? VERDICT_DISPLAY['Insufficient Data']
  const isUp        = (upside ?? 0) >= 0
  const upsideStr   = upside != null ? fmtPct(upside) : null
  const upsideColor = upside == null ? '#64748B' : isUp ? BRAND.positive : BRAND.negative
  const upBg        = upside == null ? '#F1F5F9' : isUp ? BRAND.positiveSoft : BRAND.negativeSoft

  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`

  // ── parallel fetches ──────────────────────────────────────────────────────

  const [logoData, stockLogoData, priceHistory] = await Promise.all([
    // insic brand logo
    fetch(`${baseUrl}/brand/insic-logo-horizontal.png`)
      .then(r => r.ok ? r.arrayBuffer() : null)
      .then(buf => buf ? `data:image/png;base64,${btoa(new Uint8Array(buf).reduce((a, b) => a + String.fromCharCode(b), ''))}` : null)
      .catch(() => null),

    // stock/company logo via Google favicon service
    name ? fetch(`https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${
      name.replace(/\s+(Corp\.?|Inc\.?|Ltd\.?|LLC\.?|PLC\.?|SE|AG|NV|SA|Group|Holdings?|Holding|Technologies?|Technology|Solutions?|Enterprises?|International|Industries?)$/i, '')
          .trim().toLowerCase().replace(/[^a-z0-9]/g, '')}.com&size=64`)
      .then(r => r.ok ? r.arrayBuffer() : null)
      .then(buf => buf ? `data:image/png;base64,${btoa(new Uint8Array(buf).reduce((a, b) => a + String.fromCharCode(b), ''))}` : null)
      .catch(() => null) : Promise.resolve(null),

    // price history for sparkline
    fetch(`${baseUrl}/api/historical?ticker=${ticker}&period=1y`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { close: number }[] | null) => {
        if (!Array.isArray(d) || d.length === 0) return null
        const closes = d.map((row: { close: number }) => row.close).filter(Boolean)
        return closes.length > 0 ? sample(closes, 60) : null
      })
      .catch(() => null),
  ])

  // ── chart geometry ────────────────────────────────────────────────────────

  const CHART_W = 480
  const CHART_H = 200
  const chartData = priceHistory && fv != null && priceHistory.length >= 4
    ? buildChartPoints(priceHistory, fv, CHART_W, CHART_H)
    : null

  // ── scenario bar geometry ─────────────────────────────────────────────────

  const TRACK_W   = 1072
  const fvRange   = bear != null && bull != null && bull > bear ? bull - bear : null
  const basePx    = fvRange && fv != null ? Math.max(10, Math.min(TRACK_W - 10, ((fv - bear!) / fvRange) * TRACK_W)) : null
  const pricePx   = fvRange && price > 0  ? Math.max(10, Math.min(TRACK_W - 10, ((price - bear!) / fvRange) * TRACK_W)) : null
  const hasScenBar = bear != null && bull != null && basePx != null

  // ── derived content ────────────────────────────────────────────────────────

  const interp      = migInterpretation(mig, migA, vd.colorHex)
  const hasMIG      = mig != null && migA != null
  const hasLowerRow = hasMIG || interp != null
  const dateStr     = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // ── render ────────────────────────────────────────────────────────────────

  return new ImageResponse(
    (
      <div style={{
        display: 'flex', flexDirection: 'column',
        width: 1200, height: 630,
        background: '#F8F7F2',
        padding: '28px 44px 24px',
        fontFamily: 'system-ui,-apple-system,sans-serif',
      }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          {logoData
            ? <img src={logoData} style={{ height: 20, objectFit: 'contain' }} alt="insic" />
            : <span style={{ color: BRAND.olive700, fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>insic</span>
          }
          <span style={{ color: '#94A3B8', fontSize: 11 }}>{dateStr}</span>
        </div>

        {/* ── MAIN ROW: hero left + chart right ── */}
        <div style={{ display: 'flex', flex: 1, gap: 20, minHeight: 0 }}>

          {/* LEFT — verdict hero */}
          <div style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            flex: '0 0 520px',
            background: '#FFFFFF', border: `1px solid ${BRAND.border}`,
            borderRadius: 16, padding: '20px 24px',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.05)',
          }}>

            {/* Company + verdict */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Stock logo + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {stockLogoData && (
                  <img src={stockLogoData} style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'contain' }} alt={ticker} />
                )}
                {name ? <span style={{ color: '#64748B', fontSize: 12, fontWeight: 500 }}>{name}</span> : <div style={{ display: 'flex' }} />}
              </div>

              {/* Ticker + looks + verdict word */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ color: BRAND.ink900, fontSize: 52, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{ticker}</span>
                <span style={{ color: '#94A3B8', fontSize: 36, fontWeight: 300, letterSpacing: '-0.01em', lineHeight: 1 }}>looks</span>
                <span style={{ color: vd.colorHex, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{vd.word}</span>
              </div>

              {/* Description blurb */}
              <span style={{ color: '#475569', fontSize: 12, lineHeight: 1.5, maxWidth: 420 }}>{BLURB[verdict]}</span>
            </div>

            {/* Metrics row */}
            <div style={{ display: 'flex', gap: 0, marginTop: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingRight: 20, borderRight: `1px solid ${BRAND.border}` }}>
                <span style={{ color: '#94A3B8', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fair Value</span>
                <span style={{ color: BRAND.ink900, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{fv != null ? fmt(fv, currency) : '—'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 20, paddingRight: 20, borderRight: `1px solid ${BRAND.border}` }}>
                <span style={{ color: '#94A3B8', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vs Current Price</span>
                <span style={{ color: '#475569', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmt(price, currency)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 20 }}>
                <span style={{ color: '#94A3B8', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{isUp ? 'Upside' : 'Downside'}</span>
                <div style={{ display: 'flex', background: upBg, borderRadius: 8, padding: '3px 10px' }}>
                  <span style={{ color: upsideColor, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{upsideStr ?? '—'}</span>
                </div>
              </div>
            </div>

            {/* Conviction badge */}
            {conviction && (
              <div style={{ display: 'flex' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, background: vd.bgHex, border: `1px solid ${vd.borderHex}`, borderRadius: 9999, padding: '4px 12px' }}>
                  <div style={{ display: 'flex', width: 6, height: 6, borderRadius: '50%', background: vd.colorHex }} />
                  <span style={{ color: vd.colorHex, fontSize: 10, fontWeight: 600 }}>{conviction}</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — price chart or scenario bar */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            flex: 1,
            background: '#FFFFFF', border: `1px solid ${BRAND.border}`,
            borderRadius: 16, padding: '16px 20px',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.05)',
            overflow: 'hidden',
          }}>
            <span style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Price chart</span>

            {chartData ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {/* Legend */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ display: 'flex', width: 20, height: 2, background: BRAND.olive700, borderRadius: 1 }} />
                    <span style={{ color: '#64748B', fontSize: 10 }}>Fair value estimate {fv != null ? fmt(fv, currency) : ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ display: 'flex', width: 20, height: 2, background: BRAND.blue600, borderRadius: 1 }} />
                    <span style={{ color: '#64748B', fontSize: 10 }}>Current price {fmt(price, currency)}</span>
                  </div>
                </div>

                {/* SVG chart */}
                <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                  <svg width={CHART_W} height={CHART_H} style={{ display: 'flex', overflow: 'visible' }}>
                    {/* Area fill under price line */}
                    <polygon points={chartData.areaPoints} fill={`${BRAND.blue600}12`} />
                    {/* FV dashed line */}
                    <polyline points={chartData.fvPoints} fill="none" stroke={BRAND.olive700} strokeWidth="1.5" strokeDasharray="6,4" />
                    {/* Price line */}
                    <polyline points={chartData.pricePoints} fill="none" stroke={BRAND.blue600} strokeWidth="2" strokeLinejoin="round" />
                  </svg>

                  {/* Right-edge badges */}
                  <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', right: -16, top: 0, bottom: 0, justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
                    <div style={{ display: 'flex', background: BRAND.olive700, borderRadius: 6, padding: '3px 8px' }}>
                      <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>{fv != null ? fmt(fv, currency) : ''}</span>
                    </div>
                    <div style={{ display: 'flex', background: BRAND.blue600, borderRadius: 6, padding: '3px 8px' }}>
                      <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>{fmt(price, currency)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Fallback: scenario bar when no chart data */
              hasScenBar ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: BRAND.negative, fontSize: 11, fontWeight: 600 }}>Bear {fmt(bear!, currency)}</span>
                    <span style={{ color: '#475569', fontSize: 11, fontWeight: 700 }}>Base {fv != null ? fmt(fv, currency) : '—'}</span>
                    <span style={{ color: BRAND.positive, fontSize: 11, fontWeight: 600 }}>Bull {fmt(bull!, currency)}</span>
                  </div>
                  <div style={{ display: 'flex', position: 'relative', height: 8, borderRadius: 9999, background: `linear-gradient(to right,${BRAND.negative}50,#E2E8F0,${BRAND.positive}50)` }}>
                    {pricePx != null && (
                      <div style={{ display: 'flex', position: 'absolute', top: -4, left: (pricePx / TRACK_W) * 440 - 5, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `8px solid ${BRAND.blue600}` }} />
                    )}
                    <div style={{ display: 'flex', position: 'absolute', top: -5, left: (basePx! / TRACK_W) * 440 - 9, width: 18, height: 18, borderRadius: '50%', background: 'white', border: `3px solid ${BRAND.olive700}`, boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#CBD5E1', fontSize: 12 }}>No chart data</span>
                </div>
              )
            )}
          </div>
        </div>

        {/* ── LOWER ROW: MIG + interpretation ── */}
        {hasLowerRow && (
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>

            {/* MIG card */}
            {hasMIG && (
              <div style={{
                display: 'flex', flexDirection: 'column', flex: 1,
                background: '#FFFFFF', border: `1px solid ${BRAND.border}`,
                borderRadius: 14, padding: '14px 18px',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              }}>
                <span style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>What the market is pricing in</span>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: '#64748B', fontSize: 10, fontWeight: 600 }}>Implied 5Y Revenue CAGR</span>
                    <span style={{ color: vd.colorHex, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{(mig! * 100).toFixed(1)}%</span>
                    <span style={{ color: '#94A3B8', fontSize: 10 }}>Model assumes {(migA! * 100).toFixed(1)}%</span>
                  </div>
                  {/* Mini sparkline for MIG trend — simple visual bar */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 32 }}>
                    {[0.3, 0.5, 0.45, 0.6, 0.7, 0.65, 0.8, 0.85, 0.9, 1].map((h, i) => (
                      <div key={i} style={{ display: 'flex', width: 5, height: 32 * h, borderRadius: 2, background: vd.colorHex, opacity: 0.3 + h * 0.5 }} />
                    ))}
                    <div style={{ display: 'flex', width: 8, height: 8, borderRadius: '50%', background: vd.colorHex, marginBottom: 0, alignSelf: 'flex-end' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Market interpretation card */}
            {interp && (
              <div style={{
                display: 'flex', flexDirection: 'column', flex: 1,
                background: vd.bgHex, border: `1px solid ${vd.borderHex}`,
                borderRadius: 14, padding: '14px 18px',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              }}>
                <span style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Market interpretation</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', width: 32, height: 32, borderRadius: 8, background: interp.color + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" style={{ display: 'flex' }}>
                      <path d={interp.icon === '⚠'
                        ? 'M8 1L15 14H1L8 1Z'
                        : 'M3 11 L9 5 M9 5 L9 10 M9 5 L4 5'}
                        fill={interp.icon === '⚠' ? 'none' : 'none'}
                        stroke={interp.color}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ color: interp.color, fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{interp.title}</span>
                    <span style={{ color: '#475569', fontSize: 11, lineHeight: 1.4 }}>{interp.body}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SCENARIO BAR (full width, only if chart was shown) ── */}
        {hasScenBar && chartData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Scenario range</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: TRACK_W }}>
              <span style={{ color: BRAND.negative, fontSize: 10, fontWeight: 600 }}>Bear {fmt(bear!, currency)}</span>
              <span style={{ color: '#475569', fontSize: 10, fontWeight: 700 }}>Base {fv != null ? fmt(fv, currency) : '—'}</span>
              <span style={{ color: BRAND.positive, fontSize: 10, fontWeight: 600 }}>Bull {fmt(bull!, currency)}</span>
            </div>
            <div style={{ display: 'flex', position: 'relative', height: 8, borderRadius: 9999, background: `linear-gradient(to right,${BRAND.negative}40,#E2E8F0,${BRAND.positive}40)`, width: TRACK_W }}>
              {pricePx != null && (
                <div style={{ display: 'flex', position: 'absolute', top: -4, left: pricePx - 5, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `8px solid ${BRAND.blue600}` }} />
              )}
              <div style={{ display: 'flex', position: 'absolute', top: -5, left: basePx! - 9, width: 18, height: 18, borderRadius: '50%', background: 'white', border: `3px solid ${BRAND.olive700}`, boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} />
            </div>
            {pricePx != null && (
              <div style={{ display: 'flex', position: 'relative', width: TRACK_W, height: 14 }}>
                <span style={{ position: 'absolute', left: Math.max(0, Math.min(pricePx - 26, TRACK_W - 70)), color: BRAND.blue600, fontSize: 9, fontWeight: 600 }}>Current price {fmt(price, currency)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 10, borderTop: `1px solid ${BRAND.border}` }}>
          <span style={{ color: '#94A3B8', fontSize: 9 }}>Not financial advice · model output only</span>
          <span style={{ color: '#94A3B8', fontSize: 9 }}>{SITE_URL} · Invest with a process, not a story.</span>
        </div>

      </div>
    ),
    { width: 1200, height: 630 },
  )
}
