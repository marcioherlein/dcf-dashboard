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
    body: 'Implied growth expectations are supported by fundamentals and risk profile.',
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

  interface MethodItem { label: string; fv: number }
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
    fetch(`${baseUrl}/brand/mark-black.png`)
      .then(r => r.ok ? r.arrayBuffer() : null)
      .then(buf => buf ? `data:image/png;base64,${btoa(new Uint8Array(buf).reduce((a, b) => a + String.fromCharCode(b), ''))}` : null)
      .catch(() => null),

    name ? fetch(`https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${
      name.replace(/\s+(Corp\.?|Inc\.?|Ltd\.?|LLC\.?|PLC\.?|SE|AG|NV|SA|Group|Holdings?|Holding|Technologies?|Technology|Solutions?|Enterprises?|International|Industries?)$/i, '')
          .trim().toLowerCase().replace(/[^a-z0-9]/g, '')}.com&size=64`)
      .then(r => r.ok ? r.arrayBuffer() : null)
      .then(buf => buf ? `data:image/png;base64,${btoa(new Uint8Array(buf).reduce((a, b) => a + String.fromCharCode(b), ''))}` : null)
      .catch(() => null) : Promise.resolve(null),

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

  const CHART_W = 936
  const CHART_H = 220
  const chartData = priceHistory && fv != null && priceHistory.length >= 4
    ? buildChartPoints(priceHistory, fv, CHART_W, CHART_H)
    : null

  // ── scenario bar geometry ─────────────────────────────────────────────────

  const TRACK_W  = 936
  const fvRange  = bear != null && bull != null && bull > bear ? bull - bear : null
  const basePx   = fvRange && fv != null ? Math.max(10, Math.min(TRACK_W - 10, ((fv - bear!) / fvRange) * TRACK_W)) : null
  const pricePx  = fvRange && price > 0  ? Math.max(10, Math.min(TRACK_W - 10, ((price - bear!) / fvRange) * TRACK_W)) : null
  const hasScenBar = bear != null && bull != null && basePx != null

  // ── derived content ────────────────────────────────────────────────────────

  const interp  = migInterp(mig, migA)
  const hasMIG  = mig != null && migA != null
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // ── render ────────────────────────────────────────────────────────────────

  return new ImageResponse(
    (
      <div style={{
        display: 'flex', flexDirection: 'column',
        width: 1080, height: 1080,
        background: '#F8F7F2',
        padding: '36px 48px 32px',
        fontFamily: 'system-ui,-apple-system,sans-serif',
      }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {logoData
              ? <img src={logoData} style={{ width: 22, height: 22, objectFit: 'contain' }} alt="insic" />
              : <div style={{ display: 'flex', width: 22, height: 22, borderRadius: 5, background: BRAND.ink900, alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'white', fontSize: 12, fontWeight: 800 }}>i</span>
                </div>
            }
            <span style={{ color: BRAND.ink900, fontSize: 14, fontWeight: 700, letterSpacing: '0.03em' }}>INSIC</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {conviction && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: vd.bgHex, border: `1px solid ${vd.borderHex}`, borderRadius: 9999, padding: '4px 12px' }}>
                <div style={{ display: 'flex', width: 6, height: 6, borderRadius: '50%', background: vd.colorHex }} />
                <span style={{ color: vd.colorHex, fontSize: 11, fontWeight: 600 }}>{conviction}</span>
              </div>
            )}
            <span style={{ color: '#94A3B8', fontSize: 11 }}>{dateStr}</span>
          </div>
        </div>

        {/* ── VERDICT HERO CARD ── */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: '#FFFFFF', border: `1px solid ${BRAND.border}`,
          borderRadius: 18, padding: '24px 28px 20px',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.05)',
          marginBottom: 14,
        }}>
          {/* Stock logo + company name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {stockLogoData && (
              <img src={stockLogoData} style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }} alt={ticker} />
            )}
            {name ? <span style={{ color: '#64748B', fontSize: 14, fontWeight: 500 }}>{name}</span> : <div style={{ display: 'flex' }} />}
          </div>

          {/* Ticker + looks + verdict */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: BRAND.ink900, fontSize: 80, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{ticker}</span>
            <span style={{ color: '#94A3B8', fontSize: 50, fontWeight: 300, letterSpacing: '-0.01em', lineHeight: 1 }}>looks</span>
            <span style={{ color: vd.colorHex, fontSize: 50, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{vd.word}</span>
          </div>

          {/* Blurb */}
          <span style={{ color: '#475569', fontSize: 14, lineHeight: 1.5, marginTop: 8, marginBottom: 16 }}>{BLURB[verdict]}</span>

          {/* Metrics row */}
          <div style={{ display: 'flex', gap: 0, borderTop: `1px solid ${BRAND.border}`, paddingTop: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, paddingRight: 24, borderRight: `1px solid ${BRAND.border}` }}>
              <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fair Value</span>
              <span style={{ color: BRAND.ink900, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>{fv != null ? fmt(fv, currency) : '—'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, paddingLeft: 24, paddingRight: 24, borderRight: `1px solid ${BRAND.border}` }}>
              <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vs Current Price</span>
              <span style={{ color: '#475569', fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmt(price, currency)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, paddingLeft: 24 }}>
              <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{isUp ? 'Upside' : 'Downside'}</span>
              <div style={{ display: 'flex', background: upBg, borderRadius: 10, padding: '4px 14px' }}>
                <span style={{ color: upsideColor, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>{upsideStr ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── PRICE CHART ── */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: '#FFFFFF', border: `1px solid ${BRAND.border}`,
          borderRadius: 16, padding: '16px 20px',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.05)',
          marginBottom: 14, overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Price chart</span>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ display: 'flex', width: 18, height: 2, background: BRAND.olive700, borderRadius: 1 }} />
                <span style={{ color: '#64748B', fontSize: 10 }}>Fair value {fv != null ? fmt(fv, currency) : ''}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ display: 'flex', width: 18, height: 2, background: BRAND.blue600, borderRadius: 1 }} />
                <span style={{ color: '#64748B', fontSize: 10 }}>Price {fmt(price, currency)}</span>
              </div>
            </div>
          </div>

          {chartData ? (
            <div style={{ display: 'flex', position: 'relative' }}>
              <svg width={CHART_W} height={CHART_H} style={{ display: 'flex', overflow: 'visible' }}>
                <polygon points={chartData.areaPoints} fill={`${BRAND.blue600}12`} />
                <polyline points={chartData.fvPoints} fill="none" stroke={BRAND.olive700} strokeWidth="1.5" strokeDasharray="8,5" />
                <polyline points={chartData.pricePoints} fill="none" stroke={BRAND.blue600} strokeWidth="2.5" strokeLinejoin="round" />
              </svg>
              {/* Right-edge badges */}
              <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', right: -16, top: 0, bottom: 0, justifyContent: 'space-between', paddingTop: 6, paddingBottom: 6 }}>
                <div style={{ display: 'flex', background: BRAND.olive700, borderRadius: 6, padding: '3px 8px' }}>
                  <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{fv != null ? fmt(fv, currency) : ''}</span>
                </div>
                <div style={{ display: 'flex', background: BRAND.blue600, borderRadius: 6, padding: '3px 8px' }}>
                  <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{fmt(price, currency)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', height: CHART_H, alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#CBD5E1', fontSize: 13 }}>No chart data available</span>
            </div>
          )}
        </div>

        {/* ── MIG + INTERPRETATION ROW ── */}
        {(hasMIG || interp) && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            {hasMIG && (
              <div style={{
                display: 'flex', flexDirection: 'column', flex: 1,
                background: '#FFFFFF', border: `1px solid ${BRAND.border}`,
                borderRadius: 14, padding: '16px 20px',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              }}>
                <span style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>What the market is pricing in</span>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 600 }}>Implied 5Y Revenue CAGR</span>
                    <span style={{ color: vd.colorHex, fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{(mig! * 100).toFixed(1)}%</span>
                    <span style={{ color: '#94A3B8', fontSize: 11 }}>Model assumes {(migA! * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 36 }}>
                    {[0.3, 0.45, 0.4, 0.55, 0.65, 0.6, 0.75, 0.8, 0.85, 1].map((h, i) => (
                      <div key={i} style={{ display: 'flex', width: 6, height: 36 * h, borderRadius: 2, background: vd.colorHex, opacity: 0.25 + h * 0.55 }} />
                    ))}
                    <div style={{ display: 'flex', width: 8, height: 8, borderRadius: '50%', background: vd.colorHex, alignSelf: 'flex-end' }} />
                  </div>
                </div>
              </div>
            )}
            {interp && (
              <div style={{
                display: 'flex', flexDirection: 'column', flex: 1,
                background: vd.bgHex, border: `1px solid ${vd.borderHex}`,
                borderRadius: 14, padding: '16px 20px',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              }}>
                <span style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Market interpretation</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', width: 36, height: 36, borderRadius: 9, background: interp.color + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 16 16" style={{ display: 'flex' }}>
                      <path d={interp.isWarn
                        ? 'M8 2L14 13H2L8 2Z'
                        : 'M3 11 L9 5 M9 5 L9 10 M9 5 L4 5'}
                        fill="none" stroke={interp.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ color: interp.color, fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{interp.title}</span>
                    <span style={{ color: '#475569', fontSize: 12, lineHeight: 1.45 }}>{interp.body}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SCENARIO BAR ── */}
        {hasScenBar && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Scenario range</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: TRACK_W }}>
              <span style={{ color: BRAND.negative, fontSize: 11, fontWeight: 600 }}>Bear {fmt(bear!, currency)}</span>
              <span style={{ color: '#475569', fontSize: 11, fontWeight: 700 }}>Base {fv != null ? fmt(fv, currency) : '—'}</span>
              <span style={{ color: BRAND.positive, fontSize: 11, fontWeight: 600 }}>Bull {fmt(bull!, currency)}</span>
            </div>
            <div style={{ display: 'flex', position: 'relative', height: 10, borderRadius: 9999, background: `linear-gradient(to right,${BRAND.negative}40,#E2E8F0,${BRAND.positive}40)`, width: TRACK_W }}>
              {pricePx != null && (
                <div style={{ display: 'flex', position: 'absolute', top: -5, left: pricePx - 5, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `9px solid ${BRAND.blue600}` }} />
              )}
              <div style={{ display: 'flex', position: 'absolute', top: -5, left: basePx! - 10, width: 20, height: 20, borderRadius: '50%', background: 'white', border: `3px solid ${BRAND.olive700}`, boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} />
            </div>
            {pricePx != null && (
              <div style={{ display: 'flex', position: 'relative', width: TRACK_W, height: 16 }}>
                <span style={{ position: 'absolute', left: Math.max(0, Math.min(pricePx - 32, TRACK_W - 80)), color: BRAND.blue600, fontSize: 10, fontWeight: 600 }}>Current price {fmt(price, currency)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${BRAND.border}` }}>
          <span style={{ color: '#94A3B8', fontSize: 10 }}>Not financial advice · model output only</span>
          <span style={{ color: '#94A3B8', fontSize: 10 }}>{SITE_URL} · Invest with a process, not a story.</span>
        </div>

      </div>
    ),
    { width: 1080, height: 1080 },
  )
}
