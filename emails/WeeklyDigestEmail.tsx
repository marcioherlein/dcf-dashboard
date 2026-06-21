import {
  Body, Container, Head, Heading, Html,
  Link, Preview, Section, Text, Hr, Row, Column,
} from '@react-email/components'

export interface DigestEntry {
  ticker: string
  companyName: string
  fairValue: number | null
  currentPrice: number | null
  upsidePct: number | null
  currency: string
}

interface Props {
  name?: string | null
  entries: DigestEntry[]
  weekOf: string
}

function fmtUsd(v: number | null, currency = 'USD') {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v)
}

function upsideColor(pct: number | null): string {
  if (pct == null) return '#64748B'
  if (pct >= 0.2) return '#11875D'
  if (pct >= 0) return '#B56A00'
  return '#D83B3B'
}

function upsideLabel(pct: number | null): string {
  if (pct == null) return '—'
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${(pct * 100).toFixed(1)}%`
}

export default function WeeklyDigestEmail({ name, entries, weekOf }: Props) {
  const firstName = name?.split(' ')[0] ?? 'there'
  const hasEntries = entries.length > 0

  return (
    <Html>
      <Head />
      <Preview>Your insic watchlist — week of {weekOf}</Preview>
      <Body style={{ backgroundColor: '#F8FAFC', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>

          {/* Header */}
          <Section style={{ backgroundColor: '#0d1117', padding: '28px 40px' }}>
            <Heading style={{ color: '#ffffff', fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>
              insic
            </Heading>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: '4px 0 0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Weekly Watchlist · {weekOf}
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: '32px 40px 24px' }}>
            <Heading style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              Your watchlist, {firstName}
            </Heading>
            <Text style={{ fontSize: '14px', color: '#64748B', margin: '0 0 24px', lineHeight: '1.5' }}>
              {hasEntries
                ? `Here's where your ${entries.length} saved stock${entries.length === 1 ? '' : 's'} stand against insic's fair value estimate.`
                : 'You haven\'t saved any stock analyses yet. Start by analyzing a ticker below.'}
            </Text>

            {hasEntries && (
              <>
                {/* Table header */}
                <Row style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '8px', marginBottom: '4px' }}>
                  <Column style={{ width: '35%' }}>
                    <Text style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stock</Text>
                  </Column>
                  <Column style={{ width: '22%', textAlign: 'right' as const }}>
                    <Text style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Price</Text>
                  </Column>
                  <Column style={{ width: '22%', textAlign: 'right' as const }}>
                    <Text style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fair Value</Text>
                  </Column>
                  <Column style={{ width: '21%', textAlign: 'right' as const }}>
                    <Text style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Upside</Text>
                  </Column>
                </Row>

                {/* Rows */}
                {entries.map((e) => (
                  <Row key={e.ticker} style={{ borderBottom: '1px solid #F1F5F9', paddingTop: '10px', paddingBottom: '10px' }}>
                    <Column style={{ width: '35%' }}>
                      <Text style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0, fontFamily: 'monospace' }}>{e.ticker}</Text>
                      <Text style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0', overflow: 'hidden', maxWidth: '150px' }}>{e.companyName}</Text>
                    </Column>
                    <Column style={{ width: '22%', textAlign: 'right' as const }}>
                      <Text style={{ fontSize: '13px', color: '#0F172A', margin: 0 }}>{fmtUsd(e.currentPrice, e.currency)}</Text>
                    </Column>
                    <Column style={{ width: '22%', textAlign: 'right' as const }}>
                      <Text style={{ fontSize: '13px', color: '#0F172A', margin: 0 }}>{fmtUsd(e.fairValue, e.currency)}</Text>
                    </Column>
                    <Column style={{ width: '21%', textAlign: 'right' as const }}>
                      <Text style={{ fontSize: '13px', fontWeight: 700, color: upsideColor(e.upsidePct), margin: 0 }}>
                        {upsideLabel(e.upsidePct)}
                      </Text>
                    </Column>
                  </Row>
                ))}
              </>
            )}

            <Link
              href="https://insic.app/valuations"
              style={{
                display: 'inline-block',
                marginTop: '24px',
                backgroundColor: '#5F790B',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                padding: '12px 24px',
                borderRadius: '10px',
                textDecoration: 'none',
              }}
            >
              View full watchlist →
            </Link>
          </Section>

          <Hr style={{ borderColor: '#E2E8F0', margin: '0 40px' }} />

          {/* Footer */}
          <Section style={{ padding: '20px 40px' }}>
            <Text style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: '1.6' }}>
              You're receiving this weekly digest because you have saved analyses on{' '}
              <Link href="https://insic.app" style={{ color: '#5F790B' }}>insic.app</Link>.{' '}
              To stop receiving these emails, visit your{' '}
              <Link href="https://insic.app/settings" style={{ color: '#5F790B' }}>account settings</Link>.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}
