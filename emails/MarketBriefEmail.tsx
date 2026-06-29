import {
  Body, Container, Head, Heading, Html,
  Link, Preview, Section, Text, Hr, Row, Column,
} from '@react-email/components'

interface MarketMover {
  ticker: string
  name: string
  change: string
  price: string
  positive: boolean
}

interface RateStat {
  label: string
  value: string
  change?: string
}

interface Props {
  date?: string
  subject?: string
  intro?: string
  body?: string
  movers?: MarketMover[]
  rates?: RateStat[]
  footnote?: string
}

const DEFAULT_MOVERS: MarketMover[] = [
  { ticker: 'AMZN', name: 'Amazon',    change: '+5.42%', price: '$244.58', positive: true  },
  { ticker: 'GOOGL', name: 'Alphabet', change: '+3.09%', price: '$348.57', positive: true  },
  { ticker: 'PLTR', name: 'Palantir',  change: '+4.03%', price: '$116.67', positive: true  },
  { ticker: 'META', name: 'Meta',       change: '+2.84%', price: '$566.87', positive: true  },
  { ticker: 'NVDA', name: 'Nvidia',     change: '−0.73%', price: '$191.38', positive: false },
  { ticker: 'ORCL', name: 'Oracle',     change: '−1.19%', price: '$147.22', positive: false },
]

const DEFAULT_RATES: RateStat[] = [
  { label: '10Y Treasury', value: '4.371%' },
  { label: '30Y Treasury', value: '4.856%' },
  { label: 'VIX',          value: '18.73', change: '+1.90%' },
  { label: 'EUR/USD',      value: '1.1422', change: '+0.29%' },
  { label: 'GBP/USD',      value: '1.3241', change: '+0.33%' },
  { label: 'USD/JPY',      value: '161.89' },
]

