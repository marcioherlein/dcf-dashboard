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

function migInterp(mig: number | null, migA: number | null) {
  if (!mig || !migA) return null
  const ratio = mig / migA
  if (ratio < 0.8) return {
    label: 'Conservative',
    chipBg: '#ECFDF3', chipBorder: '#BBF7D0', chipColor: '#047857',
    calloutBg: '#ECFDF3', calloutBorder: '#BBF7D0',
    title: 'Growth assumptions are conservative',
    body: 'Market expects less than the model assumes. Upside could be underestimated.',
    titleColor: '#047857',
  }
  if (ratio < 1.2) return {
    label: 'Reasonable',
    chipBg: '#EFF6FF', chipBorder: '#BFDBFE', chipColor: '#2563EB',
    calloutBg: '#EFF6FF', calloutBorder: '#BFDBFE',
    title: 'Growth assumptions are reasonable',
    body: 'Implied growth expectations are supported by fundamentals and risk profile. Value remains attractive.',
    titleColor: '#2563EB',
  }
  if (ratio < 1.6) return {
    label: 'Aggressive',
    chipBg: '#FFF7ED', chipBorder: '#FED7AA', chipColor: '#D97706',
    calloutBg: '#FFFBEB', calloutBorder: '#FDE68A',
    title: 'Market pricing in aggressive growth',
    body: 'Market expects more than the model assumes. Risk of disappointment is elevated.',
    titleColor: '#D97706',
  }
  return {
    label: 'Very Aggressive',
    chipBg: '#FEF2F2', chipBorder: '#FECACA', chipColor: '#DC2626',
    calloutBg: '#FEF2F2', calloutBorder: '#FECACA',
    title: 'Market pricing in aggressive growth',
    body: 'Market expects significantly more than the model assumes. Risk is elevated.',
    titleColor: '#DC2626',
  }
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
  const upsideColor = upside == null ? '#566174' : isUp ? BRAND.positive : BRAND.negative
  const upBg        = upside == null ? '#F4F3EF' : isUp ? BRAND.positiveSoft : BRAND.negativeSoft

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
    fetch(`${baseUrl}/api/historical?ticker=${ticker}&period=1y`, { headers: { 'x-og-internal': '1' } })
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

  const interp      = migInterp(mig, migA)
  const hasMIG      = mig != null && migA != null
  const _hasLowerRow = hasMIG || interp != null
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          {logoData
            ? <img src={logoData} style={{ height: 18, objectFit: 'contain' }} alt="insic" />
            : <span style={{ color: BRAND.olive700, fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>insic</span>
          }
          <span style={{ color: '#9B9B9B', fontSize: 11 }}>{dateStr}</span>
        </div>

        {/* ── MAIN ROW: hero card left + chart right ── */}
        <div style={{ display: 'flex', flex: 1, gap: 16, minHeight: 0 }}>

          {/* LEFT — verdict hero, verdict-tinted background */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            flex: '0 0 516px',
            background: vd.bgHex, border: `1px solid ${vd.borderHex}`,
            borderRadius: 16, padding: '20px 24px',
            overflow: 'hidden',
          }}>
            {/* Company name + stock logo + conviction badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {stockLogoData && (
                  <img src={stockLogoData} style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'contain' }} alt={ticker} />
                )}
                {name && <span style={{ color: '#6B6B6B', fontSize: 12, fontWeight: 500 }}>{name}</span>}
              </div>
              {conviction && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.7)', border: `1px solid ${vd.borderHex}`, borderRadius: 9999, padding: '3px 10px' }}>
                  <div style={{ display: 'flex', width: 5, height: 5, borderRadius: '50%', background: vd.colorHex }} />
                  <span style={{ color: vd.colorHex, fontSize: 10, fontWeight: 650 }}>{conviction}</span>
                </div>
              )}
            </div>

            {/* Ticker + looks + verdict word */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#111111', fontSize: 50, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{ticker}</span>
              <span style={{ color: '#9B9B9B', fontSize: 32, fontWeight: 300, letterSpacing: '-0.01em', lineHeight: 1 }}>looks</span>
              <span style={{ color: vd.colorHex, fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{vd.word}</span>
            </div>

            {/* Description */}
            <span style={{ color: '#6B6B6B', fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>{BLURB[verdict]}</span>

            {/* Metrics row — vertical divider elements, items-end aligned */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginTop: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ color: '#6B6B6B', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Fair Value</span>
                <span style={{ color: '#111111', fontSize: 26, fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1 }}>{fv != null ? fmt(fv, currency) : '—'}</span>
              </div>
              <div style={{ display: 'flex', width: 1, height: 28, background: '#C8C8C8', marginBottom: 2, flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ color: '#6B6B6B', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vs Current Price</span>
                <span style={{ color: '#6B6B6B', fontSize: 26, fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1 }}>{fmt(price, currency)}</span>
              </div>
              <div style={{ display: 'flex', width: 1, height: 28, background: '#C8C8C8', marginBottom: 2, flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ color: '#6B6B6B', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{isUp ? 'Upside' : 'Downside'}</span>
                <div style={{ display: 'flex', background: upBg, borderRadius: 8, padding: '3px 10px' }}>
                  <span style={{ color: upsideColor, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{upsideStr ?? '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — price chart */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            flex: 1,
            background: '#FFFFFF', border: '1px solid #E6ECF5',
            borderRadius: 16, padding: '14px 18px',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
              <span style={{ color: '#06101F', fontSize: 12, fontWeight: 700 }}>Price chart</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ display: 'flex', width: 18, height: 2, background: BRAND.olive700, borderRadius: 1 }} />
                <span style={{ color: '#566174', fontSize: 10 }}>Fair value estimate {fv != null ? fmt(fv, currency) : ''}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ display: 'flex', width: 18, height: 2, background: '#3B82F6', borderRadius: 1 }} />
                <span style={{ color: '#566174', fontSize: 10 }}>Current price {fmt(price, currency)}</span>
              </div>
            </div>

            {chartData ? (
              <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                <svg width={CHART_W} height={CHART_H} style={{ display: 'flex', overflow: 'visible' }}>
                  <polygon points={chartData.areaPoints} fill="rgba(59,130,246,0.07)" />
                  <polyline points={chartData.fvPoints} fill="none" stroke={BRAND.olive700} strokeWidth="1.5" strokeDasharray="6,4" />
                  <polyline points={chartData.pricePoints} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', right: -10, top: 0, bottom: 0, justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
                  <div style={{ display: 'flex', background: BRAND.olive700, borderRadius: 6, padding: '3px 7px' }}>
                    <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>{fv != null ? fmt(fv, currency) : ''}</span>
                  </div>
                  <div style={{ display: 'flex', background: '#3B82F6', borderRadius: 6, padding: '3px 7px' }}>
                    <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>{fmt(price, currency)}</span>
                  </div>
                </div>
              </div>
            ) : (
              hasScenBar ? (
                <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#F87171', fontSize: 11, fontWeight: 600 }}>Bear {fmt(bear!, currency)}</span>
                    <span style={{ color: '#2563EB', fontSize: 11, fontWeight: 700 }}>Base {fv != null ? fmt(fv, currency) : '—'}</span>
                    <span style={{ color: '#10B981', fontSize: 11, fontWeight: 600 }}>Bull {fmt(bull!, currency)}</span>
                  </div>
                  <div style={{ display: 'flex', position: 'relative', height: 8, borderRadius: 9999, background: '#DBEAFE', width: '100%' }}>
                    <div style={{ display: 'flex', position: 'absolute', top: 1, left: -3, width: 6, height: 6, borderRadius: '50%', background: '#F87171' }} />
                    <div style={{ display: 'flex', position: 'absolute', top: -2, left: (basePx! / TRACK_W) * 440 - 6, width: 12, height: 12, borderRadius: '50%', background: '#3B82F6', border: '2px solid white' }} />
                    <div style={{ display: 'flex', position: 'absolute', top: 1, left: 440 - 3, width: 6, height: 6, borderRadius: '50%', background: '#4ADE80' }} />
                    {pricePx != null && <div style={{ display: 'flex', position: 'absolute', top: -4, left: (pricePx / TRACK_W) * 440 - 1, width: 2, height: 16, background: '#566174' }} />}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#CDD1C8', fontSize: 12 }}>No chart data</span>
                </div>
              )
            )}
          </div>
        </div>

        {/* ── LOWER ROW: MIG card + interpretation card ── */}
        {(hasMIG || interp) && (
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>

            {/* MIG card — mirrors ReverseDCFCompactCard */}
            {hasMIG && interp && (
              <div style={{
                display: 'flex', flexDirection: 'column', flex: 1,
                background: '#FFFFFF', border: '1px solid #E6ECF5',
                borderRadius: 12, padding: '12px 16px',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#06101F', fontSize: 12, fontWeight: 700 }}>What the market is pricing in</span>
                  <div style={{ display: 'flex', background: interp.chipBg, border: `1px solid ${interp.chipBorder}`, borderRadius: 9999, padding: '2px 8px' }}>
                    <span style={{ color: interp.chipColor, fontSize: 10, fontWeight: 600 }}>{interp.label}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ color: '#566174', fontSize: 10, fontWeight: 650 }}>Implied 5Y Revenue CAGR</span>
                    <span style={{ color: interp.chipColor, fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>{(mig! * 100).toFixed(1)}%</span>
                    <span style={{ color: '#9B9B9B', fontSize: 10 }}>Model assumes {(migA! * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32, paddingBottom: 2 }}>
                    {[0.25, 0.4, 0.35, 0.55, 0.6, 0.5, 0.7, 0.75, 0.85, 1].map((h, i) => (
                      <div key={i} style={{ display: 'flex', width: 5, height: 32 * h, borderRadius: 2, background: interp.chipColor, opacity: 0.2 + h * 0.6 }} />
                    ))}
                    <div style={{ display: 'flex', width: 7, height: 7, borderRadius: '50%', background: interp.chipColor, marginBottom: 1 }} />
                  </div>
                </div>
              </div>
            )}

            {/* Market interpretation — mirrors MarketInterpretationCard callout */}
            {interp && (
              <div style={{
                display: 'flex', flexDirection: 'column', flex: 1,
                background: '#FFFFFF', border: '1px solid #E6ECF5',
                borderRadius: 12, padding: '12px 16px',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              }}>
                <span style={{ color: '#06101F', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Market interpretation</span>
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 4,
                  background: interp.calloutBg, border: `1px solid ${interp.calloutBorder}`,
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <span style={{ color: interp.titleColor, fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{interp.title}</span>
                  <span style={{ color: '#566174', fontSize: 11, lineHeight: 1.5 }}>{interp.body}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SCENARIO BAR — full width, matches ScenarioRangeBar ── */}
        {hasScenBar && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            <span style={{ color: '#566174', fontSize: 10, fontWeight: 600 }}>Scenario range</span>
            <div style={{ display: 'flex', position: 'relative', height: 8, borderRadius: 9999, background: '#DBEAFE', width: TRACK_W }}>
              <div style={{ display: 'flex', position: 'absolute', top: 1, left: -3, width: 6, height: 6, borderRadius: '50%', background: '#F87171' }} />
              <div style={{ display: 'flex', position: 'absolute', top: 1, left: TRACK_W - 3, width: 6, height: 6, borderRadius: '50%', background: '#4ADE80' }} />
              <div style={{ display: 'flex', position: 'absolute', top: -2, left: basePx! - 6, width: 12, height: 12, borderRadius: '50%', background: '#3B82F6', border: '2px solid white', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }} />
              {pricePx != null && (
                <div style={{ display: 'flex', position: 'absolute', top: -4, left: pricePx - 1, width: 2, height: 16, background: '#566174' }} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: TRACK_W }}>
              <span style={{ color: '#F87171', fontSize: 10, fontWeight: 600 }}>Bear {fmt(bear!, currency)}</span>
              <span style={{ color: '#2563EB', fontSize: 10, fontWeight: 700 }}>Base {fv != null ? fmt(fv, currency) : '—'}</span>
              <span style={{ color: '#10B981', fontSize: 10, fontWeight: 600 }}>Bull {fmt(bull!, currency)}</span>
            </div>
            {pricePx != null && (
              <div style={{ display: 'flex', position: 'relative', width: TRACK_W, height: 12 }}>
                <span style={{ position: 'absolute', left: Math.max(0, Math.min(pricePx - 26, TRACK_W - 70)), color: '#566174', fontSize: 9, fontWeight: 600 }}>Current price {fmt(price, currency)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 10, borderTop: '1px solid #E5E5E5' }}>
          <span style={{ color: '#9B9B9B', fontSize: 9 }}>Not financial advice · model output only</span>
          <span style={{ color: '#9B9B9B', fontSize: 9 }}>{SITE_URL} · Invest with a process, not a story.</span>
        </div>

      </div>
    ),
    { width: 1200, height: 630 },
  )
}
