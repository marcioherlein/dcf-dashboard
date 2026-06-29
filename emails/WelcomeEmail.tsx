import {
  Body, Container, Head, Heading, Html, Img,
  Link, Preview, Section, Text, Hr,
} from '@react-email/components'

interface Props {
  name?: string | null
}

export default function WelcomeEmail({ name }: Props) {
  const firstName = name?.split(' ')[0] ?? 'there'

  return (
    <Html>
      <Head />
      <Preview>Welcome to insic — your first stock analysis awaits</Preview>
      <Body style={{ backgroundColor: '#F8FAFC', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>

          {/* Header */}
          <Section style={{ backgroundColor: '#111111', padding: '32px 40px' }}>
            <Heading style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>
              insic
            </Heading>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: '4px 0 0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Valuation Intelligence
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: '36px 40px' }}>
            <Heading style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              Welcome, {firstName} 👋
            </Heading>
            <Text style={{ fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: '0 0 24px' }}>
              You now have access to institutional-quality valuation tools — DCF models, 5 valuation methods, financial health scores, and Bear/Base/Bull scenarios for any NYSE or NASDAQ stock.
            </Text>

            {/* CTA */}
            <Link
              href="https://insic.app/analyze"
              style={{
                display: 'inline-block',
                backgroundColor: '#5F790B',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                padding: '14px 28px',
                borderRadius: '10px',
                textDecoration: 'none',
                marginBottom: '32px',
              }}
            >
              Analyze your first stock →
            </Link>

            <Hr style={{ borderColor: '#E2E8F0', margin: '0 0 24px' }} />

            {/* What's included */}
            <Text style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your free plan includes
            </Text>
            {[
              'Full DCF model + 5 valuation methods',
              'Bear / Base / Bull fair value scenarios',
              'Financial health scores (Piotroski, Altman, Beneish)',
              '10 stock analyses per month',
              '10 saved analyses to your watchlist',
            ].map(item => (
              <Text key={item} style={{ fontSize: '14px', color: '#475569', margin: '0 0 6px', paddingLeft: '16px' }}>
                ✓ {item}
              </Text>
            ))}
          </Section>

          {/* Footer */}
          <Section style={{ backgroundColor: '#F8FAFC', padding: '20px 40px', borderTop: '1px solid #E2E8F0' }}>
            <Text style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: '1.5' }}>
              You're receiving this because you signed up at{' '}
              <Link href="https://insic.app" style={{ color: '#5F790B' }}>insic.app</Link>.
              {' '}Questions? Reply to this email or reach us at{' '}
              <Link href="mailto:team@insic.app" style={{ color: '#5F790B' }}>team@insic.app</Link>.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}