export default function MarketBriefEmail({
  date     = 'Monday, 30 June 2025',
  subject  = "Monday's Market Brief",
  intro    = "Hi there,",
  body,
  movers   = DEFAULT_MOVERS,
  rates    = DEFAULT_RATES,
  footnote,
}: Props) {

  const defaultBody = `Large-cap tech and enterprise software are rallying sharply while the Russell 2000 falls 0.78%, EM ETFs drop nearly 1%, gold slides 1.43%, and the VIX nudges higher — a classic bifurcated tape where size and quality are doing the heavy lifting.

Monday morning opens the final trading day of June with a market that looks stronger on the surface than it feels underneath. Amazon's 5.42% surge to $244.58 is the single most arresting data point — a move of that magnitude in a $2 trillion-plus company on a quiet macro Monday commands attention and is dragging the broader mega-cap complex higher, even as the VIX ticks up 1.90% to 18.73, a quiet reminder that hedging demand has not evaporated alongside the enthusiasm.

The equity story this session is unambiguously one of concentration, not breadth. Alphabet's 3.09% gain to $348.57, Meta's 2.84% advance to $566.87, and Palantir's 4.03% jump to $116.67 tell a coherent narrative: AI monetisation and cloud infrastructure are attracting fresh capital on what appears to be buy-the-dip conviction after any recent softness. Yet the Russell 2000's 0.78% decline to 2,986 and the near-1% drop in the EM ETF suggest that this is a trade in quality and scale, not a ringing endorsement of the broader economic cycle.

In the enterprise software arena, the competitive dynamics remain fascinating. ServiceNow leads the peer group with a 3.04% advance to $101.75, continuing to benefit from its positioning at the intersection of AI-driven workflow automation and large enterprise budgets. SAP SE gains a solid 1.10% to $157.40, Workday adds 1.87% to $126.33, and Intuit rises 2.07% to $274.03. The outlier is Oracle, which slips 1.19% to $147.22, a divergence worth tracking given its heavy cloud infrastructure exposure. Nvidia, the bellwether of the AI capex cycle, gives back 0.73% to $191.38 — a modest pullback that, set against Amazon and Alphabet's advances, may simply reflect rotation from chip names toward platform beneficiaries.

On rates, the picture is one of cautious stability. The 10-year Treasury at 4.371% is holding below the psychologically significant 4.40% line that has previously triggered equity turbulence, and the long bond's modest rally to 4.856% hints at duration buyers stepping in on any weakness. The dollar is doing little to disrupt the macro backdrop — EUR/USD adds 0.29% to 1.1422 and GBP/USD rises 0.33% to 1.3241, while USD/JPY's continued grind to 161.89 keeps Tokyo's currency dilemma firmly in focus for any cross-asset manager with Asian exposure.

Heading into the session, the Eurozone Sentix Investor Confidence print at 08:00 CET is the first data point that could move European markets. The key question is whether Amazon's outsized gain reflects something stock-specific or a genuine re-rating signal for the cloud infrastructure complex. Watch the $244 level in Amazon, the 2,986 support in the Russell 2000, and whether gold can stabilise near $4,024 or continues its retreat. Quarter-end flows add a further layer of noise today.`

  const paragraphs = (body ?? defaultBody).split('\n\n').filter(Boolean)

  return (
    <Html>
      <Head />
      <Preview>{subject} — {date}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* ── Header ── */}
          <Section style={styles.header}>
            <Row>
              <Column>
                <Heading style={styles.logoText}>insic</Heading>
                <Text style={styles.logoSub}>Market Intelligence</Text>
              </Column>
              <Column style={{ textAlign: 'right' }}>
                <Text style={styles.dateLabel}>{date}</Text>
              </Column>
            </Row>
          </Section>

          {/* ── Subject line ── */}
          <Section style={styles.subjectBand}>
            <Text style={styles.subjectText}>{subject}</Text>
          </Section>

          {/* ── Movers grid ── */}
          <Section style={styles.moversSection}>
            <Text style={styles.sectionLabel}>Key Movers</Text>
            <Row style={{ marginBottom: '8px' }}>
              {movers.slice(0, 3).map(m => (
                <Column key={m.ticker} style={styles.moverCell}>
                  <div style={{
                    ...styles.moverCard,
                    borderLeft: `3px solid ${m.positive ? '#5F790B' : '#D83B3B'}`,
                  }}>
                    <Text style={styles.moverTicker}>{m.ticker}</Text>
                    <Text style={styles.moverName}>{m.name}</Text>
                    <Text style={{ ...styles.moverChange, color: m.positive ? '#5F790B' : '#D83B3B' }}>
                      {m.change}
                    </Text>
                    <Text style={styles.moverPrice}>{m.price}</Text>
                  </div>
                </Column>
              ))}
            </Row>
            <Row>
              {movers.slice(3, 6).map(m => (
                <Column key={m.ticker} style={styles.moverCell}>
                  <div style={{
                    ...styles.moverCard,
                    borderLeft: `3px solid ${m.positive ? '#5F790B' : '#D83B3B'}`,
                  }}>
                    <Text style={styles.moverTicker}>{m.ticker}</Text>
                    <Text style={styles.moverName}>{m.name}</Text>
                    <Text style={{ ...styles.moverChange, color: m.positive ? '#5F790B' : '#D83B3B' }}>
                      {m.change}
                    </Text>
                    <Text style={styles.moverPrice}>{m.price}</Text>
                  </div>
                </Column>
              ))}
            </Row>
          </Section>

          <Hr style={styles.divider} />

          {/* ── Intro + body ── */}
          <Section style={styles.bodySection}>
            <Text style={styles.intro}>{intro}</Text>
            {paragraphs.map((p, i) => (
              <Text key={i} style={i === 0 ? styles.leadParagraph : styles.paragraph}>
                {p}
              </Text>
            ))}
          </Section>

          <Hr style={styles.divider} />

          {/* ── Rates & FX ── */}
          <Section style={styles.ratesSection}>
            <Text style={styles.sectionLabel}>Rates &amp; FX</Text>
            <Row>
              {rates.slice(0, 3).map(r => (
                <Column key={r.label} style={styles.rateCell}>
                  <Text style={styles.rateLabel}>{r.label}</Text>
                  <Text style={styles.rateValue}>{r.value}</Text>
                  {r.change && <Text style={styles.rateChange}>{r.change}</Text>}
                </Column>
              ))}
            </Row>
            <Row style={{ marginTop: '8px' }}>
              {rates.slice(3, 6).map(r => (
                <Column key={r.label} style={styles.rateCell}>
                  <Text style={styles.rateLabel}>{r.label}</Text>
                  <Text style={styles.rateValue}>{r.value}</Text>
                  {r.change && <Text style={styles.rateChange}>{r.change}</Text>}
                </Column>
              ))}
            </Row>
          </Section>

          <Hr style={styles.divider} />

          {/* ── CTA ── */}
          <Section style={styles.ctaSection}>
            <Text style={styles.ctaText}>
              Run a DCF on any stock mentioned above.
            </Text>
            <Link
              href="https://insic.app/analyze"
              style={styles.ctaButton}
            >
              Open insic.app →
            </Link>
          </Section>

          {/* ── Footer ── */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              {footnote ?? 'This is a market intelligence brief from insic. It is for informational purposes only and does not constitute financial advice.'}{' '}
              <Link href="https://insic.app" style={styles.footerLink}>insic.app</Link>
              {' '}·{' '}
              <Link href="mailto:team@insic.app" style={styles.footerLink}>team@insic.app</Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = {
  body: {
    backgroundColor: '#F0F1F6',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    margin: 0,
    padding: '32px 0',
  },
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    overflow: 'hidden' as const,
  },
  header: {
    backgroundColor: '#111111',
    padding: '28px 36px',
  },
  logoText: {
    color: '#ffffff',
    fontSize: '22px',
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-0.03em',
  },
  logoSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '11px',
    margin: '3px 0 0',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
  },
  dateLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '12px',
    margin: 0,
    marginTop: '6px',
  },
  subjectBand: {
    backgroundColor: '#5F790B',
    padding: '14px 36px',
  },
  subjectText: {
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.01em',
  },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#94A3B8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    margin: '0 0 12px',
  },
  moversSection: {
    padding: '24px 36px 20px',
    backgroundColor: '#FAFAFA',
  },
  moverCell: {
    width: '33.33%',
    paddingRight: '8px',
  },
  moverCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #E8ECF2',
    borderRadius: '8px',
    padding: '10px 12px',
  },
  moverTicker: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#111111',
    margin: 0,
    fontFamily: '"Courier New", monospace',
  },
  moverName: {
    fontSize: '10px',
    color: '#94A3B8',
    margin: '1px 0 6px',
  },
  moverChange: {
    fontSize: '14px',
    fontWeight: 700,
    margin: '0 0 1px',
  },
  moverPrice: {
    fontSize: '11px',
    color: '#64748B',
    margin: 0,
  },
  divider: {
    borderColor: '#E8ECF2',
    margin: '0',
  },
  bodySection: {
    padding: '28px 36px',
  },
  intro: {
    fontSize: '15px',
    color: '#0F172A',
    fontWeight: 600,
    margin: '0 0 16px',
  },
  leadParagraph: {
    fontSize: '15px',
    color: '#1E293B',
    lineHeight: '1.7',
    margin: '0 0 18px',
    fontWeight: 500,
  },
  paragraph: {
    fontSize: '14px',
    color: '#334155',
    lineHeight: '1.75',
    margin: '0 0 16px',
  },
  ratesSection: {
    padding: '20px 36px 24px',
    backgroundColor: '#FAFAFA',
  },
  rateCell: {
    width: '33.33%',
    paddingRight: '8px',
  },
  rateLabel: {
    fontSize: '10px',
    color: '#94A3B8',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    margin: '0 0 2px',
  },
  rateValue: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#111111',
    margin: '0 0 1px',
    fontFamily: '"Courier New", monospace',
  },
  rateChange: {
    fontSize: '11px',
    color: '#64748B',
    margin: 0,
  },
  ctaSection: {
    padding: '28px 36px',
    textAlign: 'center' as const,
  },
  ctaText: {
    fontSize: '14px',
    color: '#475569',
    margin: '0 0 16px',
  },
  ctaButton: {
    display: 'inline-block',
    backgroundColor: '#111111',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 700,
    padding: '13px 28px',
    borderRadius: '10px',
    textDecoration: 'none',
  },
  footer: {
    backgroundColor: '#F8FAFC',
    padding: '18px 36px',
    borderTop: '1px solid #E2E8F0',
  },
  footerText: {
    fontSize: '11px',
    color: '#94A3B8',
    margin: 0,
    lineHeight: '1.6',
  },
  footerLink: {
    color: '#5F790B',
  },
}
