import {
  Body, Container, Head, Heading, Html,
  Link, Preview, Section, Text, Hr, Row, Column,
} from '@react-email/components'

export interface WatchlistStock {
  ticker: string
  companyName: string
  fairValue: number | null
  currentPrice: number | null
  priceAtSave: number | null
  upsidePct: number | null
  cagr: number | null
  currency: string
}

export interface SpotlightStock {
  ticker: string
  companyName: string
  thesis: string
  signal: 'undervalued' | 'fairly-valued' | 'overvalued'
  fairValue: number
  currentPrice: number
  upsidePct: number
  currency: string
}

export interface DigestContent {
  subjectLine: string
  opening: string
  marketSection: string
  stockSpotlight: SpotlightStock[]
  macroNote: string
  weekOf: string
}

interface Props {
  name?: string | null
  watchlist: WatchlistStock[]
  content: DigestContent
}

function fmt(v: number | null, currency = 'USD') {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v)
}

function fmtPct(v: number | null) {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(1)}%`
}

function upsideColor(pct: number | null): string {
  if (pct == null) return '#6B6B6B'
  if (pct >= 0.20) return '#11875D'
  if (pct >= 0.05) return '#B56A00'
  if (pct >= -0.05) return '#6B6B6B'
  return '#D83B3B'
}

function signalBadge(signal: string): { label: string; bg: string; color: string } {
  switch (signal) {
    case 'undervalued':   return { label: 'Undervalued',  bg: '#E8F7EF', color: '#11875D' }
    case 'fairly-valued': return { label: 'Fair value',   bg: '#FFF4DA', color: '#B56A00' }
    case 'overvalued':    return { label: 'Overvalued',   bg: '#FCEAEA', color: '#D83B3B' }
    default:              return { label: signal,         bg: '#F4F3EF', color: '#6B6B6B' }
  }
}

export default function WeeklyDigestEmail({ name, watchlist, content }: Props) {
  const firstName = name?.split(' ')[0] ?? 'there'
  const hasWatchlist = watchlist.length > 0

  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  return (
    <Html>
      <Head />
      <Preview>{content.subjectLine}</Preview>
      <Body style={{ fontFamily: FONT, backgroundColor: '#F5F4EF', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '32px auto' }}>

          {/* Header */}
          <Section style={{ backgroundColor: '#111111', borderRadius: '16px 16px 0 0', padding: '28px 40px 24px' }}>
            <Row>
              <Column>
                <Text style={{ color: '#ffffff', fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>insic</Text>
                <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: '11px', margin: '2px 0 0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Weekly · {content.weekOf}
                </Text>
              </Column>
              <Column style={{ textAlign: 'right' }}>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: 0 }}>For {firstName}</Text>
              </Column>
            </Row>
          </Section>

          {/* Opening */}
          <Section style={{ backgroundColor: '#ffffff', padding: '32px 40px 28px' }}>
            <Heading style={{ fontSize: '22px', fontWeight: 700, color: '#111111', margin: '0 0 14px', letterSpacing: '-0.025em', lineHeight: '1.25' }}>
              {content.subjectLine}
            </Heading>
            <Text style={{ fontSize: '15px', color: '#4B4B4B', lineHeight: '1.7', margin: 0 }}>
              {content.opening}
            </Text>
          </Section>

          <Hr style={{ borderColor: '#E5E5E5', margin: 0 }} />

          {/* Market recap */}
          <Section style={{ backgroundColor: '#ffffff', padding: '28px 40px' }}>
            <Text style={{ fontSize: '10px', fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.10em', textTransform: 'uppercase', margin: '0 0 12px' }}>
              This Week in Markets
            </Text>
            <Text style={{ fontSize: '14px', color: '#3B3B3B', lineHeight: '1.7', margin: 0 }}>
              {content.marketSection}
            </Text>
          </Section>

          <Hr style={{ borderColor: '#E5E5E5', margin: 0 }} />

          {/* Stock spotlight */}
          {content.stockSpotlight.length > 0 && (
            <>
              <Section style={{ backgroundColor: '#ffffff', padding: '28px 40px 16px' }}>
                <Text style={{ fontSize: '10px', fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.10em', textTransform: 'uppercase', margin: '0 0 4px' }}>
                  3 Stocks Worth Watching
                </Text>
                <Text style={{ fontSize: '12px', color: '#C4C4C4', margin: '0 0 0' }}>From our screener — NYSE &amp; NASDAQ</Text>
              </Section>

              {content.stockSpotlight.map((s, i) => {
                const badge = signalBadge(s.signal)
                return (
                  <Section key={s.ticker} style={{
                    backgroundColor: '#ffffff',
                    padding: '16px 40px',
                    borderTop: '1px solid #F0F0EC',
                  }}>
                    <Row>
                      <Column style={{ width: '55%' }}>
                        <Text style={{ fontSize: '14px', fontWeight: 700, color: '#111111', margin: '0 0 1px', fontFamily: 'monospace' }}>{s.ticker}</Text>
                        <Text style={{ fontSize: '12px', color: '#6B6B6B', margin: 0 }}>{s.companyName}</Text>
                      </Column>
                      <Column style={{ width: '45%', textAlign: 'right' }}>
                        <Text style={{ display: 'inline-block', backgroundColor: badge.bg, color: badge.color, fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', letterSpacing: '0.04em', margin: 0 }}>
                          {badge.label}
                        </Text>
                      </Column>
                    </Row>

                    <Row style={{ marginTop: '10px' }}>
                      <Column style={{ width: '33%' }}>
                        <Text style={{ fontSize: '10px', color: '#9B9B9B', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price</Text>
                        <Text style={{ fontSize: '13px', fontWeight: 600, color: '#111111', margin: 0 }}>{fmt(s.currentPrice, s.currency)}</Text>
                      </Column>
                      <Column style={{ width: '33%' }}>
                        <Text style={{ fontSize: '10px', color: '#9B9B9B', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fair Value</Text>
                        <Text style={{ fontSize: '13px', fontWeight: 600, color: '#111111', margin: 0 }}>{fmt(s.fairValue, s.currency)}</Text>
                      </Column>
                      <Column style={{ width: '33%' }}>
                        <Text style={{ fontSize: '10px', color: '#9B9B9B', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upside</Text>
                        <Text style={{ fontSize: '14px', fontWeight: 700, color: upsideColor(s.upsidePct), margin: 0 }}>{fmtPct(s.upsidePct)}</Text>
                      </Column>
                    </Row>

                    <Text style={{ fontSize: '13px', color: '#4B4B4B', lineHeight: '1.6', margin: '10px 0 8px' }}>{s.thesis}</Text>
                    <Link href={`https://insic.app/stock/${s.ticker}`} style={{ fontSize: '12px', color: '#5F790B', fontWeight: 600, textDecoration: 'none' }}>
                      Full analysis →
                    </Link>
                  </Section>
                )
              })}
              <Hr style={{ borderColor: '#E5E5E5', margin: 0 }} />
            </>
          )}

          {/* Personal watchlist */}
          {hasWatchlist && (
            <>
              <Section style={{ backgroundColor: '#ffffff', padding: '28px 40px 12px' }}>
                <Text style={{ fontSize: '10px', fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.10em', textTransform: 'uppercase', margin: '0 0 4px' }}>
                  Your Watchlist
                </Text>
                <Text style={{ fontSize: '12px', color: '#C4C4C4', margin: '0 0 16px' }}>
                  {watchlist.length} saved {watchlist.length === 1 ? 'analysis' : 'analyses'}
                </Text>
              </Section>

              {watchlist.map((stock) => {
                const priceChange = stock.currentPrice && stock.priceAtSave && stock.priceAtSave > 0
                  ? (stock.currentPrice - stock.priceAtSave) / stock.priceAtSave
                  : null

                return (
                  <Section key={stock.ticker} style={{ backgroundColor: '#ffffff', padding: '0 40px 10px' }}>
                    <Row style={{ backgroundColor: '#FAFAF8', borderRadius: '10px', padding: '12px 14px', border: '1px solid #EFEFEC' }}>
                      <Column style={{ width: '30%' }}>
                        <Text style={{ fontSize: '13px', fontWeight: 700, color: '#111111', margin: '0 0 1px', fontFamily: 'monospace' }}>{stock.ticker}</Text>
                        <Text style={{ fontSize: '10px', color: '#9B9B9B', margin: 0 }}>
                          {stock.companyName.length > 16 ? stock.companyName.slice(0, 14) + '…' : stock.companyName}
                        </Text>
                      </Column>
                      <Column style={{ width: '25%' }}>
                        <Text style={{ fontSize: '10px', color: '#9B9B9B', margin: '0 0 1px' }}>Price</Text>
                        <Text style={{ fontSize: '12px', fontWeight: 600, color: '#111111', margin: 0 }}>{fmt(stock.currentPrice, stock.currency)}</Text>
                        {priceChange !== null && (
                          <Text style={{ fontSize: '10px', color: upsideColor(priceChange), margin: 0 }}>{fmtPct(priceChange)} since save</Text>
                        )}
                      </Column>
                      <Column style={{ width: '25%' }}>
                        <Text style={{ fontSize: '10px', color: '#9B9B9B', margin: '0 0 1px' }}>Fair Value</Text>
                        <Text style={{ fontSize: '12px', fontWeight: 600, color: '#111111', margin: 0 }}>{fmt(stock.fairValue, stock.currency)}</Text>
                      </Column>
                      <Column style={{ width: '20%', textAlign: 'right' }}>
                        <Text style={{ fontSize: '10px', color: '#9B9B9B', margin: '0 0 1px' }}>Upside</Text>
                        <Text style={{ fontSize: '13px', fontWeight: 700, color: upsideColor(stock.upsidePct), margin: 0 }}>{fmtPct(stock.upsidePct)}</Text>
                      </Column>
                    </Row>
                  </Section>
                )
              })}

              <Section style={{ backgroundColor: '#ffffff', padding: '8px 40px 28px' }}>
                <Link href="https://insic.app/valuations" style={{ display: 'inline-block', backgroundColor: '#111111', color: '#ffffff', fontSize: '13px', fontWeight: 600, padding: '11px 22px', borderRadius: '8px', textDecoration: 'none' }}>
                  Open full watchlist →
                </Link>
              </Section>
              <Hr style={{ borderColor: '#E5E5E5', margin: 0 }} />
            </>
          )}

          {/* Macro closing note */}
          <Section style={{ backgroundColor: '#F8F7F2', padding: '28px 40px' }}>
            <Text style={{ fontSize: '10px', fontWeight: 700, color: '#9B9B9B', letterSpacing: '0.10em', textTransform: 'uppercase', margin: '0 0 10px' }}>
              One Last Thought
            </Text>
            <Text style={{ fontSize: '14px', color: '#4B4B4B', lineHeight: '1.65', margin: '0 0 20px', fontStyle: 'italic' }}>
              &ldquo;{content.macroNote}&rdquo;
            </Text>
            <Link href="https://insic.app/analyze" style={{ display: 'inline-block', backgroundColor: '#5F790B', color: '#ffffff', fontSize: '13px', fontWeight: 600, padding: '11px 22px', borderRadius: '8px', textDecoration: 'none' }}>
              Analyze a stock →
            </Link>
          </Section>

          {/* Footer */}
          <Section style={{ backgroundColor: '#111111', borderRadius: '0 0 16px 16px', padding: '20px 40px' }}>
            <Text style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: '1.6' }}>
              insic · institutional-quality valuation for individual investors ·{' '}
              <Link href="https://insic.app/settings" style={{ color: 'rgba(255,255,255,0.45)' }}>manage preferences</Link>
              {' '}·{' '}
              <Link href="https://insic.app/privacy" style={{ color: 'rgba(255,255,255,0.35)' }}>privacy</Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}
